import { GenericChannelAdapter } from "../baseAdapter";
import type { OutgoingProviderPayload } from "../adapter";
import type {
  AdapterContext,
  ChannelConnection,
  DeliveryResult,
  IncomingMessage,
  OutgoingMessage
} from "../types";

type VkMessageNewEvent = {
  type?: string;
  object?: {
    message?: {
      id?: number;
      date?: number;
      from_id?: number;
      peer_id?: number;
      text?: string;
      attachments?: Array<{
        type?: string;
        photo?: { sizes?: Array<{ url?: string }> };
        audio_message?: { link_ogg?: string; link_mp3?: string };
        doc?: { url?: string; title?: string; ext?: string; size?: number };
      }>;
    };
  };
};

function resolveVkToken(connection: ChannelConnection): string {
  const custom = connection.settings.custom || {};
  const fromCustom = typeof custom.devAccessToken === "string" ? custom.devAccessToken : "";
  return fromCustom.trim() || connection.credentialsRef.trim();
}

export class VkAdapter extends GenericChannelAdapter {
  readonly channel = "vk" as const;

  async validateConnection(connection: ChannelConnection): Promise<{ ok: boolean; details?: string }> {
    if (!resolveVkToken(connection)) {
      return { ok: false, details: "missing credentialsRef or devAccessToken" };
    }
    return { ok: true };
  }

  async mapIncoming(
    rawEvent: unknown,
    connection: ChannelConnection,
    _ctx: AdapterContext
  ): Promise<IncomingMessage[]> {
    const payload = rawEvent as VkMessageNewEvent;
    if (payload?.type !== "message_new" || !payload.object?.message) return [];

    const message = payload.object.message;
    const attachments = Array.isArray(message.attachments)
      ? message.attachments.map((att, index) => {
          if (att.type === "photo") {
            const last = Array.isArray(att.photo?.sizes) ? att.photo?.sizes?.[att.photo.sizes.length - 1] : null;
            return { id: `vk:${message.id}:a:${index}`, type: "image" as const, url: last?.url };
          }
          if (att.type === "audio_message") {
            return {
              id: `vk:${message.id}:a:${index}`,
              type: "audio" as const,
              url: att.audio_message?.link_mp3 || att.audio_message?.link_ogg
            };
          }
          return {
            id: `vk:${message.id}:a:${index}`,
            type: "file" as const,
            url: att.doc?.url,
            name: att.doc?.title,
            mimeType: att.doc?.ext ? `application/${att.doc.ext}` : undefined,
            sizeBytes: att.doc?.size
          };
        })
      : [];

    const messageType: IncomingMessage["messageType"] =
      attachments.some((att) => att.type === "image")
        ? "image"
        : attachments.some((att) => att.type === "audio")
          ? "voice"
          : attachments.length > 0
            ? "file"
            : "text";

    return [
      {
        id: `vk:${message.id || Date.now()}`,
        channel: this.channel,
        connectionId: connection.id,
        externalEventId: `vk_evt_${message.id || Date.now()}`,
        externalMessageId: String(message.id || ""),
        conversationExternalId: String(message.peer_id || ""),
        senderExternalId: String(message.from_id || ""),
        senderName: "VK user",
        text: String(message.text || "").trim(),
        messageType,
        attachments,
        timestamp: message.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
        raw: payload
      }
    ];
  }

  async mapOutgoing(
    outgoing: OutgoingMessage,
    connection: ChannelConnection,
    _ctx: AdapterContext
  ): Promise<OutgoingProviderPayload> {
    const token = resolveVkToken(connection);
    if (!token) throw new Error("vk_not_configured");
    const params = new URLSearchParams({
      peer_id: outgoing.recipientExternalId,
      random_id: String(Math.floor(Math.random() * 1_000_000_000)),
      message: outgoing.text,
      access_token: token,
      v: "5.199"
    });
    return {
      endpoint: `https://api.vk.com/method/messages.send?${params.toString()}`,
      body: {}
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
      const response = await fetch(mapped.endpoint, { method: "POST" });
      const body = (await response.json().catch(() => ({}))) as {
        response?: number;
        error?: { error_code?: number; error_msg?: string };
      };
      if (!response.ok || body?.error) {
        return {
          ok: false,
          errorCode: body?.error?.error_code ? String(body.error.error_code) : "vk_send_failed",
          errorMessage: body?.error?.error_msg || `status_${response.status}`
        };
      }
      return { ok: true, externalMessageId: String(body.response || ""), providerStatus: "sent" };
    } catch (error: any) {
      if (String(error?.message || "").includes("vk_not_configured")) {
        return {
          ok: false,
          errorCode: "vk_not_configured",
          errorMessage: "VK token is missing. TODO: use production secret manager for real deployment."
        };
      }
      return { ok: false, errorCode: "vk_send_error", errorMessage: error?.message || "unknown_error" };
    }
  }
}
