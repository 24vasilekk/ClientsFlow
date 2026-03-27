import { readJsonSafe, safeSupabaseCall } from "../_db/supabase.js";
import { dispatchPendingCrmHandoffs } from "../crm/handoffEngine.js";
import { runRecoveryForWorkspace, startManualFollowUp } from "../followup/engine.js";
import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";
import { enqueueDeferredInternalCall, isDeferredDispatchEnabled } from "../_runtime/internal.js";

type AnyRecord = Record<string, any>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function logOperation(args: {
  workspaceId: string;
  userId: string;
  action: string;
  status: string;
  payload: Record<string, unknown>;
  traceId?: string;
}) {
  await safeSupabaseCall(
    "analytics_snapshots",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: `op_${args.action}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          workspace_id: args.workspaceId,
          user_id: args.userId,
          snapshot_date: new Date().toISOString().slice(0, 10),
          scope: "operations",
          payload: {
            action: args.action,
            status: args.status,
            at: nowIso(),
            ...args.payload
          },
          created_at: nowIso()
        }
      ])
    },
    { traceId: args.traceId, context: `ops_log_operation:${args.action}` }
  );
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "id,name,stage,channel,estimated_revenue,updated_at\n";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, "\"\"")}"`;
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = (req.body || {}) as AnyRecord;
  const action = asString(body.action).toLowerCase();
  const traceId = asString(body.traceId, `trace_ops_${Date.now().toString(36)}`);
  let workspaceId = "";
  let userId = "";

  try {
    const authCtx = await requireRequestContext(req, "api/ops/actions");
    workspaceId = authCtx.workspaceId;
    userId = authCtx.userId;
    await ensureWorkspaceAccess({ workspaceId, userId, traceId });
    if (action === "export_leads") {
      const leadsResp = await safeSupabaseCall(
        `leads?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,name,stage,channel,estimated_revenue,updated_at&order=updated_at.desc&limit=5000`,
        {},
        { traceId, context: "ops_export_leads_fetch" }
      );
      const leads = await readJsonSafe<Array<Record<string, unknown>>>(leadsResp);
      if (!Array.isArray(leads) || leads.length === 0) {
        await logOperation({ workspaceId, userId, action, status: "incomplete", payload: { reason: "no_leads" }, traceId });
        res.status(200).json({ ok: false, status: "incomplete", message: "Нет лидов для экспорта." });
        return;
      }
      const csv = toCsv(leads);
      const fileName = `cflow-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      await logOperation({ workspaceId, userId, action, status: "success", payload: { count: leads.length, fileName }, traceId });
      res.status(200).json({
        ok: true,
        status: "success",
        fileName,
        csv,
        count: leads.length
      });
      return;
    }

    if (action === "followup_start") {
      const leadId = asString(body.leadId).trim();
      const conversationId = asString(body.conversationId).trim();
      const channel = asString(body.channel, "telegram").toLowerCase();
      if (!leadId || !conversationId) {
        await logOperation({ workspaceId, userId, action, status: "incomplete", payload: { reason: "missing_lead_or_conversation" }, traceId });
        res.status(200).json({ ok: false, status: "incomplete", message: "Не выбран лид/диалог для follow-up." });
        return;
      }
      const result = await startManualFollowUp({
        workspaceId,
        userId,
        leadId,
        conversationId,
        channel,
        traceId
      });
      const runStatus = asString(result.runStatus).toLowerCase();
      if (runStatus === "limit_exceeded_messages") {
        await logOperation({ workspaceId, userId, action, status: "incomplete", payload: result as unknown as Record<string, unknown>, traceId });
        res.status(429).json({
          ok: false,
          status: "incomplete",
          error: "messages_limit_exceeded",
          errorCode: "limit_exceeded_messages",
          upgradeRequired: true,
          message: asString((result as AnyRecord).message, "Достигнут лимит сообщений текущего тарифа."),
          ...result
        });
        return;
      }
      const status =
        runStatus === "sent" || runStatus === "recovered"
          ? "success"
          : runStatus === "retry_scheduled" || runStatus === "failed"
            ? "failed"
            : "incomplete";
      await logOperation({ workspaceId, userId, action, status, payload: result as unknown as Record<string, unknown>, traceId });
      res.status(200).json({
        ok: status === "success",
        status,
        message:
          status === "success"
            ? "Follow-up отправлен."
            : status === "incomplete"
              ? "Follow-up создан, но не отправлен: задача занята другим воркером или лид уже ответил."
              : "Follow-up не удалось отправить.",
        ...result
      });
      return;
    }

    if (action === "recovery_run") {
      const result = await runRecoveryForWorkspace({
        workspaceId,
        userId,
        traceId,
        limit: Number(body.limit || 25)
      });
      const inserted = Number((result as AnyRecord)?.summary?.inserted || 0);
      const dedupConflicts = Number((result as AnyRecord)?.summary?.dedupConflicts || 0);
      if (inserted <= 0) {
        await logOperation(
          {
            workspaceId,
            userId,
            action,
            status: "incomplete",
            payload: { scanned: result.scanned, inserted: 0, dedupConflicts, summary: (result as AnyRecord)?.summary || {} },
            traceId
          }
        );
        res.status(200).json({ ok: false, status: "incomplete", message: "Нет подходящих лидов для recovery.", ...result });
        return;
      }
      await logOperation(
        {
          workspaceId,
          userId,
          action,
          status: "success",
          payload: { scanned: result.scanned, inserted, dedupConflicts, summary: (result as AnyRecord)?.summary || {} },
          traceId
        }
      );
      res.status(200).json({ ok: true, status: "success", ...result });
      return;
    }

    if (action === "ai_recommendation_apply") {
      const recommendationId = asString(body.recommendationId).trim() || `rec_${Date.now().toString(36)}`;
      const title = asString(body.title).trim() || "AI recommendation";
      const description = asString(body.description).trim() || "";
      const area = asString(body.area).trim() || "";
      const actionLabel = asString(body.actionLabel).trim() || "";
      const leadId = asString(body.leadId).trim() || null;
      const conversationId = asString(body.conversationId).trim() || null;
      const actionSteps = Array.isArray(body.actionSteps) ? body.actionSteps.map((x: unknown) => String(x)) : [];
      const priority = asString(body.priority, "Средний");

      const recId = `ai_apply_${recommendationId}_${Date.now().toString(36)}`;
      await safeSupabaseCall(
        "ai_recommendations?on_conflict=id",
        {
          method: "POST",
          body: JSON.stringify([
            {
              id: recId,
              workspace_id: workspaceId,
              user_id: userId,
              lead_id: leadId,
              conversation_id: conversationId,
              priority,
              title,
              description,
              action_steps: actionSteps,
              expected_impact: asString(body.expectedImpact),
              status: "applied",
              created_at: nowIso(),
              updated_at: nowIso()
            }
          ])
        },
        { traceId, context: "ops_ai_recommendation_apply_upsert" }
      );

      const lowered = actionLabel.toLowerCase();
      let executionStatus: "success" | "incomplete" = "incomplete";
      let executionDetails: Record<string, unknown> = {};
      if (/(follow|recovery|повтор|возврат)/i.test(lowered)) {
        const recovery = await runRecoveryForWorkspace({ workspaceId, userId, traceId, limit: 20 });
        const inserted = Number((recovery as AnyRecord)?.summary?.inserted || 0);
        if (inserted > 0) {
          executionStatus = "success";
          executionDetails = { recoveryJobs: inserted, recoverySummary: (recovery as AnyRecord)?.summary || {} };
        } else {
          executionStatus = "incomplete";
          executionDetails = { recoveryJobs: 0, recoverySummary: (recovery as AnyRecord)?.summary || {} };
        }
      } else if (/crm|handoff/i.test(lowered)) {
        if (isDeferredDispatchEnabled()) {
          const deferred = await enqueueDeferredInternalCall({
            path: "/api/crm/handoff",
            payload: { action: "dispatch", workspaceId, userId, limit: 20, traceId },
            traceId
          });
          if (deferred.ok) {
            executionStatus = "incomplete";
            executionDetails = { crmHandoffs: 0, deferredDispatch: true };
          } else {
            executionStatus = "failed";
            executionDetails = { crmHandoffs: 0, deferredDispatch: false, deferredError: deferred.reason || "defer_failed" };
          }
        } else {
          const crm = await dispatchPendingCrmHandoffs(20, { workspaceId, userId });
          if (crm.count > 0) {
            executionStatus = "success";
            executionDetails = { crmHandoffs: crm.count };
          } else {
            executionStatus = "incomplete";
            executionDetails = { crmHandoffs: 0 };
          }
        }
      } else if (/экспорт|export/i.test(lowered)) {
        executionStatus = "incomplete";
        executionDetails = { note: "requires explicit export action" };
      } else {
        executionStatus = "incomplete";
        executionDetails = { note: "no executable mapping yet" };
      }

      await logOperation({
        workspaceId,
        userId,
        action,
        status: executionStatus,
        payload: { recommendationId, recId, actionLabel, area, ...executionDetails },
        traceId
      });
      res.status(200).json({
        ok: executionStatus === "success",
        status: executionStatus,
        recommendationRecordId: recId,
        message:
          executionStatus === "success"
            ? "Рекомендация применена и действие выполнено."
            : "Рекомендация сохранена, но действие требует ручного запуска или доп. интеграции.",
        ...executionDetails
      });
      return;
    }

    if (action === "crm_handoff_dispatch") {
      if (isDeferredDispatchEnabled()) {
        const deferred = await enqueueDeferredInternalCall({
          path: "/api/crm/handoff",
          payload: { action: "dispatch", workspaceId, userId, limit: Number(body.limit || 20), traceId },
          traceId
        });
        const status = deferred.ok ? "incomplete" : "failed";
        await logOperation({
          workspaceId,
          userId,
          action,
          status,
          payload: {
            deferredDispatch: deferred.ok,
            deferredError: deferred.reason || null
          },
          traceId
        });
        res.status(deferred.ok ? 202 : 500).json({
          ok: false,
          status: deferred.ok ? "incomplete" : "failed",
          deferredDispatch: deferred.ok,
          message: deferred.ok ? "CRM dispatch поставлен в фоновое выполнение." : "Не удалось поставить CRM dispatch в фон.",
          error: deferred.ok ? null : deferred.reason || "deferred_dispatch_failed"
        });
        return;
      }

      const result = await dispatchPendingCrmHandoffs(Number(body.limit || 20), { workspaceId, userId });
      const status =
        result.delivered > 0
          ? "success"
          : result.failed > 0
            ? "failed"
            : result.count > 0 || result.retryScheduled > 0 || result.canceled > 0
              ? "incomplete"
              : "incomplete";
      await logOperation({
        workspaceId,
        userId,
        action,
        status,
        payload: {
          count: result.count,
          delivered: result.delivered,
          retryScheduled: result.retryScheduled,
          failed: result.failed,
          canceled: result.canceled
        },
        traceId
      });
      res.status(200).json({
        ok: result.delivered > 0,
        status,
        ...result,
        message:
          result.delivered > 0
            ? `CRM handoff доставлен: ${result.delivered}.`
            : result.failed > 0
              ? `CRM handoff завершился ошибкой: ${result.failed}.`
              : result.retryScheduled > 0
                ? `CRM handoff в retry: ${result.retryScheduled}.`
                : "Нет pending CRM handoff задач."
      });
      return;
    }

    res.status(400).json({ error: "Unknown action", traceId });
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
    try {
      if (workspaceId && userId) {
        await logOperation({
          workspaceId,
          userId,
          action: action || "unknown",
          status: "failed",
          payload: { error: error?.message || "unknown_error" },
          traceId
        });
      }
    } catch (logError: any) {
      console.error("[ops/actions] log_failed", {
        traceId,
        message: logError?.message || "unknown_error"
      });
    }
    res.status(500).json({ ok: false, status: "failed", error: error?.message || "ops_action_failed", traceId });
  }
}
