import { GenericChannelAdapter } from "../baseAdapter";
import type { OutgoingProviderPayload } from "../adapter";
import type {
  AdapterContext,
  ChannelConnection,
  DeliveryResult,
  IncomingMessage,
  OutgoingMessage
} from "../types";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    date?: number;
    text?: string;
    from?: { id?: number; first_name?: string; username?: string };
    chat?: { id?: number };
  };
};

export class TelegramAdapter extends GenericChannelAdapter {
  readonly channel = "telegram" as const;

  async validateConnection(connection: ChannelConnection): Promise<{ ok: boolean; details?: string }> {
    const custom = connection.settings.custom || {};
    const tokenFromCustom = typeof custom.devAccessToken === "string" ? custom.devAccessToken.trim() : "";
    if (!connection.credentialsRef.trim() && !tokenFromCustom) {
      return { ok: false, details: "credentialsRef/devAccessToken is empty" };
    }
    return { ok: true };
  }

  async mapIncoming(
    rawEvent: unknown,
    connection: ChannelConnection,
    _ctx: AdapterContext
  ): Promise<IncomingMessage[]> {
    const updates = Array.isArray(rawEvent) ? rawEvent : [rawEvent];
    const normalized: IncomingMessage[] = [];

    for (const item of updates) {
      const update = item as TelegramUpdate;
      const message = update.message;
      const chatId = message?.chat?.id;
      const senderId = message?.from?.id;
      if (!chatId || !senderId) continue;

      normalized.push({
        id: `telegram:${update.update_id || message?.message_id || Date.now()}`,
        channel: this.channel,
        connectionId: connection.id,
        externalMessageId: String(message?.message_id || update.update_id || ""),
        conversationExternalId: String(chatId),
        senderExternalId: String(senderId),
        senderName: message?.from?.first_name || message?.from?.username || "Telegram User",
        text: String(message?.text || "").trim(),
        timestamp: message?.date ? new Date(message.date * 1000).toISOString() : new Date().toISOString(),
        raw: item
      });
    }

    return normalized;
  }

  async mapOutgoing(
    outgoing: OutgoingMessage,
    connection: ChannelConnection,
    _ctx: AdapterContext
  ): Promise<OutgoingProviderPayload> {
    const custom = connection.settings.custom || {};
    const tokenFromCustom = typeof custom.devAccessToken === "string" ? custom.devAccessToken.trim() : "";
    const token = tokenFromCustom || connection.credentialsRef.trim();
    if (!token) throw new Error("telegram_token_missing");
    return {
      endpoint: `https://api.telegram.org/bot${token}/sendMessage`,
      body: {
        chat_id: outgoing.recipientExternalId,
        text: outgoing.text,
        disable_web_page_preview: true
      }
    };
  }

  async sendMessage(
    outgoing: OutgoingMessage,
    connection: ChannelConnection,
    ctx: AdapterContext
  ): Promise<DeliveryResult> {
    if (!outgoing.text.trim()) {
      return { ok: false, errorCode: "empty_text", errorMessage: "Outgoing text is empty" };
    }
    try {
      const mapped = await this.mapOutgoing(outgoing, connection, ctx);
      const response = await fetch(mapped.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapped.body)
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id?: number }; description?: string };
      if (!response.ok || body.ok !== true) {
        return {
          ok: false,
          errorCode: "telegram_send_failed",
          errorMessage: body?.description || `status_${response.status}`
        };
      }
      return {
        ok: true,
        providerStatus: "sent",
        externalMessageId: body.result?.message_id ? String(body.result.message_id) : ""
      };
    } catch (error: any) {
      return { ok: false, errorCode: "telegram_send_error", errorMessage: error?.message || "unknown_error" };
    };
  }
}
