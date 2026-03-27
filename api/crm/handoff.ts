import { dispatchPendingCrmHandoffs, executeCrmHandoff } from "./handoffEngine.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";
import { isInternalDispatchRequest } from "../_runtime/internal.js";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const action = asString(req.body?.action || req.query?.action, "dispatch").toLowerCase();
  const traceId = asString(req.body?.traceId || req.query?.traceId, `trace_crm_${Date.now().toString(36)}`);
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
      const ctx = await requireRequestContext(req, "api/crm/handoff");
      workspaceId = ctx.workspaceId;
      userId = ctx.userId;
    } catch (error: any) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
  }
  if (action === "execute") {
    const handoffId = asString(req.body?.handoffId || req.query?.handoffId).trim();
    if (!handoffId) {
      res.status(400).json({ error: "handoffId is required for execute action", traceId });
      return;
    }
    const runTraceId = asString(req.body?.traceId, `trace_crm_exec_${Date.now().toString(36)}`);
    try {
      const result = await executeCrmHandoff(handoffId, runTraceId, { workspaceId, userId });
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ ok: false, traceId: runTraceId, error: error?.message || "crm_handoff_execute_failed" });
    }
    return;
  }

  try {
    const limitRaw = Number(req.body?.limit ?? req.query?.limit ?? 20);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(250, Math.floor(limitRaw)) : 20;
    const result = await dispatchPendingCrmHandoffs(limit, { workspaceId, userId });
    const status = result.delivered > 0 ? "success" : result.failed > 0 ? "failed" : "incomplete";
    res.status(200).json({ ok: result.delivered > 0, status, traceId, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, traceId, error: error?.message || "crm_handoff_dispatch_failed" });
  }
}
