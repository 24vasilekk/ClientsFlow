import { GenericChannelAdapter } from "../baseAdapter";
import type { OutgoingProviderPayload } from "../adapter";
import type {
  AdapterContext,
  ChannelConnection,
  DeliveryResult,
  IncomingMessage,
  OutgoingMessage
} from "../types";

type MetaWebhookEntry = {
  id?: string;
  messaging?: Array<{
    sender?: { id?: string };
    recipient?: { id?: string };
    timestamp?: number;
    message?: {
      mid?: string;
      text?: string;
      attachments?: Array<{
        type?: string;
        payload?: { url?: string };
      }>;
    };
    postback?: { title?: string; payload?: string };
  }>;
};

type MetaWebhookPayload = {
  object?: string;
  entry?: MetaWebhookEntry[];
};

function resolveDevToken(connection: ChannelConnection): string {
  const custom = connection.settings.custom || {};
  const fromCustom = typeof custom.devAccessToken === "string" ? custom.devAccessToken : "";
  return fromCustom.trim();
}

export class InstagramAdapter extends GenericChannelAdapter {
  readonly channel = "instagram" as const;

  async validateConnection(connection: ChannelConnection): Promise<{ ok: boolean; details?: string }> {
    const devToken = resolveDevToken(connection);
    if (!connection.credentialsRef.trim() && !devToken) {
      return { ok: false, details: "missing credentialsRef or devAccessToken" };
    }
    return { ok: true };
  }

  async mapIncoming(
    rawEvent: unknown,
    connection: ChannelConnection,
    _ctx: AdapterContext
  ): Promise<IncomingMessage[]> {
    const payload = rawEvent as MetaWebhookPayload;
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    const result: IncomingMessage[] = [];

    for (const entry of entries) {
      const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
      for (const item of messaging) {
        const message = item.message;
        const postback = item.postback;
        const senderId = String(item.sender?.id || "");
        const recipientId = String(item.recipient?.id || "");
        const externalMessageId = String(message?.mid || postback?.payload || `${item.timestamp || Date.now()}`);
        const text = String(message?.text || postback?.title || "").trim();
        const attachments = Array.isArray(message?.attachments)
          ? message.attachments.map((att, index) => {
              const type: "image" | "audio" | "file" = att.type === "image" ? "image" : att.type === "audio" ? "audio" : "file";
              return {
                id: `${externalMessageId}:a:${index}`,
                type,
                url: att.payload?.url
              };
            })
          : [];
        const messageType =
          postback
            ? ("system" as const)
            : attachments.some((att) => att.type === "image")
              ? ("image" as const)
              : attachments.some((att) => att.type === "audio")
                ? ("audio" as const)
                : attachments.length > 0
                  ? ("file" as const)
                  : ("text" as const);

        if (!senderId || !recipientId || !externalMessageId) continue;
        result.push({
          id: `instagram:${externalMessageId}`,
          channel: this.channel,
          connectionId: connection.id,
          externalEventId: externalMessageId,
          externalMessageId,
          conversationExternalId: senderId,
          senderExternalId: senderId,
          senderName: "Instagram user",
          text,
          messageType,
          systemEventType: postback ? "postback" : undefined,
          attachments,
          timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
          raw: item
        });
      }
    }

    return result;
  }

  async mapOutgoing(
    outgoing: OutgoingMessage,
    connection: ChannelConnection,
    _ctx: AdapterContext
  ): Promise<OutgoingProviderPayload> {
    const token = resolveDevToken(connection);
    const pageId = String(connection.settings.custom?.instagramPageId || "").trim();
    if (!token || !pageId) throw new Error("instagram_not_configured");
    return {
      endpoint: `https://graph.facebook.com/v20.0/${pageId}/messages`,
      body: {
        recipient: { id: outgoing.recipientExternalId },
        message: { text: outgoing.text },
        messaging_type: "RESPONSE",
        access_token: token
      }
    };
  }

  async sendMessage(
    outgoing: OutgoingMessage,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<DeliveryResult> {
    if (!outgoing.text.trim()) {
      return {
        ok: false,
        errorCode: "empty_text",
        errorMessage: "Outgoing text is empty"
      };
    }

    try {
      const mapped = await this.mapOutgoing(outgoing, connection, ctx);
      const response = await fetch(mapped.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapped.body)
      });
      const body = (await response.json().catch(() => ({}))) as { message_id?: string; error?: { message?: string } };
      if (!response.ok) {
        return {
          ok: false,
          errorCode: "instagram_send_failed",
          errorMessage: body?.error?.message || `status_${response.status}`
        };
      }
      return { ok: true, externalMessageId: body.message_id || "", providerStatus: "sent" };
    } catch (error: any) {
      if (String(error?.message || "").includes("instagram_not_configured")) {
        return {
          ok: false,
          errorCode: "instagram_not_configured",
          errorMessage: "Instagram adapter is configured in dev/prototype mode. TODO: wire production secret manager."
        };
      }
      return { ok: false, errorCode: "instagram_send_error", errorMessage: error?.message || "unknown_error" };
    }
  }
}
