import { readJsonSafe, supabaseRestOrThrow } from "../_db/supabase";
import { resolveFollowUpProvider } from "./provider";
import { sendOutboundThroughRuntime } from "../channel-runtime/send";
import { checkWorkspaceLimit, trackUsage } from "../billing/service";

type AnyRecord = Record<string, any>;

declare const process: { env: Record<string, string | undefined> };

type FollowUpJobRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  lead_id: string;
  conversation_id: string;
  channel: string;
  trigger_type: string;
  status: string;
  scheduled_at: string;
  dedup_key?: string;
  attempts?: number;
  max_retries?: number;
  created_at: string;
  claimed_at?: string | null;
  claimed_by?: string | null;
  processing_deadline?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function log(traceId: string, level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
  const payload = { traceId, message, ...(extra || {}) };
  if (level === "error") return console.error("[followup]", payload);
  if (level === "warn") return console.warn("[followup]", payload);
  return console.log("[followup]", payload);
}

function addHours(baseIso: string, hours: number): string {
  return new Date(new Date(baseIso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function hasPriceIntent(text: string): boolean {
  return /(цен|стоим|прайс|сколько)/i.test(String(text || "").toLowerCase());
}

function buildWorkerId(seed: string): string {
  return `fu_worker_${seed}_${Math.random().toString(36).slice(2, 8)}`;
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

type InsertFollowUpJobResult = {
  inserted?: boolean;
  job_id?: string;
  current_status?: string;
};

async function recoverStaleClaims(traceId: string): Promise<number> {
  try {
    const rows = await rpcRows<number>("recover_stale_follow_up_jobs", { p_now: nowIso() });
    const count = Number(rows[0] || 0);
    if (count > 0) log(traceId, "warn", "followup_stale_jobs_recovered", { count });
    return Number.isFinite(count) ? count : 0;
  } catch (error: any) {
    log(traceId, "error", "followup_stale_recovery_failed", { error: error?.message || "unknown_error" });
    return 0;
  }
}

async function claimNextDueJob(workerId: string, traceId: string): Promise<FollowUpJobRow | null> {
  const rows = await rpcRows<FollowUpJobRow>("claim_follow_up_job", {
    p_worker_id: workerId,
    p_now: nowIso(),
    p_processing_timeout: "10 minutes"
  });
  const job = rows[0] || null;
  if (job) log(traceId, "info", "followup_job_claimed", { jobId: job.id, workerId });
  return job;
}

async function claimJobById(jobId: string, workerId: string, traceId: string): Promise<FollowUpJobRow | null> {
  const rows = await rpcRows<FollowUpJobRow>("claim_follow_up_job_by_id", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_now: nowIso(),
    p_processing_timeout: "10 minutes"
  });
  const job = rows[0] || null;
  if (job) log(traceId, "info", "followup_job_claimed_by_id", { jobId, workerId });
  return job;
}

async function loadScopedJob(jobId: string, workspaceId: string, userId: string): Promise<FollowUpJobRow | null> {
  const response = await supabaseRestOrThrow(
    `follow_up_jobs?id=eq.${encodeURIComponent(jobId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
    {},
    "followup_load_scoped_job"
  );
  const rows = await readJsonSafe<FollowUpJobRow[]>(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function cancelPendingJobs(args: {
  workspaceId: string;
  userId: string;
  leadId: string;
  traceId: string;
}) {
  const pendingResp = await supabaseRestOrThrow(
    `follow_up_jobs?workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}&lead_id=eq.${encodeURIComponent(args.leadId)}&status=in.(pending,claimed,processing,retry_scheduled,queued,scheduled)&select=id`
  );
  const rows = await readJsonSafe<Array<{ id: string }>>(pendingResp);
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  for (const row of rows) {
    await supabaseRestOrThrow(
      `follow_up_jobs?id=eq.${encodeURIComponent(row.id)}&workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}`,
      {
      method: "PATCH",
      body: JSON.stringify({
        status: "canceled",
        canceled_at: nowIso(),
        updated_at: nowIso(),
        last_error: "client_replied",
        claimed_at: null,
        claimed_by: null,
        processing_deadline: null
      })
      }
    );
  }
  log(args.traceId, "info", "followup_jobs_canceled", { leadId: args.leadId, count: rows.length });
  return rows.length;
}

async function markRecoveredOnInbound(args: {
  workspaceId: string;
  userId: string;
  leadId: string;
  messageAt: string;
  traceId: string;
}) {
  const sentResp = await supabaseRestOrThrow(
    `follow_up_jobs?workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}&lead_id=eq.${encodeURIComponent(args.leadId)}&status=eq.sent&executed_at=lt.${encodeURIComponent(args.messageAt)}&select=id,result&order=executed_at.desc&limit=1`
  );
  const sentRows = await readJsonSafe<Array<{ id: string; result?: AnyRecord }>>(sentResp);
  const job = Array.isArray(sentRows) ? sentRows[0] : null;
  if (!job?.id) return 0;
  await supabaseRestOrThrow(
    `follow_up_jobs?id=eq.${encodeURIComponent(job.id)}&workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}`,
    {
    method: "PATCH",
    body: JSON.stringify({
      status: "recovered",
      result: {
        ...(job.result || {}),
        recoveredAt: args.messageAt,
        recoveredReason: "client_replied_after_followup"
      },
      updated_at: nowIso(),
      claimed_at: null,
      claimed_by: null,
      processing_deadline: null
    })
    }
  );
  log(args.traceId, "info", "followup_marked_recovered", { jobId: job.id, leadId: args.leadId });
  return 1;
}

async function createJob(args: {
  workspaceId: string;
  userId: string;
  leadId: string;
  conversationId: string;
  channel: string;
  triggerType: "no_response_timeout" | "price_ghost" | "not_booked_stalled";
  scheduledAt: string;
  payload: AnyRecord;
  dedupKey: string;
  traceId: string;
}) {
  const id = `fu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const maxRetries = Number(process.env.FOLLOW_UP_MAX_RETRIES || 3);
  const provider = resolveFollowUpProvider();

  const insertedRows = await rpcRows<InsertFollowUpJobResult>("insert_follow_up_job_if_new", {
    p_id: id,
    p_workspace_id: args.workspaceId,
    p_user_id: args.userId,
    p_lead_id: args.leadId,
    p_conversation_id: args.conversationId,
    p_channel: args.channel,
    p_trigger_type: args.triggerType,
    p_status: "pending",
    p_scheduled_at: args.scheduledAt,
    p_payload: args.payload,
    p_dedup_key: args.dedupKey,
    p_provider: process.env.FOLLOW_UP_PROVIDER === "qstash" ? "qstash" : "local",
    p_max_retries: maxRetries,
    p_now: nowIso()
  });
  const insertedRow = insertedRows[0] || {};
  const inserted = insertedRow.inserted === true;
  const persistedId = asString(insertedRow.job_id || id);

  if (!inserted) {
    log(args.traceId, "info", "followup_job_dedup_conflict_skip_schedule", {
      dedupKey: args.dedupKey,
      existingJobId: persistedId,
      currentStatus: asString(insertedRow.current_status, "unknown")
    });
    return {
      id: persistedId,
      inserted: false as const,
      enqueueStatus: "dedup_conflict" as const
    };
  }

  const schedule = await provider.schedule({
    jobId: persistedId,
    traceId: args.traceId,
    runAtIso: args.scheduledAt,
    dedupKey: args.dedupKey,
    retries: maxRetries
  });

  await supabaseRestOrThrow(
    `follow_up_jobs?id=eq.${encodeURIComponent(persistedId)}&workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}`,
    {
    method: "PATCH",
    body: JSON.stringify({
      status: "pending",
      provider: schedule.provider,
      provider_job_id: schedule.providerJobId || null,
      claimed_at: null,
      claimed_by: null,
      processing_deadline: null,
      updated_at: nowIso()
    })
    }
  );

  await trackUsage({
    workspaceId: args.workspaceId,
    userId: args.userId,
    metric: "follow_up_jobs",
    occurredAt: args.scheduledAt
  });

  log(args.traceId, "info", "followup_job_created", {
    id: persistedId,
    triggerType: args.triggerType,
    scheduledAt: args.scheduledAt,
    provider: schedule.provider
  });

  return {
    id: persistedId,
    inserted: true as const,
    enqueueStatus: "scheduled" as const
  };
}

export async function syncFollowUpOnInbound(args: {
  workspaceId: string;
  userId: string;
  leadId: string;
  conversationId: string;
  channel: string;
  messageText: string;
  messageAt: string;
  leadStage?: string;
  traceId: string;
}) {
  await markRecoveredOnInbound({
    workspaceId: args.workspaceId,
    userId: args.userId,
    leadId: args.leadId,
    messageAt: args.messageAt,
    traceId: args.traceId
  });

  await cancelPendingJobs({
    workspaceId: args.workspaceId,
    userId: args.userId,
    leadId: args.leadId,
    traceId: args.traceId
  });

  const created: Array<{ id: string; inserted: boolean; enqueueStatus: "scheduled" | "dedup_conflict" }> = [];

  const noResponseHours = Number(process.env.FOLLOW_UP_NO_RESPONSE_HOURS || 6);
  created.push(
    await createJob({
      workspaceId: args.workspaceId,
      userId: args.userId,
      leadId: args.leadId,
      conversationId: args.conversationId,
      channel: args.channel,
      triggerType: "no_response_timeout",
      scheduledAt: addHours(args.messageAt, noResponseHours),
      payload: { reason: "client_inactive", sourceMessageAt: args.messageAt },
      dedupKey: `${args.leadId}:no_response:${args.messageAt.slice(0, 13)}`,
      traceId: args.traceId
    })
  );

  if (hasPriceIntent(args.messageText)) {
    const priceGhostHours = Number(process.env.FOLLOW_UP_PRICE_GHOST_HOURS || 2);
    created.push(
      await createJob({
        workspaceId: args.workspaceId,
        userId: args.userId,
        leadId: args.leadId,
        conversationId: args.conversationId,
        channel: args.channel,
        triggerType: "price_ghost",
        scheduledAt: addHours(args.messageAt, priceGhostHours),
        payload: { reason: "asked_price_then_silent", sourceMessageAt: args.messageAt },
        dedupKey: `${args.leadId}:price_ghost:${args.messageAt.slice(0, 13)}`,
        traceId: args.traceId
      })
    );
  }

  if (args.leadStage !== "booked" && args.leadStage !== "записан") {
    const stalledHours = Number(process.env.FOLLOW_UP_NOT_BOOKED_HOURS || 24);
    created.push(
      await createJob({
        workspaceId: args.workspaceId,
        userId: args.userId,
        leadId: args.leadId,
        conversationId: args.conversationId,
        channel: args.channel,
        triggerType: "not_booked_stalled",
        scheduledAt: addHours(args.messageAt, stalledHours),
        payload: { reason: "not_booked_dialog", sourceMessageAt: args.messageAt },
        dedupKey: `${args.leadId}:not_booked:${args.messageAt.slice(0, 10)}`,
        traceId: args.traceId
      })
    );
  }

  return created.map((item) => item.id);
}

function buildFollowUpText(triggerType: string): string {
  if (triggerType === "price_ghost") {
    return "Подскажите, актуален ли ещё вопрос по стоимости? Могу сразу предложить подходящий вариант и ближайшее время.";
  }
  if (triggerType === "not_booked_stalled") {
    return "Возвращаюсь по вашему запросу: если удобно, помогу завершить запись в 2 сообщениях.";
  }
  return "Пишу, чтобы не потерять ваш запрос. Если вопрос ещё актуален, помогу продолжить и доведу до записи.";
}

async function executeClaimedFollowUpJob(job: FollowUpJobRow, traceId: string) {
  const jobId = job.id;
  const workerId = asString(job.claimed_by);

  const claimCheckResp = await supabaseRestOrThrow(
    `follow_up_jobs?id=eq.${encodeURIComponent(jobId)}&workspace_id=eq.${encodeURIComponent(job.workspace_id)}&user_id=eq.${encodeURIComponent(job.user_id)}&status=eq.claimed&claimed_by=eq.${encodeURIComponent(workerId)}&select=id`
  );
  const claimCheckRows = await readJsonSafe<Array<{ id: string }>>(claimCheckResp);
  if (!Array.isArray(claimCheckRows) || claimCheckRows.length === 0) {
    return { ok: false, status: "claimed_by_other_worker" };
  }

  await supabaseRestOrThrow(
    `follow_up_jobs?id=eq.${encodeURIComponent(jobId)}&workspace_id=eq.${encodeURIComponent(job.workspace_id)}&user_id=eq.${encodeURIComponent(job.user_id)}`,
    {
    method: "PATCH",
    body: JSON.stringify({
      status: "processing",
      updated_at: nowIso()
    })
    }
  );

  const newInboundResp = await supabaseRestOrThrow(
    `messages?workspace_id=eq.${encodeURIComponent(job.workspace_id)}&user_id=eq.${encodeURIComponent(job.user_id)}&lead_id=eq.${encodeURIComponent(job.lead_id)}&direction=eq.inbound&sent_at=gt.${encodeURIComponent(job.created_at)}&select=id&limit=1`
  );
  const newInbound = await readJsonSafe<Array<{ id: string }>>(newInboundResp);
  if (Array.isArray(newInbound) && newInbound.length > 0) {
    await supabaseRestOrThrow(
      `follow_up_jobs?id=eq.${encodeURIComponent(jobId)}&workspace_id=eq.${encodeURIComponent(job.workspace_id)}&user_id=eq.${encodeURIComponent(job.user_id)}`,
      {
      method: "PATCH",
      body: JSON.stringify({
        status: "canceled",
        canceled_at: nowIso(),
        updated_at: nowIso(),
        last_error: "client_replied_before_send",
        claimed_at: null,
        claimed_by: null,
        processing_deadline: null
      })
      }
    );
    return { ok: true, status: "canceled_client_replied" };
  }

  try {
    const text = buildFollowUpText(asString(job.trigger_type));
    const sent = await sendOutboundThroughRuntime({
      workspaceId: asString(job.workspace_id),
      userId: asString(job.user_id),
      channel: asString(job.channel),
      conversationId: asString(job.conversation_id),
      leadId: asString(job.lead_id),
      text,
      traceId,
      source: "followup_engine",
      messageIdPrefix: `msg_fu_${jobId}`,
      metadata: { followUpJobId: jobId, triggerType: job.trigger_type }
    });
    if (!sent.ok) {
      if (sent.status === "not_supported" || sent.status === "incomplete") {
        await supabaseRestOrThrow(
          `follow_up_jobs?id=eq.${encodeURIComponent(jobId)}&workspace_id=eq.${encodeURIComponent(job.workspace_id)}&user_id=eq.${encodeURIComponent(job.user_id)}`,
          {
          method: "PATCH",
          body: JSON.stringify({
            status: "canceled",
            canceled_at: nowIso(),
            updated_at: nowIso(),
            last_error: `${sent.status}:${sent.errorCode || "send_unavailable"}`,
            claimed_at: null,
            claimed_by: null,
            processing_deadline: null
          })
          }
        );
        return { ok: false, status: sent.status, error: sent.errorMessage || sent.errorCode || "send_unavailable" };
      }
      throw new Error(sent.errorMessage || sent.errorCode || "provider_send_failed");
    }

    await supabaseRestOrThrow(
      `follow_up_jobs?id=eq.${encodeURIComponent(jobId)}&workspace_id=eq.${encodeURIComponent(job.workspace_id)}&user_id=eq.${encodeURIComponent(job.user_id)}`,
      {
      method: "PATCH",
      body: JSON.stringify({
        status: "sent",
        executed_at: nowIso(),
        updated_at: nowIso(),
        result: { ok: true, externalMessageId: sent.externalMessageId || "", sentAt: nowIso() },
        last_error: null,
        claimed_at: null,
        claimed_by: null,
        processing_deadline: null
      })
      }
    );

    await supabaseRestOrThrow("analytics_snapshots?on_conflict=workspace_id,user_id,snapshot_date,scope", {
      method: "POST",
      body: JSON.stringify([
        {
          id: `snapshot_followup_${job.workspace_id}_${job.user_id}_${new Date().toISOString().slice(0, 10)}`,
          workspace_id: job.workspace_id,
          user_id: job.user_id,
          snapshot_date: new Date().toISOString().slice(0, 10),
          scope: "followup",
          payload: { sent: 1, triggerType: job.trigger_type, updatedAt: nowIso() },
          created_at: nowIso()
        }
      ])
    });

    log(traceId, "info", "followup_job_sent", { jobId, triggerType: job.trigger_type });
    return { ok: true, status: "sent" };
  } catch (error: any) {
    const attempts = Number(job.attempts || 1);
    const maxRetries = Number(job.max_retries || 3);
    const err = error?.message || "followup_send_failed";
    if (attempts < maxRetries) {
      const retryDelayMin = Math.min(60, 2 ** attempts * 5);
      const scheduledAt = new Date(Date.now() + retryDelayMin * 60 * 1000).toISOString();
      const provider = resolveFollowUpProvider();
      const dedupKey = asString(job.dedup_key, `${job.id}:retry:${attempts}`);
      const schedule = await provider.schedule({
        jobId: job.id,
        traceId,
        runAtIso: scheduledAt,
        dedupKey: `${dedupKey}:r${attempts}`,
        retries: maxRetries - attempts
      });
      await supabaseRestOrThrow(
        `follow_up_jobs?id=eq.${encodeURIComponent(jobId)}&workspace_id=eq.${encodeURIComponent(job.workspace_id)}&user_id=eq.${encodeURIComponent(job.user_id)}`,
        {
        method: "PATCH",
        body: JSON.stringify({
          status: "retry_scheduled",
          provider: schedule.provider,
          provider_job_id: schedule.providerJobId || null,
          scheduled_at: scheduledAt,
          last_error: err,
          updated_at: nowIso(),
          claimed_at: null,
          claimed_by: null,
          processing_deadline: null
        })
        }
      );
      return { ok: false, status: "retry_scheduled", error: err };
    }

    await supabaseRestOrThrow(
      `follow_up_jobs?id=eq.${encodeURIComponent(jobId)}&workspace_id=eq.${encodeURIComponent(job.workspace_id)}&user_id=eq.${encodeURIComponent(job.user_id)}`,
      {
      method: "PATCH",
      body: JSON.stringify({
        status: "failed",
        last_error: err,
        updated_at: nowIso(),
        claimed_at: null,
        claimed_by: null,
        processing_deadline: null
      })
      }
    );
    log(traceId, "error", "followup_job_failed", { jobId, error: err });
    return { ok: false, status: "failed", error: err };
  }
}

export async function executeFollowUpJob(jobId: string, traceId: string, scope: { workspaceId: string; userId: string }) {
  const workspaceId = asString(scope.workspaceId).trim();
  const userId = asString(scope.userId).trim();
  if (!workspaceId || !userId) return { ok: false, status: "forbidden_scope" };
  const scoped = await loadScopedJob(jobId, workspaceId, userId);
  if (!scoped) return { ok: false, status: "not_found" };
  const workerId = buildWorkerId("manual");
  const claimed = await claimJobById(jobId, workerId, traceId);
  if (!claimed) {
    const jobResp = await supabaseRestOrThrow(
      `follow_up_jobs?id=eq.${encodeURIComponent(jobId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=status`
    );
    const jobs = await readJsonSafe<Array<{ status?: string }>>(jobResp);
    const status = asString(Array.isArray(jobs) ? jobs[0]?.status : "", "not_found");
    if (status === "not_found") return { ok: false, status: "not_found" };
    if (!["pending", "claimed", "processing", "retry_scheduled", "queued", "scheduled"].includes(status)) {
      return { ok: true, status: "skipped_status" };
    }
    return { ok: false, status: "claimed_by_other_worker" };
  }
  return executeClaimedFollowUpJob(claimed, traceId);
}

export async function dispatchDueFollowUps(limit = 25, scope?: { workspaceId?: string; userId?: string }) {
  const traceId = `trace_dispatch_${Date.now().toString(36)}`;
  const workspaceId = asString(scope?.workspaceId).trim();
  const userId = asString(scope?.userId).trim();
  if (!workspaceId || !userId) {
    return { count: 0, results: [] as Array<{ id: string; status: string }>, error: "forbidden_scope" };
  }
  const dueResp = await supabaseRestOrThrow(
    `follow_up_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&status=in.(pending,retry_scheduled,queued,scheduled)&scheduled_at=lte.${encodeURIComponent(nowIso())}&select=id&order=scheduled_at.asc&limit=${Math.max(1, Math.min(100, limit))}`,
    {},
    "followup_dispatch_scoped_due"
  );
  const dueRows = await readJsonSafe<Array<{ id?: string }>>(dueResp);
  const ids = (Array.isArray(dueRows) ? dueRows : []).map((row) => asString(row.id)).filter(Boolean);
  const scopedResults: Array<{ id: string; status: string }> = [];
  for (const id of ids) {
    const run = await executeFollowUpJob(id, traceId, { workspaceId, userId });
    scopedResults.push({ id, status: asString(run.status, "unknown") });
  }
  return { count: scopedResults.length, results: scopedResults };
}

export async function startManualFollowUp(args: {
  workspaceId: string;
  userId: string;
  leadId: string;
  conversationId: string;
  channel: string;
  triggerType?: "no_response_timeout" | "price_ghost" | "not_booked_stalled";
  traceId: string;
}) {
  const messageLimit = await checkWorkspaceLimit({
    workspaceId: args.workspaceId,
    userId: args.userId,
    metric: "messages",
    increment: 1
  });
  if (!messageLimit.allowed) {
    return {
      jobId: "",
      runStatus: "limit_exceeded_messages",
      message: `Messages limit exceeded (${messageLimit.used}/${messageLimit.limit}).`,
      upgradeRequired: true
    };
  }
  const triggerType = args.triggerType || "no_response_timeout";
  const dedupKey = `${args.leadId}:manual:${triggerType}:${new Date().toISOString().slice(0, 16)}`;
  const created = await createJob({
    workspaceId: args.workspaceId,
    userId: args.userId,
    leadId: args.leadId,
    conversationId: args.conversationId,
    channel: args.channel,
    triggerType,
    scheduledAt: nowIso(),
    payload: { reason: "manual_start", triggerType },
    dedupKey,
    traceId: args.traceId
  });
  if (!created.inserted) {
    return {
      jobId: created.id,
      runStatus: "dedup_conflict",
      enqueueStatus: created.enqueueStatus
    };
  }
  const run = await executeFollowUpJob(created.id, args.traceId, { workspaceId: args.workspaceId, userId: args.userId });
  return { jobId: created.id, runStatus: run.status, enqueueStatus: created.enqueueStatus };
}

export async function runRecoveryForWorkspace(args: {
  workspaceId: string;
  userId: string;
  traceId: string;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(200, Number(args.limit || 25)));
  const leadsResp = await supabaseRestOrThrow(
    `leads?workspace_id=eq.${encodeURIComponent(args.workspaceId)}&user_id=eq.${encodeURIComponent(args.userId)}&stage=in.(thinking,lost,думает,потерян)&select=id,conversation_id,channel&limit=${limit}`
  );
  const leads = await readJsonSafe<Array<{ id: string; conversation_id: string; channel: string }>>(leadsResp);
  const targetLeads = Array.isArray(leads) ? leads : [];
  const created: Array<{ leadId: string; jobId: string; status: string }> = [];
  for (const lead of targetLeads) {
    const run = await startManualFollowUp({
      workspaceId: args.workspaceId,
      userId: args.userId,
      leadId: String(lead.id),
      conversationId: String(lead.conversation_id || `conv_${lead.id}`),
      channel: String(lead.channel || "telegram"),
      triggerType: "not_booked_stalled",
      traceId: args.traceId
    });
    created.push({ leadId: String(lead.id), jobId: run.jobId, status: String(run.runStatus || "unknown") });
  }
  const summary = {
    inserted: created.filter((item) => item.jobId && item.status !== "dedup_conflict").length,
    dedupConflicts: created.filter((item) => item.status === "dedup_conflict").length,
    sent: created.filter((item) => item.status === "sent").length,
    retryScheduled: created.filter((item) => item.status === "retry_scheduled").length,
    failed: created.filter((item) => item.status === "failed").length,
    incomplete: created.filter((item) => ["incomplete", "not_supported", "claimed_by_other_worker", "canceled_client_replied"].includes(item.status)).length
  };
  return { scanned: targetLeads.length, created, summary };
}
