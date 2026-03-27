import {
  connectConnection,
  disableConnection,
  listConnections,
  reconnectConnection,
  validateConnectionById
} from "./manager";
import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace";
import { authErrorPayload, requireRequestContext } from "../_auth/session";

type AnyRecord = Record<string, any>;
type WorkspaceRole = "owner" | "admin" | "member";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function canManageChannels(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_channel_manager_${Date.now().toString(36)}`;
    try {
      const authCtx = await requireRequestContext(req, "api/channel-connections:get");
      const workspaceId = authCtx.workspaceId;
      const userId = authCtx.userId;
      await ensureWorkspaceAccess({ workspaceId, userId, traceId });
      const rows = await listConnections({ workspaceId, userId });
      res.status(200).json({ ok: true, items: rows });
      return;
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
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (req.body || {}) as AnyRecord;
  const action = asString(body.action).toLowerCase();
  const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_channel_manager_${Date.now().toString(36)}`;
  let workspaceId = "";
  let userId = "";
  let role: WorkspaceRole = "member";

  try {
    const authCtx = await requireRequestContext(req, "api/channel-connections:post");
    workspaceId = authCtx.workspaceId;
    userId = authCtx.userId;
    role = authCtx.role;
    await ensureWorkspaceAccess({
      workspaceId,
      userId,
      traceId
    });
    const channelManagementAction = ["connect", "validate", "reconnect", "disable", "health-check"].includes(action);
    if (channelManagementAction && !canManageChannels(role)) {
      res.status(403).json({ error: "insufficient_role_for_channel_management", role, traceId });
      return;
    }
    if (action === "connect") {
      const result = await connectConnection({
        workspaceId,
        userId,
        channel: asString(body.channel).trim().toLowerCase(),
        channelType: asString(body.channelType || "messaging"),
        displayName: asString(body.displayName),
        endpointUrl: asString(body.endpointUrl),
        accessToken: asString(body.accessToken),
        botToken: asString(body.botToken),
        accountId: asString(body.accountId),
        pageId: asString(body.pageId),
        businessId: asString(body.businessId),
        refreshMetadata: body.refreshMetadata && typeof body.refreshMetadata === "object" ? body.refreshMetadata : {},
        settings: body.settings && typeof body.settings === "object" ? body.settings : {},
        credentialsRef: asString(body.credentialsRef)
      });
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

    if (action === "validate") {
      const connectionId = asString(body.connectionId).trim();
      if (!connectionId) {
        res.status(400).json({ error: "connectionId is required", traceId });
        return;
      }
      const result = await validateConnectionById(connectionId, { workspaceId, userId });
      res.status(result.ok ? 200 : 400).json(result);
      return;
    }

    if (action === "reconnect") {
      const result = await reconnectConnection({
        connectionId: asString(body.connectionId),
        workspaceId,
        userId,
        channel: asString(body.channel),
        accessToken: asString(body.accessToken),
        botToken: asString(body.botToken)
      });
      res.status(result.ok ? 200 : 400).json(result);
      return;
    }

    if (action === "disable") {
      const result = await disableConnection({
        connectionId: asString(body.connectionId),
        workspaceId,
        userId,
        channel: asString(body.channel)
      });
      res.status(result.ok ? 200 : 400).json(result);
      return;
    }

    if (action === "health-check") {
      const connectionId = asString(body.connectionId).trim();
      if (!connectionId) {
        res.status(400).json({ error: "connectionId is required", traceId });
        return;
      }
      const result = await validateConnectionById(connectionId, { workspaceId, userId });
      res.status(result.ok ? 200 : 400).json(result);
      return;
    }

    res.status(400).json({
      error: "Unsupported action",
      traceId,
      availableActions: ["connect", "validate", "reconnect", "disable", "health-check"]
    });
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
    res.status(500).json({ error: error?.message || "channel_connection_manager_failed", traceId });
  }
}
