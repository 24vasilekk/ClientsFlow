import { readJsonSafe, safeSupabaseCall } from "../_db/supabase.js";
import { connectConnection, markConnectionSync } from "../channel-connections/manager.js";
import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";
import { buildInternalAuthHeaders } from "../_runtime/internal.js";
import { checkWorkspaceLimit, trackUsage } from "../billing/service.js";

declare const process: { env: Record<string, string | undefined> };

type AnyRecord = Record<string, any>;
type AuthMode = "none" | "token" | "signature";
type ReplyMode = "callback" | "manual_only";
type WorkspaceRole = "owner" | "admin" | "member";

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function canManageChannels(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const s = String(value ?? "").trim();
    if (s) return s;
  }
  return "";
}

function toIso(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const ts = new Date(value).getTime();
    if (Number.isFinite(ts)) return new Date(ts).toISOString();
  }
  return new Date().toISOString();
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as AnyRecord).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const keyData = encoder.encode(secret);

  if (typeof crypto !== "undefined" && crypto?.subtle) {
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, data);
    return Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let h = 2166136261;
  for (let i = 0; i < message.length; i += 1) {
    h ^= message.charCodeAt(i) ^ secret.charCodeAt(i % Math.max(1, secret.length));
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return `fallback_${(h >>> 0).toString(16)}`;
}

async function loadConnection(args: { connectionId: string; workspaceId: string; userId: string }): Promise<AnyRecord | null> {
  const response = await safeSupabaseCall(
    `channel_connections?id=eq.${encodeURIComponent(args.connectionId)}&workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}&select=*`,
    {},
    { context: "custom_webhook_load_connection" }
  );
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

function parseWebhookSettings(connection: AnyRecord) {
  const settings = connection?.settings && typeof connection.settings === "object" ? (connection.settings as AnyRecord) : {};
  const custom = settings.customWebhook && typeof settings.customWebhook === "object" ? (settings.customWebhook as AnyRecord) : {};
  return {
    authMode: (asString(custom.authMode || "token").toLowerCase() || "token") as AuthMode,
    authToken: asString(custom.authToken || ""),
    signatureHeader: asString(custom.signatureHeader || "x-cflow-signature").toLowerCase(),
    timestampHeader: asString(custom.timestampHeader || "x-cflow-timestamp").toLowerCase(),
    replyMode: (asString(custom.replyMode || "manual_only").toLowerCase() || "manual_only") as ReplyMode,
    replyCallbackUrl: asString(custom.replyCallbackUrl || ""),
    replyAuthHeader: asString(custom.replyAuthHeader || "Authorization"),
    replyAuthValue: asString(custom.replyAuthValue || ""),
    parsePath: asString(custom.parsePath || "")
  };
}

function pickFromPath(root: unknown, path: string): unknown {
  if (!path.trim()) return root;
  const parts = path.split(".").map((item) => item.trim()).filter(Boolean);
  let current: unknown = root;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as AnyRecord)) {
      current = (current as AnyRecord)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function mapIncomingPayload(payload: AnyRecord, fallbackConversationId: string): AnyRecord {
  const message = payload?.message && typeof payload.message === "object" ? (payload.message as AnyRecord) : payload;
  const attachmentsRaw = Array.isArray(message.attachments) ? message.attachments : [];
  const attachments = attachmentsRaw.map((item: any, index: number) => ({
    id: firstNonEmpty(item?.id, `att_${index}`),
    type: item?.type === "image" || item?.type === "audio" || item?.type === "voice" || item?.type === "file" ? item.type : "file",
    url: asString(item?.url),
    mimeType: asString(item?.mimeType || item?.mime_type),
    name: asString(item?.name),
    sizeBytes: typeof item?.sizeBytes === "number" ? item.sizeBytes : typeof item?.size === "number" ? item.size : undefined
  }));

  const typeRaw = asString(message.messageType || message.type || "text").toLowerCase();
  const messageType =
    typeRaw === "image" || typeRaw === "audio" || typeRaw === "voice" || typeRaw === "file" || typeRaw === "system"
      ? typeRaw
      : attachments.some((item: AnyRecord) => item.type === "image")
        ? "image"
        : attachments.some((item: AnyRecord) => item.type === "audio")
          ? "audio"
          : attachments.length > 0
            ? "file"
            : "text";

  return {
    event_id: firstNonEmpty(payload.event_id, payload.id, message.id, Date.now().toString(36)),
    message_id: firstNonEmpty(message.id, payload.message_id, payload.id, Date.now().toString(36)),
    conversation_id: firstNonEmpty(message.conversationId, message.chatId, message.threadId, payload.conversation_id, fallbackConversationId),
    sender_id: firstNonEmpty(message.senderId, message.fromId, payload.sender_id, payload.from_id, "unknown_sender"),
    sender_name: firstNonEmpty(message.senderName, payload.sender_name, payload.from_name),
    text: asString(message.text || message.body || payload.text || ""),
    message_type: messageType,
    system_event_type: messageType === "system" ? firstNonEmpty(message.systemEventType, payload.system_event_type, payload.event_type) : undefined,
    attachments,
    timestamp: toIso(message.timestamp || payload.timestamp || payload.created_at || payload.date)
  };
}

async function verifyAuth(req: any, connection: AnyRecord, payload: AnyRecord): Promise<{ ok: boolean; reason?: string }> {
  const settings = parseWebhookSettings(connection);
  if (settings.authMode === "none") return { ok: true };

  const authToken = settings.authToken;
  if (!authToken) return { ok: false, reason: "custom_webhook_auth_token_missing" };

  if (settings.authMode === "token") {
    const presented = firstNonEmpty(
      req.headers?.["x-webhook-token"],
      req.headers?.authorization ? String(req.headers.authorization).replace(/^Bearer\s+/i, "") : "",
      req.query?.token,
      payload?.authToken
    );
    if (presented !== authToken) return { ok: false, reason: "custom_webhook_token_invalid" };
    return { ok: true };
  }

  const signatureHeaderValue = asString(req.headers?.[settings.signatureHeader] || req.headers?.["x-cflow-signature"]).trim();
  const timestampHeaderValue = asString(req.headers?.[settings.timestampHeader] || req.headers?.["x-cflow-timestamp"]).trim();
  if (!signatureHeaderValue) return { ok: false, reason: "custom_webhook_signature_missing" };

  const canonical = stableStringify(payload);
  const signedPayload = timestampHeaderValue ? `${timestampHeaderValue}.${canonical}` : canonical;
  const expected = await hmacSha256Hex(signedPayload, authToken);
  const normalizedSignature = signatureHeaderValue.replace(/^sha256=/i, "").toLowerCase();
  if (normalizedSignature !== expected.toLowerCase()) return { ok: false, reason: "custom_webhook_signature_invalid" };
  return { ok: true };
}

async function forwardToIngestion(args: { req: any; workspaceId: string; userId: string; connectionId: string; event: AnyRecord }) {
  const base =
    process.env.APP_BASE_URL ||
    (args.req.headers?.host ? `${args.req.headers["x-forwarded-proto"] || "https"}://${args.req.headers.host}` : "");
  if (!base) return { ok: false, status: 500, body: { error: "APP_BASE_URL is not set" } };

  const response = await fetch(`${base}/api/ingest/events`, {
    method: "POST",
    headers: buildInternalAuthHeaders(asString(args.req.headers?.["x-trace-id"] || "")),
    body: JSON.stringify({
      workspaceId: args.workspaceId,
      userId: args.userId,
      channel: "custom_webhook",
      connectionId: args.connectionId,
      source: "custom_webhook",
      events: [args.event]
    })
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

async function handleConnect(body: AnyRecord, workspaceId: string, userId: string, traceId: string) {
  await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  const accountId = asString(body.accountId || body.channelAccountId || body.sourceId).trim();
  const pageId = asString(body.pageId || body.roomId || body.inboxId).trim();
  const businessId = asString(body.businessId || body.projectId).trim();

  return connectConnection({
    workspaceId,
    userId,
    channel: "custom_webhook",
    channelType: "custom_webhook",
    displayName: asString(body.displayName || "Custom Webhook"),
    endpointUrl: asString(body.endpointUrl || ""),
    accessToken: asString(body.accessToken || ""),
    accountId,
    pageId,
    businessId,
    refreshMetadata: body.refreshMetadata && typeof body.refreshMetadata === "object" ? body.refreshMetadata : {},
    settings: {
      customWebhook: {
        authMode: asString(body.authMode || "token").toLowerCase(),
        authToken: asString(body.authToken || ""),
        signatureHeader: asString(body.signatureHeader || "x-cflow-signature"),
        timestampHeader: asString(body.timestampHeader || "x-cflow-timestamp"),
        parsePath: asString(body.parsePath || ""),
        replyMode: asString(body.replyMode || "manual_only").toLowerCase(),
        replyCallbackUrl: asString(body.replyCallbackUrl || ""),
        replyAuthHeader: asString(body.replyAuthHeader || "Authorization"),
        replyAuthValue: asString(body.replyAuthValue || "")
      }
    },
    credentialsRef: asString(body.credentialsRef || "")
  });
}

async function handleInbound(req: any, body: AnyRecord, workspaceId: string, userId: string, traceId: string) {
  await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  const connectionId = asString(req.query?.connectionId || body.connectionId || `cc_${workspaceId}_${userId}_custom_webhook`).trim();

  const connection = await loadConnection({ connectionId, workspaceId, userId });
  if (!connection) return { ok: false, status: 404, body: { error: "custom_webhook_connection_not_found" } };

  const auth = await verifyAuth(req, connection, body);
  if (!auth.ok) {
    await markConnectionSync({ connectionId, workspaceId, userId, ok: false, errorMessage: auth.reason || "auth_failed", detail: "inbound_auth" });
    return { ok: false, status: 401, body: { error: auth.reason || "custom_webhook_auth_failed" } };
  }

  const settings = parseWebhookSettings(connection);
  const payloadRoot = pickFromPath(body, settings.parsePath);
  const payload = payloadRoot && typeof payloadRoot === "object" ? (payloadRoot as AnyRecord) : body;
  const mapped = mapIncomingPayload(payload, asString(connection.page_id || connection.account_id || "custom_conversation"));

  const ingest = await forwardToIngestion({ req, workspaceId, userId, connectionId, event: mapped });
  await markConnectionSync({
    connectionId,
    workspaceId,
    userId,
    ok: ingest.ok,
    errorMessage: ingest.ok ? "" : asString(ingest.body?.error || `ingest_failed_${ingest.status}`),
    detail: "inbound_ingest"
  });
  return ingest;
}

async function sendReply(body: AnyRecord, workspaceId: string, userId: string, traceId: string) {
  await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  const connectionId = asString(body.connectionId || `cc_${workspaceId}_${userId}_custom_webhook`).trim();
  const conversationId = asString(body.conversationId || body.threadId || body.chatId).trim();
  const leadId = asString(body.leadId || `lead_custom_${conversationId || Date.now().toString(36)}`);
  const text = asString(body.text).trim();

  if (!text) return { ok: false, status: 400, body: { error: "text is required" } };
  if (!conversationId) return { ok: false, status: 400, body: { error: "conversationId is required" } };
  const limit = await checkWorkspaceLimit({ workspaceId, userId, metric: "messages", increment: 1 });
  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "messages_limit_exceeded",
        errorCode: "limit_exceeded_messages",
        metric: "messages",
        used: limit.used,
        limit: limit.limit,
        planId: limit.planId,
        upgradeRequired: true
      }
    };
  }

  const connection = await loadConnection({ connectionId, workspaceId, userId });
  if (!connection) return { ok: false, status: 404, body: { error: "custom_webhook_connection_not_found" } };

  const settings = parseWebhookSettings(connection);
  if (settings.replyMode !== "callback") {
    await markConnectionSync({ connectionId, workspaceId, userId, ok: true, detail: "manual_only_reply" });
    return {
      ok: false,
      status: 200,
      body: { ok: false, status: "manual_only", message: "Reply mode is manual_only. Ответ нужно отправить вручную во внешней системе." }
    };
  }

  const callbackUrl = asString(body.callbackUrl || settings.replyCallbackUrl).trim();
  if (!callbackUrl) {
    await markConnectionSync({ connectionId, workspaceId, userId, ok: false, errorMessage: "missing_reply_callback_url", detail: "reply_callback" });
    return { ok: false, status: 400, body: { error: "replyCallbackUrl is not configured" } };
  }

  const callbackPayload = {
    conversationId,
    leadId,
    text,
    channel: "custom_webhook",
    sentAt: nowIso(),
    metadata: { source: "cflow_custom_webhook_adapter" }
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.replyAuthHeader && settings.replyAuthValue) headers[settings.replyAuthHeader] = settings.replyAuthValue;

  const response = await fetch(callbackUrl, { method: "POST", headers, body: JSON.stringify(callbackPayload) });
  const callbackResult = await response.json().catch(() => ({}));

  await safeSupabaseCall(
    "messages?on_conflict=id",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: `msg_custom_out_${Date.now().toString(36)}`,
          workspace_id: workspaceId,
          user_id: userId,
          conversation_id: `conv_custom_webhook_${conversationId}`,
          lead_id: leadId,
          channel: "custom_webhook",
          direction: "outbound",
          content: text,
          metadata: { source: "custom_webhook_callback", callbackUrl, ok: response.ok, providerResult: callbackResult },
          sent_at: nowIso()
        }
      ])
    },
    { traceId, context: "custom_webhook_send_reply_save_outbound" }
  );
  await trackUsage({ workspaceId, userId, metric: "messages", occurredAt: nowIso() });

  await markConnectionSync({
    connectionId,
    workspaceId,
    userId,
    ok: response.ok,
    errorMessage: response.ok ? "" : asString(callbackResult?.error || `callback_http_${response.status}`),
    detail: "reply_callback"
  });

  if (!response.ok) return { ok: false, status: 400, body: { error: asString(callbackResult?.error || `callback_failed_${response.status}`), provider: callbackResult } };
  return { ok: true, status: 200, body: { ok: true, provider: callbackResult } };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (req.body || {}) as AnyRecord;
  const action = asString(body.action).toLowerCase();
  const traceId = asString(req.headers?.["x-trace-id"] || body.traceId, `trace_cw_${Date.now().toString(36)}`);

  try {
    const ctx = await requireRequestContext(req, "api/custom-webhook");
    const workspaceId = ctx.workspaceId;
    const userId = ctx.userId;
    const role = ctx.role;
    if (action === "connect" || action === "upsert-connection") {
      if (!canManageChannels(role)) {
        res.status(403).json({ error: "insufficient_role_for_channel_management", role, traceId });
        return;
      }
      const result = await handleConnect(body, workspaceId, userId, traceId);
      const isLimit = !result.ok && asString((result as AnyRecord).detail).includes("limit_exceeded_channels");
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
    if (action === "send-reply") {
      const reply = await sendReply(body, workspaceId, userId, traceId);
      res.status(reply.status).json(reply.body);
      return;
    }
    const inbound = await handleInbound(req, body, workspaceId, userId, traceId);
    res.status(inbound.status).json(inbound.body);
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_")) {
      const authTraceId = asString(req.headers?.["x-trace-id"] || req.body?.traceId, `trace_cw_${Date.now().toString(36)}`);
      const failure = authErrorPayload(error, authTraceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    if (error?.code?.startsWith?.("workspace_")) {
      const failure = workspaceAccessErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    res.status(500).json({ error: error?.message || "custom_webhook_handler_failed", traceId });
  }
}
