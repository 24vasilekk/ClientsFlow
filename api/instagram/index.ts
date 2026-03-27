import { readJsonSafe, safeSupabaseCall } from "../_db/supabase";
import { connectConnection, markConnectionSync } from "../channel-connections/manager";
import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace";
import { authErrorPayload, requireRequestContext } from "../_auth/session";
import { buildInternalAuthHeaders } from "../_runtime/internal";
import { checkWorkspaceLimit, trackUsage } from "../billing/service";

declare const process: { env: Record<string, string | undefined> };

type AnyRecord = Record<string, any>;
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

async function upsertInstagramConnection(body: AnyRecord, workspaceId: string, userId: string, traceId: string) {
  await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  const pageId = asString(body.instagramPageId || body.pageId).trim();
  const accountId = asString(body.instagramAccountId || body.accountId).trim();
  const verifyToken = asString(body.verifyToken).trim();
  const accessToken = asString(body.accessToken).trim();

  if (!pageId && !accountId) {
    return { ok: false, error: "instagramPageId or instagramAccountId is required" };
  }

  const connect = await connectConnection({
    workspaceId,
    userId,
    channel: "instagram",
    channelType: "messaging",
    displayName: asString(body.displayName, "Instagram Direct"),
    endpointUrl: asString(body.webhookUrl, ""),
    accessToken,
    accountId,
    pageId,
    refreshMetadata: {
      verifyToken
    },
    settings: {
      custom: {
        instagramPageId: pageId,
        instagramAccountId: accountId,
        verifyToken,
        ...(accessToken ? { devAccessToken: accessToken } : {})
      }
    }
  });
  return { ok: connect.ok, connectionId: connect.connectionId, status: connect.status, healthStatus: connect.healthStatus, detail: connect.detail };
}

async function sendInstagramReply(body: AnyRecord, workspaceId: string, userId: string, traceId: string) {
  await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  const connectionId = asString(body.connectionId, `cc_${workspaceId}_${userId}_instagram`);
  const recipientId = asString(body.recipientId).trim();
  const text = asString(body.text).trim();
  if (!recipientId || !text) return { ok: false, error: "recipientId and text are required" };
  const limit = await checkWorkspaceLimit({ workspaceId, userId, metric: "messages", increment: 1 });
  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      error: "messages_limit_exceeded",
      errorCode: "limit_exceeded_messages",
      metric: "messages",
      used: limit.used,
      limit: limit.limit,
      planId: limit.planId,
      upgradeRequired: true
    };
  }

  const connectionResp = await safeSupabaseCall(
    `channel_connections?id=eq.${encodeURIComponent(connectionId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
    {},
    { traceId, context: "instagram_send_reply_load_connection" }
  );
  const rows = await readJsonSafe<AnyRecord[]>(connectionResp);
  const connection = Array.isArray(rows) ? rows[0] : null;
  const token = asString(connection?.access_token || connection?.settings?.custom?.devAccessToken).trim();
  const pageId = asString(connection?.settings?.custom?.instagramPageId).trim();
  if (!token || !pageId) {
    return {
      ok: false,
      error:
        "Instagram token/pageId is not configured. TODO: production secret manager integration; dev mode uses channel connection settings."
    };
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${pageId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
      access_token: token
    })
  });
  const result = (await response.json().catch(() => ({}))) as AnyRecord;

  await safeSupabaseCall(
    "messages?on_conflict=id",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: `msg_ig_out_${Date.now().toString(36)}`,
          workspace_id: workspaceId,
          user_id: userId,
          conversation_id: `conv_instagram_${recipientId}`,
          lead_id: `lead_instagram_${recipientId}`,
          channel: "instagram",
          direction: "outbound",
          content: text,
          metadata: {
            source: "api/instagram/send-reply",
            ok: response.ok,
            providerResult: result
          },
          sent_at: nowIso()
        }
      ])
    },
    { traceId, context: "instagram_send_reply_save_outbound" }
  );

  await markConnectionSync({
    connectionId,
    workspaceId,
    userId,
    ok: response.ok,
    errorMessage: response.ok ? "" : asString(result?.error?.message || `instagram_send_failed_${response.status}`),
    detail: "outgoing_reply"
  });

  if (!response.ok) return { ok: false, error: result?.error?.message || `instagram_send_failed_${response.status}` };
  await trackUsage({ workspaceId, userId, metric: "messages", occurredAt: nowIso() });
  return { ok: true, provider: result };
}

async function forwardToUnifiedIngestion(req: any, body: AnyRecord, workspaceId: string, userId: string, traceId: string) {
  await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  const requestedConnectionId = asString(body.connectionId || req.query?.connectionId, `cc_${workspaceId}_${userId}_instagram`);
  const connectionResp = await safeSupabaseCall(
    `channel_connections?id=eq.${encodeURIComponent(requestedConnectionId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    {},
    { traceId, context: "instagram_forward_load_connection" }
  );
  const connectionRows = await readJsonSafe<Array<{ id?: string }>>(connectionResp);
  const connectionId = asString(Array.isArray(connectionRows) ? connectionRows[0]?.id : "").trim();
  if (!connectionId) return { ok: false, error: "channel_connection_not_found" };

  const base =
    process.env.APP_BASE_URL ||
    (req.headers?.host ? `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}` : "");
  if (!base) {
    return {
      ok: false,
      error: "APP_BASE_URL is not set for webhook forwarding. TODO: configure APP_BASE_URL for production."
    };
  }

  const ingestionResp = await fetch(`${base}/api/ingest/events`, {
    method: "POST",
    headers: buildInternalAuthHeaders(asString(req.headers?.["x-trace-id"]) || ""),
    body: JSON.stringify({
      workspaceId,
      userId,
      channel: "instagram",
      connectionId,
      source: "instagram_webhook",
      events: body.entry ? [body] : Array.isArray(body.events) ? body.events : [body]
    })
  });
  const responseBody = await ingestionResp.json().catch(() => ({}));
  await markConnectionSync({
    connectionId,
    workspaceId,
    userId,
    ok: ingestionResp.ok,
    errorMessage: ingestionResp.ok ? "" : asString(responseBody?.error || `ingest_failed_${ingestionResp.status}`),
    detail: "webhook_ingest"
  });
  return { ok: ingestionResp.ok, status: ingestionResp.status, responseBody };
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    // Meta webhook verification handshake
    const mode = asString(req.query["hub.mode"]);
    const token = asString(req.query["hub.verify_token"]);
    const challenge = asString(req.query["hub.challenge"]);
    const expectedToken = asString(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN);
    if (mode === "subscribe" && expectedToken && token === expectedToken && challenge) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).json({ error: "verification_failed" });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (req.body || {}) as AnyRecord;
  const action = asString(body.action).toLowerCase();
  const traceId = asString(req.headers?.["x-trace-id"] || body.traceId, `trace_ig_${Date.now().toString(36)}`);

  try {
    const ctx = await requireRequestContext(req, "api/instagram");
    const workspaceId = ctx.workspaceId;
    const userId = ctx.userId;
    const role = ctx.role;
    if (action === "upsert-connection") {
      if (!canManageChannels(role)) {
        res.status(403).json({ error: "insufficient_role_for_channel_management", role, traceId });
        return;
      }
      const result = await upsertInstagramConnection(body, workspaceId, userId, traceId);
      const isLimit = !result.ok && asString(result.detail).includes("limit_exceeded_channels");
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
      const result = await sendInstagramReply(body, workspaceId, userId, traceId);
      const httpStatus = typeof result.status === "number" ? result.status : result.ok ? 200 : 400;
      res.status(httpStatus).json(result);
      return;
    }

    // default: webhook ingestion
    const forwarded = await forwardToUnifiedIngestion(req, body, workspaceId, userId, traceId);
    res.status(forwarded.ok ? 200 : 400).json(forwarded);
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
    res.status(500).json({ error: error?.message || "instagram_handler_error", traceId });
  }
}
