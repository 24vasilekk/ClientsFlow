import { readJsonSafe, supabaseRestOrThrow } from "../_db/supabase";
import { extractExternalEventId, normalizeIncomingEvent } from "./_normalizers";
import { syncFollowUpOnInbound } from "../followup/engine";
import { enqueueCrmHandoff, executeCrmHandoff } from "../crm/handoffEngine";
import { runAiDecision } from "../ai/pipeline";
import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace";
import { sendOutboundThroughRuntime } from "../channel-runtime/send";
import { resolveChannelCapabilities } from "../channel-connections/manager";
import { authErrorPayload, requireRequestContext } from "../_auth/session";
import { isInternalDispatchRequest } from "../_runtime/internal";
import { checkWorkspaceLimit, trackUsage } from "../billing/service";

declare const process: { env: Record<string, string | undefined> };

type AnyRecord = Record<string, any>;

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeChannel(value: unknown): string {
  const raw = asString(value).trim().toLowerCase();
  if (!raw) return "telegram";
  return raw;
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as AnyRecord).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function hash32(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0).toString(16);
}

function buildTraceId(req: any): string {
  const incoming = asString(req.headers?.["x-trace-id"] || req.body?.traceId).trim();
  return incoming || `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function inferLeadStage(rawEvent: AnyRecord, normalizedText: string): string {
  const explicit = asString(rawEvent?.stage || rawEvent?.status || rawEvent?.lead_stage).toLowerCase();
  if (explicit.includes("book") || explicit.includes("запис")) return "booked";
  if (explicit.includes("qual") || explicit.includes("заинтерес") || explicit.includes("интерес")) return "interested";
  if (explicit.includes("price") || explicit.includes("спросил цену")) return "asked_price";
  if (explicit.includes("lost") || explicit.includes("потер")) return "lost";
  if (/(цен|стоим|прайс|сколько)/i.test(normalizedText)) return "asked_price";
  return "new";
}

function isQualifiedStage(stage: string): boolean {
  return stage === "interested" || stage === "asked_price" || stage === "thinking" || stage === "booked";
}

function log(traceId: string, level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
  const payload = { traceId, message, ...(extra || {}) };
  if (level === "error") {
    console.error("[ingest/events]", payload);
    return;
  }
  if (level === "warn") {
    console.warn("[ingest/events]", payload);
    return;
  }
  console.log("[ingest/events]", payload);
}

function isTrue(value: unknown): boolean {
  const normalized = asString(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

async function getConversationHistory(args: { workspaceId: string; userId: string; conversationId: string }) {
  const response = await supabaseRestOrThrow(
    `messages?workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}&conversation_id=eq.${encodeURIComponent(args.conversationId)}&select=direction,content,sent_at&order=sent_at.asc&limit=20`
  );
  const rows = await readJsonSafe<Array<{ direction?: string; content?: string; sent_at?: string }>>(response);
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    role: row.direction === "inbound" ? ("client" as const) : ("ai" as const),
    text: asString(row.content || ""),
    at: asString(row.sent_at || "") || undefined
  }));
}

function extractBusinessProfile(connection: AnyRecord): string {
  const settings = connection?.settings && typeof connection.settings === "object" ? (connection.settings as AnyRecord) : {};
  const chunks = [
    asString(settings.businessProfile || settings.business_profile),
    asString(settings.businessContext || settings.business_context),
    asString(settings.companyDescription || settings.company_description),
    asString(connection?.display_name)
  ]
    .map((item) => item.trim())
    .filter(Boolean);
  return chunks.join("\n");
}

async function findConnection(args: {
  workspaceId: string;
  userId: string;
  channel: string;
  connectionId?: string;
}) {
  if (args.connectionId) {
    const byId = await supabaseRestOrThrow(
      `channel_connections?id=eq.${encodeURIComponent(args.connectionId)}&workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}&select=*`
    );
    const row = await readJsonSafe<AnyRecord[]>(byId);
    if (Array.isArray(row) && row[0]) return row[0];
  }
  const byScope = await supabaseRestOrThrow(
    `channel_connections?workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}&channel=eq.${encodeURIComponent(args.channel)}&select=*`
  );
  const rows = await readJsonSafe<AnyRecord[]>(byScope);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function insertIngestionEventIfNew(args: {
  id: string;
  traceId: string;
  workspaceId: string;
  userId: string;
  channel: string;
  connectionId: string;
  source: string;
  idempotencyKey: string;
  externalEventId: string;
  externalMessageId: string;
  eventType: string;
  rawPayload: unknown;
  normalizedPayload: unknown;
}): Promise<{ inserted: boolean; rowId?: string }> {
  const response = await supabaseRestOrThrow("ingestion_events?on_conflict=workspace_id,connection_id,idempotency_key", {
    method: "POST",
    headers: {
      Prefer: "resolution=ignore-duplicates,return=representation"
    },
    body: JSON.stringify([
      {
        id: args.id,
        trace_id: args.traceId,
        workspace_id: args.workspaceId,
        user_id: args.userId,
        channel: args.channel,
        connection_id: args.connectionId,
        source: args.source,
        idempotency_key: args.idempotencyKey,
        external_event_id: args.externalEventId || null,
        external_message_id: args.externalMessageId || null,
        event_type: args.eventType,
        status: "normalized",
        raw_payload: args.rawPayload,
        normalized_payload: args.normalizedPayload,
        received_at: nowIso(),
        processed_at: nowIso(),
        error_message: null
      }
    ])
  });
  const rows = await readJsonSafe<Array<{ id: string }>>(response);
  const inserted = Array.isArray(rows) && rows.length > 0;
  return { inserted, rowId: inserted ? String(rows[0]?.id || args.id) : undefined };
}

async function leadExists(workspaceId: string, userId: string, leadId: string): Promise<boolean> {
  const response = await supabaseRestOrThrow(
    `leads?id=eq.${encodeURIComponent(leadId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    {},
    "ingestion_lead_exists"
  );
  const rows = await readJsonSafe<Array<{ id?: string }>>(response);
  return Array.isArray(rows) && rows.length > 0;
}

export default async function handler(req: any, res: any) {
  const traceId = buildTraceId(req);
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", traceId });
    return;
  }

  const body = (req.body || {}) as AnyRecord;
  const channel = normalizeChannel(body.channel);
  const source = asString(body.source || "webhook");
  const connectionIdFromBody = asString(body.connectionId || "");
  const events = Array.isArray(body.events) ? body.events : [body.rawEvent ?? body.event ?? body.payload].filter(Boolean);

  if (events.length === 0) {
    res.status(400).json({ error: "events payload is empty", traceId });
    return;
  }

  try {
    const internalRequest = isInternalDispatchRequest(req);
    let workspaceId = "";
    let userId = "";
    if (internalRequest) {
      workspaceId = asString(body.workspaceId || req.query?.workspaceId).trim();
      userId = asString(body.userId || req.query?.userId).trim();
      if (!workspaceId || !userId) {
        res.status(400).json({ error: "workspaceId and userId are required for internal ingestion", traceId });
        return;
      }
    } else {
      const ctx = await requireRequestContext(req, "api/ingest/events");
      workspaceId = ctx.workspaceId;
      userId = ctx.userId;
    }
    log(traceId, "info", "ingestion_started", { workspaceId, userId, channel, source, events: events.length });
    await ensureWorkspaceAccess({ workspaceId, userId, traceId, allowAutoprovision: false });
    const connection = await findConnection({ workspaceId, userId, channel, connectionId: connectionIdFromBody });
    if (!connection) {
      res.status(404).json({ error: "channel connection not found", traceId });
      return;
    }
    const channelCapabilities = resolveChannelCapabilities(channel, connection.settings);
    if (!channelCapabilities.supportsInbound) {
      res.status(400).json({
        error: "inbound_not_supported_for_channel",
        traceId,
        channel,
        runStatus: "not_supported"
      });
      return;
    }

    let processed = 0;
    let duplicates = 0;
    const failed: Array<{ index: number; reason: string }> = [];
    const acceptedEventIds: string[] = [];

    for (let index = 0; index < events.length; index += 1) {
      const rawEvent = events[index];
      try {
        const externalEventId = extractExternalEventId(channel, rawEvent);
        const idempotencyBasis = `${connection.id}|${channel}|${externalEventId || ""}|${stableStringify(rawEvent)}`;
        const idempotencyKey = `evt_${hash32(idempotencyBasis)}`;

        const normalized = normalizeIncomingEvent(channel, rawEvent, connection.id);
        let leadStage = inferLeadStage(rawEvent as AnyRecord, normalized.text || "");

        const idempotencyWrite = await insertIngestionEventIfNew({
          id: normalized.id,
          traceId,
          workspaceId,
          userId,
          channel,
          connectionId: connection.id,
          source,
          idempotencyKey,
          externalEventId: externalEventId || "",
          externalMessageId: normalized.externalMessageId || "",
          eventType: normalized.messageType,
          rawPayload: rawEvent,
          normalizedPayload: normalized
        });

        if (!idempotencyWrite.inserted) {
          duplicates += 1;
          log(traceId, "info", "ingestion_idempotency_hit", {
            idempotencyKey,
            index,
            externalEventId: externalEventId || null,
            externalMessageId: normalized.externalMessageId || null
          });
          continue;
        }

        acceptedEventIds.push(normalized.id);
        log(traceId, "info", "ingestion_idempotency_miss_inserted", {
          idempotencyKey,
          index,
          ingestionEventId: idempotencyWrite.rowId || normalized.id,
          externalEventId: externalEventId || null,
          externalMessageId: normalized.externalMessageId || null
        });

        const leadId = `lead_${channel}_${normalized.conversationExternalId}`;
        const conversationId = `conv_${channel}_${normalized.conversationExternalId}`;

        const exists = await leadExists(workspaceId, userId, leadId);
        if (!exists) {
          const leadLimit = await checkWorkspaceLimit({ workspaceId, userId, metric: "leads", increment: 1 });
          if (!leadLimit.allowed) {
            throw new Error(`billing_limit_leads_exceeded:used=${leadLimit.used}:limit=${leadLimit.limit}`);
          }
        }

        const messageLimit = await checkWorkspaceLimit({ workspaceId, userId, metric: "messages", increment: 1 });
        if (!messageLimit.allowed) {
          throw new Error(`billing_limit_messages_exceeded:used=${messageLimit.used}:limit=${messageLimit.limit}`);
        }

        await supabaseRestOrThrow("leads?on_conflict=id", {
          method: "POST",
          body: JSON.stringify([
            {
              id: leadId,
              workspace_id: workspaceId,
              user_id: userId,
              conversation_id: conversationId,
              channel,
              external_lead_id: normalized.senderExternalId || normalized.conversationExternalId,
              name: normalized.senderName || "Клиент",
              stage: leadStage,
              source_label: channel,
              created_at: normalized.timestamp,
              updated_at: nowIso()
            }
          ])
        });
        if (!exists) {
          await trackUsage({
            workspaceId,
            userId,
            metric: "leads",
            occurredAt: normalized.timestamp
          });
        }

        await supabaseRestOrThrow("conversations?on_conflict=id", {
          method: "POST",
          body: JSON.stringify([
            {
              id: conversationId,
              workspace_id: workspaceId,
              user_id: userId,
              channel,
              connection_id: connection.id,
              external_conversation_id: normalized.conversationExternalId,
              lead_id: leadId,
              status: "active",
              last_message_at: normalized.timestamp,
              unread_count: 1,
              tags: [],
              updated_at: nowIso()
            }
          ])
        });

        await supabaseRestOrThrow("messages?on_conflict=id", {
          method: "POST",
          body: JSON.stringify([
            {
              id: `msg_in_${normalized.externalMessageId || normalized.id}`,
              workspace_id: workspaceId,
              user_id: userId,
              conversation_id: conversationId,
              lead_id: leadId,
              channel,
              direction: "inbound",
              content: normalized.text || "",
              metadata: {
                traceId,
                externalEventId: normalized.externalEventId || "",
                messageType: normalized.messageType || "text",
                systemEventType: normalized.systemEventType || null,
                attachments: normalized.attachments || []
              },
              sent_at: normalized.timestamp
            }
          ])
        });
        await trackUsage({
          workspaceId,
          userId,
          metric: "inbound_messages",
          occurredAt: normalized.timestamp
        });
        await trackUsage({
          workspaceId,
          userId,
          metric: "messages",
          occurredAt: normalized.timestamp
        });

        if (normalized.messageType !== "system" && channelCapabilities.supportsFollowUp) {
          await syncFollowUpOnInbound({
            workspaceId,
            userId,
            leadId,
            conversationId,
            channel,
            messageText: normalized.text || "",
            messageAt: normalized.timestamp,
            leadStage,
            traceId
          });
        } else if (normalized.messageType !== "system" && !channelCapabilities.supportsFollowUp) {
          log(traceId, "info", "follow_up_skipped_channel_partial_support", { channel, conversationId, leadId });
        }

        if (
          normalized.messageType === "text" &&
          channelCapabilities.supportsAutoReply &&
          String(process.env.AI_AUTO_REPLY_ENABLED || "true").toLowerCase() !== "false"
        ) {
          try {
            const history = await getConversationHistory({ workspaceId, userId, conversationId });
            const businessProfile = extractBusinessProfile(connection);
            const decision = await runAiDecision({
              traceId,
              workspaceId,
              userId,
              conversationId,
              leadId,
              channel,
              channelCapabilities,
              leadStage,
              businessProfile,
              lastUserMessage: normalized.text || "",
              conversationHistory: history
            });

            if (decision.qualificationUpdate?.stage) {
              leadStage = decision.qualificationUpdate.stage;
              await supabaseRestOrThrow(
                `leads?id=eq.${encodeURIComponent(leadId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}`,
                {
                method: "PATCH",
                body: JSON.stringify({
                  stage: decision.qualificationUpdate.stage,
                  updated_at: nowIso()
                })
                }
              );
            }

            if (decision.replyText && decision.nextAction !== "noop" && decision.nextAction !== "wait") {
              const sent = await sendOutboundThroughRuntime({
                workspaceId,
                userId,
                channel,
                conversationId,
                leadId,
                text: decision.replyText,
                traceId,
                source: "ai_decision_pipeline",
                messageIdPrefix: "msg_ai_out",
                metadata: {
                  confidence: decision.confidence,
                  nextAction: decision.nextAction,
                  qualificationUpdate: decision.qualificationUpdate,
                  followUpSuggestion: decision.followUpSuggestion,
                  provider: decision.provider,
                  model: decision.model
                }
              });
              if (!sent.ok) {
                log(traceId, "warn", "ai_reply_not_sent", {
                  channel,
                  conversationId,
                  status: sent.status,
                  errorCode: sent.errorCode,
                  errorMessage: sent.errorMessage
                });
              } else {
                await trackUsage({
                  workspaceId,
                  userId,
                  metric: "ai_replies",
                  occurredAt: new Date().toISOString()
                });
              }
            }
          } catch (error: any) {
            log(traceId, "error", "ai_reply_failed", { reason: error?.message || "unknown_error", conversationId });
          }
        } else if (normalized.messageType === "text" && !channelCapabilities.supportsAutoReply) {
          log(traceId, "info", "ai_reply_skipped_channel_partial_support", { channel, conversationId, leadId });
        }

        if (isQualifiedStage(leadStage) && channelCapabilities.supportsCrmHandoffTrigger) {
          const dedupKey = `crm:${leadId}:${leadStage}:${normalized.externalMessageId || normalized.id}`;
          const enqueue = await enqueueCrmHandoff({
            workspaceId,
            userId,
            leadId,
            conversationId,
            eventType: "lead.qualified",
            payload: {
              lead: {
                id: leadId,
                name: normalized.senderName || "Клиент",
                stage: leadStage,
                channel
              },
              message: {
                id: normalized.externalMessageId || normalized.id,
                text: normalized.text || "",
                timestamp: normalized.timestamp
              }
            },
            dedupKey,
            traceId
          });
          if (enqueue.enqueued && enqueue.handoffId) {
            if (isTrue(process.env.CRM_HANDOFF_INLINE_EXECUTION || "false")) {
              await executeCrmHandoff(enqueue.handoffId, traceId, { workspaceId, userId });
            } else {
              log(traceId, "info", "crm_handoff_enqueued_waiting_dispatch", {
                handoffId: enqueue.handoffId,
                leadId,
                conversationId
              });
            }
          } else if ((enqueue as AnyRecord).reason === "dedup_conflict") {
            log(traceId, "info", "crm_handoff_enqueue_dedup_conflict", {
              leadId,
              conversationId,
              channel,
              dedupKey,
              handoffId: (enqueue as AnyRecord).handoffId || null
            });
          }
        } else if (isQualifiedStage(leadStage) && !channelCapabilities.supportsCrmHandoffTrigger) {
          log(traceId, "info", "crm_handoff_skipped_channel_partial_support", { channel, conversationId, leadId });
        }

        processed += 1;
      } catch (error: any) {
        const reason = error?.message || "ingestion_event_failed";
        failed.push({ index, reason });
        log(traceId, "error", "ingestion_event_error", { index, reason });
        try {
          await supabaseRestOrThrow("ingestion_events", {
            method: "POST",
            body: JSON.stringify([
              {
                id: `evt_failed_${Date.now().toString(36)}_${index}`,
                trace_id: traceId,
                workspace_id: workspaceId,
                user_id: userId,
                channel,
                connection_id: connection.id,
                source,
                idempotency_key: `failed_${hash32(`${index}:${stableStringify(events[index])}`)}`,
                external_event_id: null,
                external_message_id: null,
                event_type: "system",
                status: "failed",
                raw_payload: events[index],
                normalized_payload: null,
                received_at: nowIso(),
                processed_at: nowIso(),
                error_message: reason
              }
            ])
          });
        } catch {
          // avoid masking primary error
        }
      }
    }

    log(traceId, "info", "ingestion_completed", { processed, duplicates, failed: failed.length });
    const billingLimited =
      failed.length > 0 &&
      failed.every((item) => asString(item.reason).includes("billing_limit_")) &&
      processed === 0;
    res.status(billingLimited ? 429 : 200).json({
      ok: !billingLimited,
      traceId,
      channel,
      connectionId: connection.id,
      processed,
      duplicates,
      failed,
      acceptedEventIds
    });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_")) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    if (error?.code?.startsWith?.("workspace_")) {
      const failure = workspaceAccessErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    log(traceId, "error", "ingestion_fatal_error", { reason: error?.message || "unknown_error" });
    res.status(500).json({ error: error?.message || "ingestion_failed", traceId });
  }
}
