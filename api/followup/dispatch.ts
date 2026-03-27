import { dispatchDueFollowUps } from "./engine";
import { authErrorPayload, requireRequestContext } from "../_auth/session";
import { isInternalDispatchRequest } from "../_runtime/internal";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(250, Math.floor(parsed));
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const traceId = String(req.headers?.["x-trace-id"] || req.body?.traceId || `trace_fu_dispatch_${Date.now().toString(36)}`);
  let workspaceId = "";
  let userId = "";
  const internalRequest = isInternalDispatchRequest(req);
  if (internalRequest) {
    workspaceId = asString(req.body?.workspaceId || req.query?.workspaceId).trim();
    userId = asString(req.body?.userId || req.query?.userId).trim();
    if (!workspaceId || !userId) {
      res.status(400).json({ error: "workspaceId and userId are required for internal dispatch", traceId });
      return;
    }
  } else {
    try {
      const ctx = await requireRequestContext(req, "api/followup/dispatch");
      workspaceId = ctx.workspaceId;
      userId = ctx.userId;
    } catch (error: any) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
  }

  try {
    const limit = toPositiveInt(req.body?.limit ?? req.query?.limit, 25);
    const result = await dispatchDueFollowUps(limit, { workspaceId, userId });
    res.status(200).json({ ok: true, traceId, ...result });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      traceId,
      error: error?.message || "followup_dispatch_failed"
    });
  }
}
