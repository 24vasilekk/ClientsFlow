import { readJsonSafe, supabaseRestOrThrow } from "../_db/supabase";
import { trackUsage } from "../billing/service";

type AnyRecord = Record<string, any>;

declare const process: { env: Record<string, string | undefined> };

type CrmWebhookConfig = {
  targetUrl: string;
  authMode: "none" | "bearer" | "header";
  authHeaderName: string;
  authToken: string;
  eventTypes: string[];
  timeoutMs: number;
  maxRetries: number;
};

type CrmHandoffRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  lead_id: string;
  conversation_id: string;
  event_type: string;
  payload: AnyRecord;
  status: string;
  attempts?: number;
  max_retries?: number;
  next_attempt_at?: string | null;
  claimed_by?: string | null;
  dedup_key?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function log(traceId: string, level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
  const payload = { traceId, message, ...(extra || {}) };
  if (level === "error") return console.error("[crm/handoff]", payload);
  if (level === "warn") return console.warn("[crm/handoff]", payload);
  return console.log("[crm/handoff]", payload);
}

function computeBackoffMinutes(attempt: number): number {
  return Math.min(120, Math.max(1, 2 ** Math.max(0, attempt - 1)));
}

function defaultConfig(): CrmWebhookConfig {
  return {
    targetUrl: asString(process.env.CRM_WEBHOOK_URL),
    authMode: "none",
    authHeaderName: "X-CRM-Auth",
    authToken: asString(process.env.CRM_WEBHOOK_TOKEN),
    eventTypes: ["lead.qualified"],
    timeoutMs: Number(process.env.CRM_WEBHOOK_TIMEOUT_MS || 12000),
    maxRetries: Number(process.env.CRM_HANDOFF_MAX_RETRIES || 3)
  };
}

function buildWorkerId(seed: string): string {
  return `crm_worker_${seed}_${Math.random().toString(36).slice(2, 8)}`;
}

async function rpcRows<T = AnyRecord>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  const response = await supabaseRestOrThrow(`rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(args)
  });
  const rows = await readJsonSafe<T[] | T>(response);
  if (Array.isArray(rows)) return rows;
  return rows ? [rows as T] : [];
}

type InsertCrmHandoffResult = {
  inserted?: boolean;
  handoff_id?: string;
  current_status?: string;
};

async function recoverStaleClaims(traceId: string): Promise<number> {
  try {
    const rows = await rpcRows<number>("recover_stale_crm_handoffs", { p_now: nowIso() });
    const count = Number(rows[0] || 0);
    if (count > 0) log(traceId, "warn", "crm_handoff_stale_recovered", { count });
    return Number.isFinite(count) ? count : 0;
  } catch (error: any) {
    log(traceId, "error", "crm_handoff_stale_recovery_failed", { error: error?.message || "unknown_error" });
    return 0;
  }
}

async function claimNextPending(workerId: string, traceId: string): Promise<CrmHandoffRow | null> {
  const rows = await rpcRows<CrmHandoffRow>("claim_crm_handoff", {
    p_worker_id: workerId,
    p_now: nowIso(),
    p_processing_timeout: "10 minutes"
  });
  const row = rows[0] || null;
  if (row) log(traceId, "info", "crm_handoff_claimed", { handoffId: row.id, workerId });
  return row;
}

async function claimById(handoffId: string, workerId: string, traceId: string): Promise<CrmHandoffRow | null> {
  const rows = await rpcRows<CrmHandoffRow>("claim_crm_handoff_by_id", {
    p_handoff_id: handoffId,
    p_worker_id: workerId,
    p_now: nowIso(),
    p_processing_timeout: "10 minutes"
  });
  const row = rows[0] || null;
  if (row) log(traceId, "info", "crm_handoff_claimed_by_id", { handoffId, workerId });
  return row;
}

async function loadScopedHandoff(handoffId: string, workspaceId: string, userId: string): Promise<CrmHandoffRow | null> {
  const response = await supabaseRestOrThrow(
    `crm_handoffs?id=eq.${encodeURIComponent(handoffId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
    {},
    "crm_load_scoped_handoff"
  );
  const rows = await readJsonSafe<CrmHandoffRow[]>(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function loadCrmConfig(workspaceId: string, userId: string): Promise<CrmWebhookConfig> {
  const base = defaultConfig();
  const connectionResp = await supabaseRestOrThrow(
    `channel_connections?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&order=updated_at.desc&limit=1`
  );
  const rows = await readJsonSafe<AnyRecord[]>(connectionResp);
  const row = Array.isArray(rows) ? rows[0] : null;
  const crm = (row?.settings?.crmWebhook || {}) as AnyRecord;
  const eventTypes = Array.isArray(crm.eventTypes)
    ? crm.eventTypes.map((item) => String(item).trim()).filter(Boolean)
    : base.eventTypes;

  return {
    targetUrl: asString(crm.targetUrl, base.targetUrl),
    authMode: asString(crm.authMode, base.authMode) as CrmWebhookConfig["authMode"],
    authHeaderName: asString(crm.authHeaderName, base.authHeaderName),
    authToken: asString(crm.authToken, base.authToken),
    eventTypes: eventTypes.length > 0 ? eventTypes : base.eventTypes,
    timeoutMs: Number(crm.timeoutMs || base.timeoutMs),
    maxRetries: Number(crm.maxRetries || base.maxRetries)
  };
}

async function insertAttemptLog(args: {
  handoffId: string;
  workspaceId: string;
  userId: string;
  attemptNo: number;
  status: "success" | "failed";
  httpStatus?: number;
  errorMessage?: string;
  responseBody?: string;
}) {
  await supabaseRestOrThrow("crm_handoff_attempts?on_conflict=id", {
    method: "POST",
    body: JSON.stringify([
      {
        id: `crm_attempt_${args.handoffId}_${args.attemptNo}`,
        handoff_id: args.handoffId,
        workspace_id: args.workspaceId,
        user_id: args.userId,
        attempt_no: args.attemptNo,
        status: args.status,
        http_status: args.httpStatus || null,
        error_message: args.errorMessage || null,
        response_body: args.responseBody || null,
        created_at: nowIso()
      }
    ])
  });
}

export async function enqueueCrmHandoff(args: {
  workspaceId: string;
  userId: string;
  leadId: string;
  conversationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  dedupKey: string;
  traceId: string;
}) {
  const config = await loadCrmConfig(args.workspaceId, args.userId);
  if (!config.targetUrl) {
    log(args.traceId, "warn", "crm_handoff_skipped_missing_target_url", { eventType: args.eventType });
    return { enqueued: false, reason: "missing_target_url" as const };
  }
  if (!config.eventTypes.includes(args.eventType)) {
    return { enqueued: false, reason: "event_type_filtered" as const };
  }

  const id = `crm_handoff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const insertedRows = await rpcRows<InsertCrmHandoffResult>("insert_crm_handoff_if_new", {
    p_id: id,
    p_workspace_id: args.workspaceId,
    p_user_id: args.userId,
    p_lead_id: args.leadId,
    p_conversation_id: args.conversationId,
    p_event_type: args.eventType,
    p_payload: args.payload,
    p_dedup_key: args.dedupKey,
    p_max_retries: config.maxRetries,
    p_now: nowIso()
  });
  const insertedRow = insertedRows[0] || {};
  const inserted = insertedRow.inserted === true;
  const persistedId = asString(insertedRow.handoff_id || id);

  if (!inserted) {
    log(args.traceId, "info", "crm_handoff_dedup_conflict_skip_enqueue", {
      dedupKey: args.dedupKey,
      existingHandoffId: persistedId,
      currentStatus: asString(insertedRow.current_status, "unknown")
    });
    return {
      enqueued: false as const,
      reason: "dedup_conflict" as const,
      handoffId: persistedId
    };
  }

  await trackUsage({
    workspaceId: args.workspaceId,
    userId: args.userId,
    metric: "crm_handoffs",
    occurredAt: nowIso()
  });

  log(args.traceId, "info", "crm_handoff_enqueued", { handoffId: persistedId, eventType: args.eventType });
  return { enqueued: true, handoffId: persistedId };
}

async function executeClaimed(row: CrmHandoffRow, traceId: string) {
  const handoffId = row.id;
  const workerId = asString(row.claimed_by);
  const lockResp = await supabaseRestOrThrow(
    `crm_handoffs?id=eq.${encodeURIComponent(handoffId)}&workspace_id=eq.${encodeURIComponent(row.workspace_id)}&user_id=eq.${encodeURIComponent(row.user_id)}&status=eq.claimed&claimed_by=eq.${encodeURIComponent(workerId)}&select=id`
  );
  const lockRows = await readJsonSafe<Array<{ id: string }>>(lockResp);
  if (!Array.isArray(lockRows) || lockRows.length === 0) {
    return { ok: false, status: "claimed_by_other_worker" };
  }

  await supabaseRestOrThrow(
    `crm_handoffs?id=eq.${encodeURIComponent(handoffId)}&workspace_id=eq.${encodeURIComponent(row.workspace_id)}&user_id=eq.${encodeURIComponent(row.user_id)}`,
    {
    method: "PATCH",
    body: JSON.stringify({ status: "processing", updated_at: nowIso() })
    }
  );

  const config = await loadCrmConfig(asString(row.workspace_id), asString(row.user_id));
  if (!config.targetUrl) {
    await supabaseRestOrThrow(
      `crm_handoffs?id=eq.${encodeURIComponent(handoffId)}&workspace_id=eq.${encodeURIComponent(row.workspace_id)}&user_id=eq.${encodeURIComponent(row.user_id)}`,
      {
      method: "PATCH",
      body: JSON.stringify({
        status: "canceled",
        canceled_at: nowIso(),
        last_error: "missing_target_url",
        updated_at: nowIso(),
        claimed_at: null,
        claimed_by: null,
        processing_deadline: null
      })
      }
    );
    return { ok: false, status: "canceled", error: "missing_target_url" };
  }

  const attempts = Number(row.attempts || 1);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, config.timeoutMs));
  let httpStatus = 0;
  let responseBody = "";
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", "X-Trace-Id": traceId };
    if (config.authMode === "bearer" && config.authToken) headers.Authorization = `Bearer ${config.authToken}`;
    if (config.authMode === "header" && config.authToken) headers[config.authHeaderName || "X-CRM-Auth"] = config.authToken;

    const response = await fetch(config.targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        handoffId,
        eventType: row.event_type,
        leadId: row.lead_id,
        conversationId: row.conversation_id,
        payload: row.payload,
        sentAt: nowIso()
      }),
      signal: controller.signal
    });
    httpStatus = response.status;
    responseBody = await response.text();
    if (!response.ok) throw new Error(`crm_webhook_status_${response.status}`);

    await insertAttemptLog({
      handoffId,
      workspaceId: asString(row.workspace_id),
      userId: asString(row.user_id),
      attemptNo: attempts,
      status: "success",
      httpStatus,
      responseBody: responseBody.slice(0, 1000)
    });

    await supabaseRestOrThrow(
      `crm_handoffs?id=eq.${encodeURIComponent(handoffId)}&workspace_id=eq.${encodeURIComponent(row.workspace_id)}&user_id=eq.${encodeURIComponent(row.user_id)}`,
      {
      method: "PATCH",
      body: JSON.stringify({
        status: "success",
        attempts,
        last_error: null,
        updated_at: nowIso(),
        payload: {
          ...(row.payload || {}),
          handoffResult: {
            deliveredAt: nowIso(),
            status: "success",
            httpStatus
          }
        },
        claimed_at: null,
        claimed_by: null,
        processing_deadline: null
      })
      }
    );
    log(traceId, "info", "crm_handoff_success", { handoffId, attempts, httpStatus });
    return { ok: true, status: "success" };
  } catch (error: any) {
    const message = error?.message || "crm_handoff_failed";
    await insertAttemptLog({
      handoffId,
      workspaceId: asString(row.workspace_id),
      userId: asString(row.user_id),
      attemptNo: attempts,
      status: "failed",
      httpStatus: httpStatus || undefined,
      errorMessage: message,
      responseBody: responseBody.slice(0, 1000)
    });

    const maxRetries = Number(row.max_retries || config.maxRetries || 3);
    if (attempts >= maxRetries) {
      await supabaseRestOrThrow(
        `crm_handoffs?id=eq.${encodeURIComponent(handoffId)}&workspace_id=eq.${encodeURIComponent(row.workspace_id)}&user_id=eq.${encodeURIComponent(row.user_id)}`,
        {
        method: "PATCH",
        body: JSON.stringify({
          status: "failed",
          attempts,
          last_error: message,
          updated_at: nowIso(),
          claimed_at: null,
          claimed_by: null,
          processing_deadline: null
        })
        }
      );
      log(traceId, "error", "crm_handoff_failed_final", { handoffId, attempts, maxRetries, message });
      return { ok: false, status: "failed", error: message };
    }

    const delayMin = computeBackoffMinutes(attempts);
    const nextAttemptAt = new Date(Date.now() + delayMin * 60 * 1000).toISOString();
    await supabaseRestOrThrow(
      `crm_handoffs?id=eq.${encodeURIComponent(handoffId)}&workspace_id=eq.${encodeURIComponent(row.workspace_id)}&user_id=eq.${encodeURIComponent(row.user_id)}`,
      {
      method: "PATCH",
      body: JSON.stringify({
        status: "retry_scheduled",
        attempts,
        next_attempt_at: nextAttemptAt,
        last_error: message,
        updated_at: nowIso(),
        claimed_at: null,
        claimed_by: null,
        processing_deadline: null
      })
      }
    );
    log(traceId, "warn", "crm_handoff_retry_scheduled", { handoffId, attempts, nextAttemptAt, message });
    return { ok: false, status: "retry_scheduled", retryAt: nextAttemptAt, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeCrmHandoff(handoffId: string, traceId: string, scope: { workspaceId: string; userId: string }) {
  const workspaceId = asString(scope.workspaceId).trim();
  const userId = asString(scope.userId).trim();
  if (!workspaceId || !userId) return { ok: false, status: "forbidden_scope" };
  const scoped = await loadScopedHandoff(handoffId, workspaceId, userId);
  if (!scoped) return { ok: false, status: "not_found" };
  const workerId = buildWorkerId("manual");
  const claimed = await claimById(handoffId, workerId, traceId);
  if (!claimed) {
    const statusResp = await supabaseRestOrThrow(
      `crm_handoffs?id=eq.${encodeURIComponent(handoffId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=status`
    );
    const rows = await readJsonSafe<Array<{ status?: string }>>(statusResp);
    const status = asString(Array.isArray(rows) ? rows[0]?.status : "", "not_found");
    if (status === "not_found") return { ok: false, status: "not_found" };
    if (!["pending", "retry_scheduled", "claimed", "processing"].includes(status)) {
      return { ok: true, status: "skipped_status" };
    }
    return { ok: false, status: "claimed_by_other_worker" };
  }
  return executeClaimed(claimed, traceId);
}

export async function dispatchPendingCrmHandoffs(limit = 20, scope?: { workspaceId?: string; userId?: string }) {
  const traceId = `trace_crm_dispatch_${Date.now().toString(36)}`;
  const workspaceId = asString(scope?.workspaceId).trim();
  const userId = asString(scope?.userId).trim();
  if (!workspaceId || !userId) {
    return {
      count: 0,
      delivered: 0,
      retryScheduled: 0,
      failed: 0,
      canceled: 0,
      results: [] as Array<{ id: string; status: string }>,
      error: "forbidden_scope"
    };
  }
  const pendingResp = await supabaseRestOrThrow(
    `crm_handoffs?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&status=in.(pending,retry_scheduled)&select=id&order=next_attempt_at.asc&limit=${Math.max(1, Math.min(100, limit))}`,
    {},
    "crm_dispatch_scoped_pending"
  );
  const pendingRows = await readJsonSafe<Array<{ id?: string }>>(pendingResp);
  const ids = (Array.isArray(pendingRows) ? pendingRows : []).map((row) => asString(row.id)).filter(Boolean);
  const scopedResults: Array<{ id: string; status: string }> = [];
  for (const id of ids) {
    const run = await executeCrmHandoff(id, traceId, { workspaceId, userId });
    scopedResults.push({ id, status: asString(run.status, "unknown") });
  }
  const delivered = scopedResults.filter((r) => r.status === "success").length;
  const retryScheduled = scopedResults.filter((r) => r.status === "retry_scheduled").length;
  const failed = scopedResults.filter((r) => r.status === "failed").length;
  const canceled = scopedResults.filter((r) => r.status === "canceled").length;
  return { count: scopedResults.length, delivered, retryScheduled, failed, canceled, results: scopedResults };
}
