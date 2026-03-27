declare const process: { env: Record<string, string | undefined> };
import { connectConnection, disableConnection, markConnectionSync, reconnectConnection, validateConnectionById } from "../channel-connections/manager.js";
import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";
import { checkWorkspaceLimit, trackUsage } from "../billing/service.js";
type WorkspaceRole = "owner" | "admin" | "member";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    from?: { id: number; is_bot: boolean; first_name?: string; username?: string };
    chat?: { id: number; type: string; title?: string; username?: string; first_name?: string };
  };
};

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTelegramWithRetry(url: string, init: RequestInit, attempts = 3, timeoutMs = 10000): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === attempts) {
        return response;
      }
      console.warn("[telegram/index] retry_status", { status: response.status, attempt });
    } catch (error: any) {
      lastError = error;
      const logTag = error?.name === "AbortError" ? "retry_timeout" : "retry_network_error";
      console.warn(`[telegram/index] ${logTag}`, { attempt, message: error?.message || "unknown_error" });
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timer);
    }
    await wait(250 * 2 ** (attempt - 1));
  }
  throw lastError || new Error("telegram_request_failed");
}

async function handleGetUpdates(req: any, res: any) {
  const botToken = req.body?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    res.status(400).json({ error: "Telegram bot token is missing" });
    return;
  }

  const offset = Number(req.body?.offset ?? 0);
  const traceId = String(req.headers?.["x-trace-id"] || `trace_tg_${Date.now().toString(36)}`);
  const workspaceId = String(req.body?.workspaceId || "");
  const userId = String(req.body?.userId || "");
  let connectionId = "";
  try {
    connectionId = `cc_${workspaceId}_${userId}_telegram`;
    const response = await fetchTelegramWithRetry(`https://api.telegram.org/bot${botToken}/getUpdates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offset,
        timeout: 0,
        allowed_updates: ["message"]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok !== true) {
      console.error("[telegram/index] get_updates_api_error", { status: response.status, error: data?.description || "unknown_error" });
      res.status(400).json({ error: data?.description || "Telegram getUpdates failed", traceId });
      return;
    }

    const updates: TelegramUpdate[] = Array.isArray(data.result) ? data.result : [];
    await markConnectionSync({ connectionId, workspaceId, userId, ok: true, detail: "get_updates" });
    res.status(200).json({ updates });
  } catch (error: any) {
    console.error("[telegram/index] get_updates_handler_error", { message: error?.message || "unknown_error" });
    await markConnectionSync({ connectionId, workspaceId, userId, ok: false, errorMessage: error?.message || "telegram_get_updates_failed", detail: "get_updates" });
    res.status(500).json({ error: error?.message || "Telegram getUpdates error", traceId });
  }
}

function canManageChannels(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

async function handleSendMessage(req: any, res: any) {
  const botToken = req.body?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = req.body?.chatId;
  const text = req.body?.text;
  if (!botToken || !chatId || !text) {
    res.status(400).json({ error: "botToken, chatId and text are required" });
    return;
  }

  const traceId = String(req.headers?.["x-trace-id"] || `trace_tg_${Date.now().toString(36)}`);
  const workspaceId = String(req.body?.workspaceId || "");
  const userId = String(req.body?.userId || "");
  let connectionId = "";
  try {
    const limit = await checkWorkspaceLimit({
      workspaceId: String(req.authCtx?.workspaceId || workspaceId),
      userId: String(req.authCtx?.userId || userId),
      metric: "messages",
      increment: 1
    });
    if (!limit.allowed) {
      res.status(429).json({
        error: "messages_limit_exceeded",
        errorCode: "limit_exceeded_messages",
        metric: "messages",
        used: limit.used,
        limit: limit.limit,
        planId: limit.planId,
        upgradeRequired: true
      });
      return;
    }
    connectionId = `cc_${workspaceId}_${userId}_telegram`;
    const response = await fetchTelegramWithRetry(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok !== true) {
      console.error("[telegram/index] send_message_api_error", {
        status: response.status,
        chatId: String(chatId),
        error: data?.description || "unknown_error"
      });
      await markConnectionSync({ connectionId, workspaceId, userId, ok: false, errorMessage: data?.description || "telegram_send_failed", detail: "send_message" });
      res.status(400).json({ error: data?.description || "Telegram sendMessage failed", traceId });
      return;
    }
    await trackUsage({
      workspaceId: String(req.authCtx?.workspaceId || workspaceId),
      userId: String(req.authCtx?.userId || userId),
      metric: "messages",
      occurredAt: new Date().toISOString()
    });
    await markConnectionSync({ connectionId, workspaceId, userId, ok: true, detail: "send_message" });
    res.status(200).json({ ok: true, result: data.result });
  } catch (error: any) {
    console.error("[telegram/index] send_message_handler_error", { message: error?.message || "unknown_error", chatId: String(chatId) });
    await markConnectionSync({ connectionId, workspaceId, userId, ok: false, errorMessage: error?.message || "telegram_send_failed", detail: "send_message" });
    res.status(500).json({ error: error?.message || "Telegram sendMessage error", traceId });
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const action = String(req.body?.action || "").toLowerCase();
  const traceId = String(req.headers?.["x-trace-id"] || `trace_tg_${Date.now().toString(36)}`);
  let workspaceId = "";
  let userId = "";
  let role: WorkspaceRole = "member";
  try {
    const ctx = await requireRequestContext(req, "api/telegram");
    workspaceId = ctx.workspaceId;
    userId = ctx.userId;
    role = ctx.role;
    req.authCtx = ctx;
    await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_")) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    const failure = workspaceAccessErrorPayload(error, traceId);
    res.status(failure.status).json(failure.body);
    return;
  }
  if (action === "connect") {
    if (!canManageChannels(role)) {
      res.status(403).json({ error: "insufficient_role_for_channel_management", role, traceId });
      return;
    }
    const result = await connectConnection({
      workspaceId,
      userId,
      channel: "telegram",
      channelType: "messaging",
      displayName: String(req.body?.displayName || "Telegram Bot"),
      botToken: String(req.body?.botToken || ""),
      accessToken: String(req.body?.accessToken || ""),
      accountId: String(req.body?.accountId || ""),
      pageId: String(req.body?.pageId || ""),
      businessId: String(req.body?.businessId || ""),
      refreshMetadata: req.body?.refreshMetadata && typeof req.body.refreshMetadata === "object" ? req.body.refreshMetadata : {},
      settings: req.body?.settings && typeof req.body.settings === "object" ? req.body.settings : {}
    });
    const isLimit = !result.ok && String(result.detail || "").includes("limit_exceeded_channels");
    res.status(result.ok ? 200 : isLimit ? 429 : 400).json(
      isLimit
        ? {
            ...result,
            error: "channels_limit_exceeded",
            errorCode: "limit_exceeded_channels",
            upgradeRequired: true
          }
        : result
    );
    return;
  }
  if (action === "validate") {
    if (!canManageChannels(role)) {
      res.status(403).json({ error: "insufficient_role_for_channel_management", role, traceId });
      return;
    }
    const connectionId = String(req.body?.connectionId || "");
    if (!connectionId) {
      res.status(400).json({ error: "connectionId is required" });
      return;
    }
    const result = await validateConnectionById(connectionId, { workspaceId, userId });
    res.status(result.ok ? 200 : 400).json(result);
    return;
  }
  if (action === "reconnect") {
    if (!canManageChannels(role)) {
      res.status(403).json({ error: "insufficient_role_for_channel_management", role, traceId });
      return;
    }
    const result = await reconnectConnection({
      connectionId: String(req.body?.connectionId || ""),
      workspaceId,
      userId,
      channel: "telegram",
      botToken: String(req.body?.botToken || ""),
      accessToken: String(req.body?.accessToken || "")
    });
    res.status(result.ok ? 200 : 400).json(result);
    return;
  }
  if (action === "disable") {
    if (!canManageChannels(role)) {
      res.status(403).json({ error: "insufficient_role_for_channel_management", role, traceId });
      return;
    }
    const result = await disableConnection({
      connectionId: String(req.body?.connectionId || ""),
      workspaceId,
      userId,
      channel: "telegram"
    });
    res.status(result.ok ? 200 : 400).json(result);
    return;
  }
  if (action === "send-message") {
    await handleSendMessage(req, res);
    return;
  }
  await handleGetUpdates(req, res);
}
