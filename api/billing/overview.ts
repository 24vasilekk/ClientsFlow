import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";
import { getBillingSummary, listBillingPlans } from "./service.js";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_billing_overview_${Date.now().toString(36)}`;
  try {
    const ctx = await requireRequestContext(req, "api/billing/overview");
    const workspaceId = ctx.workspaceId;
    const userId = ctx.userId;
    await ensureWorkspaceAccess({ workspaceId, userId, traceId });
    const [summary, plans] = await Promise.all([getBillingSummary(workspaceId, userId), listBillingPlans()]);
    res.status(200).json({ ok: true, traceId, summary, plans });
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
    res.status(500).json({ error: error?.message || "billing_overview_failed", traceId });
  }
}
