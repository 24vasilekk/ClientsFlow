import type { ChannelAdapter } from "./adapter";
import type {
  AdapterContext,
  ChannelConnection,
  ChannelEvent,
  Conversation,
  IncomingMessage,
  Lead,
  OutgoingMessage
} from "./types";

export type AiDecision = {
  shouldReply: boolean;
  replyText?: string;
  stageUpdate?: Lead["stage"];
  scoreUpdate?: number;
  reason?: string;
};

export interface ConnectionRepository {
  getConnectionById(connectionId: string): Promise<ChannelConnection | null>;
}

export interface ConversationRepository {
  upsertFromIncoming(message: IncomingMessage, workspaceId: string): Promise<Conversation>;
}

export interface LeadRepository {
  upsertFromConversation(conversation: Conversation, message: IncomingMessage): Promise<Lead>;
  updateStage(leadId: string, stage: Lead["stage"], reason?: string): Promise<void>;
  updateScore(leadId: string, score: number): Promise<void>;
}

export interface EventRepository {
  save(event: ChannelEvent): Promise<void>;
}

export interface AiDecisionEngine {
  decide(args: {
    conversation: Conversation;
    lead: Lead;
    incoming: IncomingMessage;
  }): Promise<AiDecision>;
}

export interface AnalyticsSink {
  track(event: ChannelEvent): Promise<void>;
}

export interface AdapterRegistry {
  resolve(channel: ChannelConnection["channel"]): ChannelAdapter | null;
}

export type IncomingPipelineDeps = {
  ctx: AdapterContext;
  adapterRegistry: AdapterRegistry;
  connections: ConnectionRepository;
  conversations: ConversationRepository;
  leads: LeadRepository;
  events: EventRepository;
  ai: AiDecisionEngine;
  analytics: AnalyticsSink;
};

function makeEvent(params: {
  type: ChannelEvent["type"];
  workspaceId: string;
  channel: ChannelEvent["channel"];
  connectionId: string;
  payload: Record<string, unknown>;
  conversationId?: string;
  leadId?: string;
  nowIso: () => string;
}): ChannelEvent {
  return {
    id: `${params.type}:${Math.random().toString(36).slice(2, 10)}`,
    type: params.type,
    workspaceId: params.workspaceId,
    channel: params.channel,
    connectionId: params.connectionId,
    payload: params.payload,
    conversationId: params.conversationId,
    leadId: params.leadId,
    timestamp: params.nowIso()
  };
}

export async function processIncomingEvent(
  deps: IncomingPipelineDeps,
  args: { connectionId: string; rawEvent: unknown }
): Promise<{ handled: number }> {
  const connection = await deps.connections.getConnectionById(args.connectionId);
  if (!connection || connection.status !== "active") {
    deps.ctx.log("warn", "incoming_skipped_connection_not_active", { connectionId: args.connectionId });
    return { handled: 0 };
  }

  const adapter = deps.adapterRegistry.resolve(connection.channel);
  if (!adapter) {
    deps.ctx.log("error", "incoming_no_adapter", { channel: connection.channel, connectionId: connection.id });
    return { handled: 0 };
  }

  const incomingBatch = await adapter.ingestEvent(args.rawEvent, connection, deps.ctx);
  if (incomingBatch.length === 0) return { handled: 0 };

  let handled = 0;
  for (const incoming of incomingBatch) {
    const conversation = await deps.conversations.upsertFromIncoming(incoming, connection.workspaceId);
    const lead = await deps.leads.upsertFromConversation(conversation, incoming);

    const incomingEvent = makeEvent({
      type: "message_incoming",
      workspaceId: connection.workspaceId,
      channel: connection.channel,
      connectionId: connection.id,
      conversationId: conversation.id,
      leadId: lead.id,
      payload: { text: incoming.text, externalMessageId: incoming.externalMessageId },
      nowIso: deps.ctx.nowIso
    });
    await deps.events.save(incomingEvent);
    await deps.analytics.track(incomingEvent);

    const decision = await deps.ai.decide({ conversation, lead, incoming });

    if (typeof decision.scoreUpdate === "number") {
      await deps.leads.updateScore(lead.id, decision.scoreUpdate);
    }
    if (decision.stageUpdate && decision.stageUpdate !== lead.stage) {
      await deps.leads.updateStage(lead.id, decision.stageUpdate, decision.reason);
      const stageEvent = makeEvent({
        type: decision.stageUpdate === "interested" ? "lead_qualified" : "lead_stage_changed",
        workspaceId: connection.workspaceId,
        channel: connection.channel,
        connectionId: connection.id,
        conversationId: conversation.id,
        leadId: lead.id,
        payload: { from: lead.stage, to: decision.stageUpdate, reason: decision.reason || "" },
        nowIso: deps.ctx.nowIso
      });
      await deps.events.save(stageEvent);
      await deps.analytics.track(stageEvent);
    }

    if (decision.shouldReply && decision.replyText?.trim()) {
      const outgoing: OutgoingMessage = {
        id: `out:${Math.random().toString(36).slice(2, 10)}`,
        channel: connection.channel,
        connectionId: connection.id,
        conversationExternalId: incoming.conversationExternalId,
        recipientExternalId: incoming.senderExternalId,
        text: decision.replyText.trim(),
        replyToExternalMessageId: incoming.externalMessageId
      };

      const delivery = await adapter.sendMessage(outgoing, connection, deps.ctx);
      const eventType: ChannelEvent["type"] = delivery.ok ? "message_outgoing" : "delivery_failed";
      const deliveryEvent = makeEvent({
        type: eventType,
        workspaceId: connection.workspaceId,
        channel: connection.channel,
        connectionId: connection.id,
        conversationId: conversation.id,
        leadId: lead.id,
        payload: {
          text: outgoing.text,
          ok: delivery.ok,
          externalMessageId: delivery.externalMessageId || "",
          providerStatus: delivery.providerStatus || "",
          errorCode: delivery.errorCode || "",
          errorMessage: delivery.errorMessage || ""
        },
        nowIso: deps.ctx.nowIso
      });
      await deps.events.save(deliveryEvent);
      await deps.analytics.track(deliveryEvent);
    }

    handled += 1;
  }

  return { handled };
}
