import { readJsonSafe, safeSupabaseCall } from "../_db/supabase";
import { connectConnection, markConnectionSync, upsertConnection } from "../channel-connections/manager";
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

function connectionStateFromStatus(status: string): "connected" | "error" | "needs_reauth" | "disabled" {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "disabled" || normalized === "disconnected") return "disabled";
  if (normalized === "needs_reauth") return "needs_reauth";
  if (normalized === "error") return "error";
  return "connected";
}

async function upsertVkConnection(body: AnyRecord, workspaceId: string, userId: string, traceId: string) {
  await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  const groupId = asString(body.groupId).trim();
  const accessToken = asString(body.accessToken).trim();
  const confirmationToken = asString(body.confirmationToken).trim();
  const status = asString(body.status, "active").trim() || "active";
  if (!groupId) return { ok: false, error: "groupId is required" };

  if (status === "disabled" || status === "disconnected") {
    const disabled = await upsertConnection(
      {
        workspaceId,
        userId,
        channel: "vk",
        channelType: "messaging",
        displayName: asString(body.displayName, "VK Messages"),
        endpointUrl: asString(body.webhookUrl, ""),
        accessToken,
        accountId: groupId,
        pageId: groupId,
        businessId: groupId,
        refreshMetadata: { confirmationToken },
        credentialsRef: accessToken ? "inline_dev_token" : "",
        settings: {
          custom: {
            vkGroupId: groupId,
            vkConfirmationToken: confirmationToken,
            ...(accessToken ? { devAccessToken: accessToken } : {})
          }
        }
      },
      "disabled"
    );
    return { ok: true, connectionId: disabled.connectionId, connectionState: "disabled" as const };
  }

  const connect = await connectConnection({
    workspaceId,
    userId,
    channel: "vk",
    channelType: "messaging",
    displayName: asString(body.displayName, "VK Messages"),
    endpointUrl: asString(body.webhookUrl, ""),
    accessToken,
    accountId: groupId,
    pageId: groupId,
    refreshMetadata: { confirmationToken },
    credentialsRef: accessToken ? "inline_dev_token" : "",
    settings: {
      custom: {
        vkGroupId: groupId,
        vkConfirmationToken: confirmationToken,
        ...(accessToken ? { devAccessToken: accessToken } : {})
      }
    }
  });
  return { ok: connect.ok, connectionId: connect.connectionId, connectionState: connect.ok ? "connected" : connectionStateFromStatus(connect.status), detail: connect.detail };
}

async function sendVkReply(body: AnyRecord, workspaceId: string, userId: string, traceId: string) {
  await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  const connectionId = asString(body.connectionId, `cc_${workspaceId}_${userId}_vk`);
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
    { traceId, context: "vk_send_reply_load_connection" }
  );
  const rows = await readJsonSafe<AnyRecord[]>(connectionResp);
  const connection = Array.isArray(rows) ? rows[0] : null;
  const token = asString(connection?.access_token || connection?.settings?.custom?.devAccessToken).trim();
  if (!token) {
    return {
      ok: false,
      error: "VK token not configured. TODO: use production secret manager; dev prototype reads token from connection metadata."
    };
  }

  const params = new URLSearchParams({
    peer_id: recipientId,
    random_id: String(Math.floor(Math.random() * 1_000_000_000)),
    message: text,
    access_token: token,
    v: "5.199"
  });
  const response = await fetch(`https://api.vk.com/method/messages.send?${params.toString()}`, { method: "POST" });
  const result = (await response.json().catch(() => ({}))) as AnyRecord;

  await safeSupabaseCall(
    "messages?on_conflict=id",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: `msg_vk_out_${Date.now().toString(36)}`,
          workspace_id: workspaceId,
          user_id: userId,
          conversation_id: `conv_vk_${recipientId}`,
          lead_id: `lead_vk_${recipientId}`,
          channel: "vk",
          direction: "outbound",
          content: text,
          metadata: { source: "api/vk/send-reply", ok: response.ok, providerResult: result },
          sent_at: nowIso()
        }
      ])
    },
    { traceId, context: "vk_send_reply_save_outbound" }
  );

  await markConnectionSync({
    connectionId,
    workspaceId,
    userId,
    ok: response.ok && !result?.error,
    errorMessage: response.ok && !result?.error ? "" : asString(result?.error?.error_msg || `vk_send_failed_${response.status}`),
    detail: "outgoing_reply"
  });

  if (!response.ok || result?.error) {
    return { ok: false, error: result?.error?.error_msg || `vk_send_failed_${response.status}` };
  }
  await trackUsage({ workspaceId, userId, metric: "messages", occurredAt: nowIso() });
  return { ok: true, provider: result };
}

async function forwardToUnifiedIngestion(req: any, body: AnyRecord, workspaceId: string, userId: string, traceId: string) {
  await ensureWorkspaceAccess({ workspaceId, userId, traceId });
  const requestedConnectionId = asString(body.connectionId || req.query?.connectionId, `cc_${workspaceId}_${userId}_vk`);
  const connectionResp = await safeSupabaseCall(
    `channel_connections?id=eq.${encodeURIComponent(requestedConnectionId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
    {},
    { traceId, context: "vk_forward_load_connection" }
  );
  const connectionRows = await readJsonSafe<Array<{ id?: string }>>(connectionResp);
  const connectionId = asString(Array.isArray(connectionRows) ? connectionRows[0]?.id : "").trim();
  if (!connectionId) return { ok: false, error: "channel_connection_not_found" };
  const base =
    process.env.APP_BASE_URL ||
    (req.headers?.host ? `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}` : "");
  if (!base) {
    return { ok: false, error: "APP_BASE_URL is not set. TODO: set APP_BASE_URL for webhook forwarding." };
  }
  const events = Array.isArray(body.events) ? body.events : [body.event || body.payload || body].filter(Boolean);
  const ingestionResp = await fetch(`${base}/api/ingest/events`, {
    method: "POST",
    headers: buildInternalAuthHeaders(asString(req.headers?.["x-trace-id"]) || ""),
    body: JSON.stringify({
      workspaceId,
      userId,
      channel: "vk",
      connectionId,
      source: body.action === "ingest-longpoll" ? "vk_longpoll" : "vk_webhook",
      events
    })
  });
  const responseBody = await ingestionResp.json().catch(() => ({}));
  await markConnectionSync({
    connectionId,
    workspaceId,
    userId,
    ok: ingestionResp.ok,
    errorMessage: ingestionResp.ok ? "" : asString(responseBody?.error || `ingest_failed_${ingestionResp.status}`),
    detail: body.action === "ingest-longpoll" ? "longpoll_ingest" : "webhook_ingest"
  });
  return { ok: ingestionResp.ok, status: ingestionResp.status, responseBody };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const body = (req.body || {}) as AnyRecord;
  const action = asString(body.action).toLowerCase();
  const traceId = asString(req.headers?.["x-trace-id"] || body.traceId, `trace_vk_${Date.now().toString(36)}`);
  try {
    const ctx = await requireRequestContext(req, "api/vk");
    const workspaceId = ctx.workspaceId;
    const userId = ctx.userId;
    const role = ctx.role;
    if (action === "upsert-connection") {
      if (!canManageChannels(role)) {
        res.status(403).json({ error: "insufficient_role_for_channel_management", role, traceId });
        return;
      }
      const result = await upsertVkConnection(body, workspaceId, userId, traceId);
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
      const result = await sendVkReply(body, workspaceId, userId, traceId);
      const httpStatus = typeof result.status === "number" ? result.status : result.ok ? 200 : 400;
      res.status(httpStatus).json(result);
      return;
    }

    // VK webhook confirmation flow
    if (asString(body.type) === "confirmation") {
      const connectionId = asString(body.connectionId || req.query?.connectionId, `cc_${workspaceId}_${userId}_vk`);
      const connectionResp = await safeSupabaseCall(
        `channel_connections?id=eq.${encodeURIComponent(connectionId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
        {},
        { traceId, context: "vk_confirmation_load_connection" }
      );
      const rows = await readJsonSafe<AnyRecord[]>(connectionResp);
      const connection = Array.isArray(rows) ? rows[0] : null;
      const token = asString(connection?.settings?.custom?.vkConfirmationToken || process.env.VK_CONFIRMATION_TOKEN);
      if (!token) {
        res.status(400).json({ error: "vk_confirmation_token_missing" });
        return;
      }
      res.status(200).send(token);
      return;
    }

    // default ingestion (webhook + long-poll compatible)
    const forwarded = await forwardToUnifiedIngestion(req, body, workspaceId, userId, traceId);
    if (forwarded.ok) {
      // VK callback API expects "ok" plain text for webhook delivery acknowledgement.
      if (asString(body.type)) {
        res.status(200).send("ok");
        return;
      }
      res.status(200).json(forwarded);
      return;
    }
    res.status(400).json(forwarded);
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
    console.error("[vk/index] handler_error", { message: error?.message || "unknown_error" });
    res.status(500).json({ error: error?.message || "vk_handler_error", traceId });
  }
}
