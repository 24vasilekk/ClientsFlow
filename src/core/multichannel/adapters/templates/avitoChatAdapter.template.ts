import { GenericChannelAdapter } from "../../baseAdapter";
import type { OutgoingProviderPayload } from "../../adapter";
import type { AdapterContext, ChannelConnection, DeliveryResult, IncomingMessage, OutgoingMessage } from "../../types";

/**
 * Template: Avito chat adapter
 * Steps:
 * - map Avito inbound event to IncomingMessage
 * - map outbound reply payload
 * - add route `api/avito/index.ts` -> `/api/ingest/events`
 */
export class AvitoChatAdapterTemplate extends GenericChannelAdapter {
  readonly channel = "avito" as const;

  async validateConnection(connection: ChannelConnection): Promise<{ ok: boolean; details?: string }> {
    return { ok: Boolean(connection.credentialsRef), details: connection.credentialsRef ? undefined : "missing credentialsRef" };
  }

  async mapIncoming(_rawEvent: unknown, _connection: ChannelConnection, _ctx: AdapterContext): Promise<IncomingMessage[]> {
    return [];
  }

  async mapOutgoing(outgoing: OutgoingMessage, _connection: ChannelConnection, _ctx: AdapterContext): Promise<OutgoingProviderPayload> {
    return {
      endpoint: "https://api.avito.ru/messenger/v1/messages",
      body: { text: outgoing.text, chat_id: outgoing.conversationExternalId }
    };
  }

  async sendMessage(_outgoing: OutgoingMessage, _connection: ChannelConnection, _ctx: AdapterContext): Promise<DeliveryResult> {
    return { ok: false, errorCode: "not_implemented", errorMessage: "Template only" };
  }
}

