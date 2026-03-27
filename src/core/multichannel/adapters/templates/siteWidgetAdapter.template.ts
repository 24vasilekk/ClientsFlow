import { GenericChannelAdapter } from "../../baseAdapter";
import type { OutgoingProviderPayload } from "../../adapter";
import type { AdapterContext, ChannelConnection, DeliveryResult, IncomingMessage, OutgoingMessage } from "../../types";

/**
 * Template: site widget source
 * Intended for web chat widget embedded in client site.
 */
export class SiteWidgetAdapterTemplate extends GenericChannelAdapter {
  readonly channel = "site_widget" as const;

  async validateConnection(connection: ChannelConnection): Promise<{ ok: boolean; details?: string }> {
    const widgetKey = String(connection.settings.custom?.widgetKey || "");
    return { ok: Boolean(widgetKey), details: widgetKey ? undefined : "missing widgetKey" };
  }

  async mapIncoming(rawEvent: any, connection: ChannelConnection, _ctx: AdapterContext): Promise<IncomingMessage[]> {
    const e = rawEvent || {};
    return [
      {
        id: `site_widget:${e.id || Date.now()}`,
        channel: this.channel,
        connectionId: connection.id,
        externalEventId: String(e.eventId || e.id || ""),
        externalMessageId: String(e.messageId || e.id || ""),
        conversationExternalId: String(e.sessionId || e.conversationId || ""),
        senderExternalId: String(e.visitorId || e.senderId || ""),
        senderName: String(e.visitorName || "Website visitor"),
        text: String(e.text || ""),
        messageType: "text",
        attachments: [],
        timestamp: typeof e.timestamp === "string" ? e.timestamp : new Date().toISOString(),
        raw: rawEvent
      }
    ];
  }

  async mapOutgoing(outgoing: OutgoingMessage, connection: ChannelConnection, _ctx: AdapterContext): Promise<OutgoingProviderPayload> {
    const widgetEndpoint = String(connection.settings.custom?.widgetEndpoint || "");
    return {
      endpoint: widgetEndpoint,
      body: {
        sessionId: outgoing.conversationExternalId,
        text: outgoing.text
      }
    };
  }

  async sendMessage(_outgoing: OutgoingMessage, _connection: ChannelConnection, _ctx: AdapterContext): Promise<DeliveryResult> {
    return { ok: false, errorCode: "not_implemented", errorMessage: "Template only" };
  }
}

