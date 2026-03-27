import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";
import { billingCancelSubscription, billingCreateSubscription, billingUpdatePlan, getBillingSummary } from "./service.js";

type AnyRecord = Record<string, any>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_billing_subscription_${Date.now().toString(36)}`;
  try {
    const ctx = await requireRequestContext(req, "api/billing/subscription");
    const workspaceId = ctx.workspaceId;
    const userId = ctx.userId;
    await ensureWorkspaceAccess({ workspaceId, userId, traceId });
    const body = (req.body || {}) as AnyRecord;
    const action = asString(body.action).trim().toLowerCase();
    if (action === "create") {
      const planId = asString(body.planId, "free");
      const result = await billingCreateSubscription({
        workspaceId,
        userId,
        planId,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
      });
      const summary = await getBillingSummary(workspaceId, userId);
      res.status(result.ok ? 200 : 400).json({ ok: result.ok, traceId, action, result, summary });
      return;
    }
    if (action === "update_plan") {
      const planId = asString(body.planId).trim();
      if (!planId) {
        res.status(400).json({ error: "planId is required", traceId });
        return;
      }
      const result = await billingUpdatePlan({
        workspaceId,
        userId,
        planId,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
      });
      const summary = await getBillingSummary(workspaceId, userId);
      res.status(result.ok ? 200 : 400).json({ ok: result.ok, traceId, action, result, summary });
      return;
    }
    if (action === "cancel") {
      const result = await billingCancelSubscription({
        workspaceId,
        userId,
        reason: asString(body.reason, "manual_cancel")
      });
      const summary = await getBillingSummary(workspaceId, userId);
      res.status(result.ok ? 200 : 400).json({ ok: result.ok, traceId, action, result, summary });
      return;
    }
    res.status(400).json({
      error: "Unsupported action",
      traceId,
      availableActions: ["create", "update_plan", "cancel"]
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
    res.status(500).json({ error: error?.message || "billing_subscription_failed", traceId });
  }
}
