import { readJsonSafe, safeSupabaseCall } from "../_db/supabase";
import { markConnectionSync, resolveChannelCapabilities, validateConnectionById } from "../channel-connections/manager";
import { checkWorkspaceLimit, trackUsage } from "../billing/service";

type AnyRecord = Record<string, any>;

type SendStatus = "sent" | "incomplete" | "not_supported" | "failed";

export type SendPipelineResult = {
  ok: boolean;
  status: SendStatus;
  connectionId?: string;
  externalMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
};

type SendPipelineInput = {
  workspaceId: string;
  userId: string;
  channel: string;
  conversationId: string;
  leadId: string;
  text: string;
  traceId: string;
  source: string;
  metadata?: Record<string, unknown>;
  messageIdPrefix?: string;
};

type AdapterSendOutcome =
  | { kind: "sent"; externalMessageId?: string }
  | { kind: "not_supported"; errorCode: string; errorMessage: string }
  | { kind: "incomplete"; errorCode: string; errorMessage: string };

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normChannel(value: unknown): string {
  return asString(value).trim().toLowerCase() || "telegram";
}

function normalizeConnectionStatus(value: unknown): "connected" | "connecting" | "validating" | "needs_reauth" | "error" | "disabled" {
  const raw = asString(value).trim().toLowerCase();
  if (raw === "connected" || raw === "active") return "connected";
  if (raw === "connecting") return "connecting";
  if (raw === "validating") return "validating";
  if (raw === "needs_reauth") return "needs_reauth";
  if (raw === "error") return "error";
  if (raw === "disabled" || raw === "disconnected") return "disabled";
  return "connected";
}

function log(traceId: string, level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
  const payload = { traceId, message, ...(extra || {}) };
  if (level === "error") {
    console.error("[channel-runtime/send]", payload);
    return;
  }
  if (level === "warn") {
    console.warn("[channel-runtime/send]", payload);
    return;
  }
  console.log("[channel-runtime/send]", payload);
}

async function sendTelegram(args: { botToken: string; chatId: string; text: string }) {
  const response = await fetch(`https://api.telegram.org/bot${args.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: args.chatId, text: args.text, disable_web_page_preview: true })
  });
  const body = await response.json().catch(() => ({} as AnyRecord));
  if (!response.ok || body?.ok !== true) {
    throw new Error(asString(body?.description) || `telegram_send_failed_${response.status}`);
  }
  return { externalMessageId: asString(body?.result?.message_id) };
}

async function sendInstagram(args: { pageId: string; accessToken: string; recipientId: string; text: string }) {
  const response = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(args.pageId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: args.recipientId },
      message: { text: args.text },
      messaging_type: "RESPONSE",
      access_token: args.accessToken
    })
  });
  const body = await response.json().catch(() => ({} as AnyRecord));
  if (!response.ok || body?.error) {
    throw new Error(asString(body?.error?.message) || `instagram_send_failed_${response.status}`);
  }
  return { externalMessageId: asString(body?.message_id || body?.id || "") };
}

async function sendVk(args: { accessToken: string; peerId: string; text: string }) {
  const params = new URLSearchParams({
    peer_id: args.peerId,
    random_id: String(Math.floor(Math.random() * 1_000_000_000)),
    message: args.text,
    access_token: args.accessToken,
    v: "5.199"
  });
  const response = await fetch(`https://api.vk.com/method/messages.send?${params.toString()}`, { method: "POST" });
  const body = await response.json().catch(() => ({} as AnyRecord));
  if (!response.ok || body?.error) {
    throw new Error(asString(body?.error?.error_msg) || `vk_send_failed_${response.status}`);
  }
  return { externalMessageId: asString(body?.response) };
}

async function sendCustomWebhookCallback(args: {
  callbackUrl: string;
  authHeader?: string;
  authValue?: string;
  conversationId: string;
  leadId: string;
  text: string;
  traceId: string;
}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Trace-Id": args.traceId };
  const authHeader = asString(args.authHeader, "Authorization").trim();
  const authValue = asString(args.authValue).trim();
  if (authHeader && authValue) headers[authHeader] = authValue;

  const response = await fetch(args.callbackUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      conversationId: args.conversationId,
      leadId: args.leadId,
      text: args.text,
      channel: "custom_webhook",
      sentAt: nowIso(),
      metadata: { source: "channel_runtime_send" }
    })
  });
  const body = await response.json().catch(() => ({} as AnyRecord));
  if (!response.ok) {
    throw new Error(asString(body?.error) || `custom_webhook_callback_failed_${response.status}`);
  }
  return { externalMessageId: asString(body?.messageId || body?.id || "") };
}

async function sendWithAdapter(args: {
  channel: string;
  connection: AnyRecord;
  conversationExternalId: string;
  leadId: string;
  text: string;
  traceId: string;
  workspaceId: string;
  userId: string;
  connectionId: string;
}): Promise<AdapterSendOutcome> {
  if (args.channel === "telegram") {
    const botToken = asString(args.connection?.bot_token).trim();
    if (!botToken) {
      return { kind: "incomplete", errorCode: "missing_bot_token", errorMessage: "Telegram bot token is not configured." };
    }
    const sent = await sendTelegram({ botToken, chatId: args.conversationExternalId, text: args.text });
    return { kind: "sent", externalMessageId: sent.externalMessageId };
  }

  if (args.channel === "custom_webhook") {
    const settings = args.connection?.settings && typeof args.connection.settings === "object" ? (args.connection.settings as AnyRecord) : {};
    const customWebhook = settings.customWebhook && typeof settings.customWebhook === "object" ? (settings.customWebhook as AnyRecord) : {};
    const replyMode = asString(customWebhook.replyMode || "manual_only").toLowerCase();
    const callbackUrl = asString(customWebhook.replyCallbackUrl).trim();
    if (replyMode !== "callback") {
      return {
        kind: "not_supported",
        errorCode: "custom_webhook_manual_only",
        errorMessage: "custom_webhook reply mode is manual_only."
      };
    }
    if (!callbackUrl) {
      return {
        kind: "incomplete",
        errorCode: "missing_reply_callback_url",
        errorMessage: "custom_webhook callback URL is missing."
      };
    }
    const sent = await sendCustomWebhookCallback({
      callbackUrl,
      authHeader: asString(customWebhook.replyAuthHeader || "Authorization"),
      authValue: asString(customWebhook.replyAuthValue || ""),
      conversationId: args.conversationExternalId,
      leadId: args.leadId,
      text: args.text,
      traceId: args.traceId
    });
    return { kind: "sent", externalMessageId: sent.externalMessageId };
  }

  if (args.channel === "instagram") {
    const settings = args.connection?.settings && typeof args.connection.settings === "object" ? (args.connection.settings as AnyRecord) : {};
    const custom = settings.custom && typeof settings.custom === "object" ? (settings.custom as AnyRecord) : {};
    const pageId = asString(args.connection?.page_id || custom.instagramPageId).trim();
    const token = asString(args.connection?.access_token || custom.devAccessToken).trim();
    if (!pageId || !token) {
      return {
        kind: "incomplete",
        errorCode: "instagram_missing_token_or_page_id",
        errorMessage: "Instagram connection is missing access token or page id."
      };
    }
    const sent = await sendInstagram({
      pageId,
      accessToken: token,
      recipientId: args.conversationExternalId,
      text: args.text
    });
    return { kind: "sent", externalMessageId: sent.externalMessageId };
  }

  if (args.channel === "vk") {
    const settings = args.connection?.settings && typeof args.connection.settings === "object" ? (args.connection.settings as AnyRecord) : {};
    const custom = settings.custom && typeof settings.custom === "object" ? (settings.custom as AnyRecord) : {};
    const token = asString(args.connection?.access_token || custom.devAccessToken).trim();
    if (!token) {
      return {
        kind: "incomplete",
        errorCode: "vk_missing_access_token",
        errorMessage: "VK connection is missing access token."
      };
    }
    const sent = await sendVk({
      accessToken: token,
      peerId: args.conversationExternalId,
      text: args.text
    });
    return { kind: "sent", externalMessageId: sent.externalMessageId };
  }

  return {
    kind: "not_supported",
    errorCode: "channel_not_supported",
    errorMessage: `Channel ${args.channel} is not supported by unified runtime yet.`
  };
}

async function findConnection(args: { workspaceId: string; userId: string; channel: string }) {
  const response = await safeSupabaseCall(
    `channel_connections?workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}&channel=eq.${encodeURIComponent(args.channel)}&select=*&order=updated_at.desc&limit=1`,
    {},
    { context: "channel_runtime_find_connection" }
  );
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findConversation(args: { conversationId: string; workspaceId: string; userId: string }) {
  const response = await safeSupabaseCall(
    `conversations?id=eq.${encodeURIComponent(args.conversationId)}&workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}&select=*`,
    {},
    { context: "channel_runtime_find_conversation" }
  );
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function saveOutbound(args: {
  id: string;
  workspaceId: string;
  userId: string;
  conversationId: string;
  leadId: string;
  channel: string;
  text: string;
  metadata: AnyRecord;
}) {
  await safeSupabaseCall(
    "messages?on_conflict=id",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: args.id,
          workspace_id: args.workspaceId,
          user_id: args.userId,
          conversation_id: args.conversationId,
          lead_id: args.leadId,
          channel: args.channel,
          direction: "outbound",
          content: args.text,
          metadata: args.metadata,
          sent_at: nowIso()
        }
      ])
    },
    { context: "channel_runtime_save_outbound" }
  );
}

export async function sendOutboundThroughRuntime(input: SendPipelineInput): Promise<SendPipelineResult> {
  const workspaceId = asString(input.workspaceId).trim();
  const userId = asString(input.userId).trim();
  const channel = normChannel(input.channel);
  const conversationId = asString(input.conversationId).trim();
  const leadId = asString(input.leadId).trim();
  const text = asString(input.text).trim();
  const traceId = asString(input.traceId).trim() || `trace_send_${Date.now().toString(36)}`;
  const source = asString(input.source).trim() || "runtime_send";

  if (!workspaceId || !userId || !conversationId || !leadId || !text) {
    return { ok: false, status: "incomplete", errorCode: "missing_required_fields", errorMessage: "workspaceId/userId/conversationId/leadId/text are required" };
  }

  const connection = await findConnection({ workspaceId, userId, channel });
  if (!connection) {
    log(traceId, "warn", "send_incomplete_missing_connection", { workspaceId, userId, channel });
    return { ok: false, status: "incomplete", errorCode: "missing_connection", errorMessage: `Connection for channel ${channel} is not configured.` };
  }

  const connectionId = asString(connection.id);
  const connectionStatus = normalizeConnectionStatus(connection.status);
  if (connectionStatus === "disabled") {
    return {
      ok: false,
      status: "incomplete",
      connectionId,
      errorCode: "connection_disabled",
      errorMessage: `Connection for channel ${channel} is disabled.`
    };
  }

  if (connectionStatus === "error" || connectionStatus === "needs_reauth") {
    const validation = await validateConnectionById(connectionId, { workspaceId, userId });
    if (!validation.ok) {
      return {
        ok: false,
        status: validation.runStatus === "not_supported" ? "not_supported" : "incomplete",
        connectionId,
        errorCode: "connection_validation_failed",
        errorMessage: asString(validation.detail, "Channel connection validation failed.")
      };
    }
  }

  const capabilities = resolveChannelCapabilities(channel, connection.settings);
  if (!capabilities.supportsOutbound) {
    await markConnectionSync({
      connectionId,
      workspaceId,
      userId,
      ok: true,
      detail: "runtime_send_skipped_outbound_not_supported"
    });
    return {
      ok: false,
      status: "not_supported",
      connectionId,
      errorCode: "outbound_not_supported",
      errorMessage: `Channel ${channel} does not support outbound messaging in current runtime.`
    };
  }
  const conversation = await findConversation({ conversationId, workspaceId, userId });
  const externalConversationId = asString(conversation?.external_conversation_id);
  if (!externalConversationId) {
    await markConnectionSync({ connectionId, workspaceId, userId, ok: false, errorMessage: "missing_external_conversation_id", detail: "runtime_send" });
    return { ok: false, status: "incomplete", connectionId, errorCode: "missing_external_conversation_id", errorMessage: "Conversation has no external id." };
  }

  const messageLimit = await checkWorkspaceLimit({ workspaceId, userId, metric: "messages", increment: 1 });
  if (!messageLimit.allowed) {
    return {
      ok: false,
      status: "incomplete",
      connectionId,
      errorCode: "billing_limit_messages_exceeded",
      errorMessage: `Messages limit exceeded (${messageLimit.used}/${messageLimit.limit}).`
    };
  }

  try {
    const adapterResult = await sendWithAdapter({
      channel,
      connection,
      conversationExternalId: externalConversationId,
      leadId,
      text,
      traceId,
      workspaceId,
      userId,
      connectionId
    });
    if (adapterResult.kind !== "sent") {
      await markConnectionSync({
        connectionId,
        workspaceId,
        userId,
        ok: adapterResult.kind === "not_supported",
        errorMessage: adapterResult.kind === "incomplete" ? adapterResult.errorCode : undefined,
        detail: `runtime_send_${adapterResult.kind}`
      });
      return {
        ok: false,
        status: adapterResult.kind === "not_supported" ? "not_supported" : "incomplete",
        connectionId,
        errorCode: adapterResult.errorCode,
        errorMessage: adapterResult.errorMessage
      };
    }
    const externalMessageId = asString(adapterResult.externalMessageId);

    const messageId = `${asString(input.messageIdPrefix, "msg_out")}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await saveOutbound({
      id: messageId,
      workspaceId,
      userId,
      conversationId,
      leadId,
      channel,
      text,
      metadata: {
        traceId,
        source,
        externalMessageId,
        ...(input.metadata || {})
      }
    });
    await trackUsage({
      workspaceId,
      userId,
      metric: "messages",
      occurredAt: new Date().toISOString()
    });
    await markConnectionSync({ connectionId, workspaceId, userId, ok: true, detail: "runtime_send" });
    return { ok: true, status: "sent", connectionId, externalMessageId };
  } catch (error: any) {
    const message = asString(error?.message) || "runtime_send_failed";
    await markConnectionSync({ connectionId, workspaceId, userId, ok: false, errorMessage: message, detail: "runtime_send" });
    log(traceId, "error", "send_failed", { channel, connectionId, message });
    return { ok: false, status: "failed", connectionId, errorCode: "provider_send_failed", errorMessage: message };
  }
}
