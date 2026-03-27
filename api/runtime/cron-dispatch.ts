import { readJsonSafe, safeSupabaseCall } from "../_db/supabase";
import { dispatchDueFollowUps } from "../followup/engine";
import { dispatchPendingCrmHandoffs } from "../crm/handoffEngine";
import { isInternalDispatchRequest } from "../_runtime/internal";

type AnyRecord = Record<string, any>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toPositiveInt(value: unknown, fallback: number, max = 200): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
}

async function fetchDispatchScopes(limit: number): Promise<Array<{ workspaceId: string; userId: string }>> {
  const boundedLimit = Math.max(1, Math.min(1000, limit * 4));
  const [followUpResp, crmResp] = await Promise.all([
    safeSupabaseCall(
      `follow_up_jobs?status=in.(pending,retry_scheduled,queued,scheduled)&scheduled_at=lte.${encodeURIComponent(new Date().toISOString())}&select=workspace_id,user_id&order=updated_at.desc&limit=${boundedLimit}`,
      {},
      { context: "cron_dispatch_scopes_followup" }
    ),
    safeSupabaseCall(
      `crm_handoffs?status=in.(pending,retry_scheduled)&next_attempt_at=lte.${encodeURIComponent(new Date().toISOString())}&select=workspace_id,user_id&order=updated_at.desc&limit=${boundedLimit}`,
      {},
      { context: "cron_dispatch_scopes_crm" }
    )
  ]);
  const followUpRows = await readJsonSafe<Array<{ workspace_id?: string; user_id?: string }>>(followUpResp);
  const crmRows = await readJsonSafe<Array<{ workspace_id?: string; user_id?: string }>>(crmResp);
  const rows = [...(Array.isArray(followUpRows) ? followUpRows : []), ...(Array.isArray(crmRows) ? crmRows : [])];
  const dedup = new Set<string>();
  const scopes: Array<{ workspaceId: string; userId: string }> = [];
  for (const row of rows) {
    const workspaceId = asString(row.workspace_id).trim();
    const userId = asString(row.user_id).trim();
    if (!workspaceId || !userId) continue;
    const key = `${workspaceId}:${userId}`;
    if (dedup.has(key)) continue;
    dedup.add(key);
    scopes.push({ workspaceId, userId });
    if (scopes.length >= limit) break;
  }
  return scopes;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const traceId = asString(req.headers?.["x-trace-id"] || req.query?.traceId || req.body?.traceId, `trace_cron_dispatch_${Date.now().toString(36)}`);
  if (!isInternalDispatchRequest(req)) {
    res.status(401).json({ error: "internal_auth_required", traceId });
    return;
  }

  const scopeLimit = toPositiveInt(req.query?.workspaceLimit ?? req.body?.workspaceLimit, 30, 500);
  const followUpLimit = toPositiveInt(req.query?.followupLimit ?? req.body?.followupLimit, 25, 250);
  const crmLimit = toPositiveInt(req.query?.crmLimit ?? req.body?.crmLimit, 20, 250);
  const scopes = await fetchDispatchScopes(scopeLimit);

  const results: Array<{
    workspaceId: string;
    userId: string;
    followupCount: number;
    crmCount: number;
    crmDelivered: number;
    crmRetryScheduled: number;
    crmFailed: number;
  }> = [];

  for (const scope of scopes) {
    const followup = await dispatchDueFollowUps(followUpLimit, scope);
    const crm = await dispatchPendingCrmHandoffs(crmLimit, scope);
    results.push({
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      followupCount: Number(followup.count || 0),
      crmCount: Number(crm.count || 0),
      crmDelivered: Number(crm.delivered || 0),
      crmRetryScheduled: Number(crm.retryScheduled || 0),
      crmFailed: Number(crm.failed || 0)
    });
  }

  const summary = {
    workspacesProcessed: results.length,
    followupJobsProcessed: results.reduce((sum, item) => sum + item.followupCount, 0),
    crmHandoffsProcessed: results.reduce((sum, item) => sum + item.crmCount, 0),
    crmDelivered: results.reduce((sum, item) => sum + item.crmDelivered, 0),
    crmRetryScheduled: results.reduce((sum, item) => sum + item.crmRetryScheduled, 0),
    crmFailed: results.reduce((sum, item) => sum + item.crmFailed, 0)
  };

  try {
    const snapshotRows = results.slice(0, 100).map((item, index) => ({
      id: `cron_dispatch_${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      workspace_id: item.workspaceId,
      user_id: item.userId,
      snapshot_date: new Date().toISOString().slice(0, 10),
      scope: "ops_dispatch",
      payload: {
        traceId,
        summary,
        item,
        workspaceLimit: scopeLimit,
        followUpLimit,
        crmLimit,
        executedAt: nowIso()
      },
      created_at: nowIso()
    }));
    if (snapshotRows.length > 0) {
      await safeSupabaseCall(
        "analytics_snapshots",
        {
          method: "POST",
          body: JSON.stringify(snapshotRows)
        },
        { context: "cron_dispatch_snapshot" }
      );
    }
  } catch (error: any) {
    console.error("[runtime/cron-dispatch] snapshot_write_failed", {
      traceId,
      error: asString(error?.message, "unknown_error")
    });
  }

  res.status(200).json({ ok: true, traceId, summary, items: results });
}
