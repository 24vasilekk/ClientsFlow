import { GenericChannelAdapter } from "../../baseAdapter";
import type { OutgoingProviderPayload } from "../../adapter";
import type { AdapterContext, ChannelConnection, DeliveryResult, IncomingMessage, OutgoingMessage } from "../../types";

/**
 * Template: custom webhook source
 * Useful for any in-house CRM/webhook feed.
 */
export class CustomWebhookAdapterTemplate extends GenericChannelAdapter {
  readonly channel = "custom_webhook" as const;

  async validateConnection(connection: ChannelConnection): Promise<{ ok: boolean; details?: string }> {
    const outgoingEndpoint = String(connection.settings.custom?.outgoingEndpoint || "");
    return { ok: Boolean(outgoingEndpoint), details: outgoingEndpoint ? "endpoint configured" : "missing outgoingEndpoint" };
  }

  async mapIncoming(rawEvent: any, connection: ChannelConnection, _ctx: AdapterContext): Promise<IncomingMessage[]> {
    const event = rawEvent || {};
    return [
      {
        id: `custom:${event.id || Date.now()}`,
        channel: this.channel,
        connectionId: connection.id,
        externalEventId: String(event.eventId || event.id || ""),
        externalMessageId: String(event.messageId || event.id || ""),
        conversationExternalId: String(event.conversationId || event.chatId || ""),
        senderExternalId: String(event.senderId || ""),
        senderName: String(event.senderName || "Client"),
        text: String(event.text || ""),
        messageType: (event.messageType as IncomingMessage["messageType"]) || "text",
        attachments: Array.isArray(event.attachments) ? event.attachments : [],
        timestamp: typeof event.timestamp === "string" ? event.timestamp : new Date().toISOString(),
        raw: rawEvent
      }
    ];
  }

  async mapOutgoing(outgoing: OutgoingMessage, connection: ChannelConnection, _ctx: AdapterContext): Promise<OutgoingProviderPayload> {
    const endpoint = String(connection.settings.custom?.outgoingEndpoint || "");
    return {
      endpoint,
      body: {
        recipientId: outgoing.recipientExternalId,
        conversationId: outgoing.conversationExternalId,
        text: outgoing.text
      }
    };
  }

  async sendMessage(_outgoing: OutgoingMessage, _connection: ChannelConnection, _ctx: AdapterContext): Promise<DeliveryResult> {
    return { ok: false, errorCode: "not_implemented", errorMessage: "Template only" };
  }
}
