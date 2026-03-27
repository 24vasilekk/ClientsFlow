import { readJsonSafe, supabaseRestOrThrow } from "../_db/supabase";
import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace";
import { listConnections } from "../channel-connections/manager";
import { authErrorPayload, requireRequestContext } from "../_auth/session";

type AnyRecord = Record<string, any>;

type RangeInput = {
  from: string;
  to: string;
  label: string;
};

type TrendPoint = {
  day: string;
  incoming: number;
  booked: number;
  lost: number;
  followUpActivated: number;
  handoffToCrm: number;
  responseAvgSec: number;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toIsoDayStart(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function toIsoDayEnd(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

function parseRange(query: AnyRecord): RangeInput {
  const period = asString(query.period || "30d").toLowerCase();
  const now = new Date();

  const customFrom = asString(query.from || query.dateFrom).trim();
  const customTo = asString(query.to || query.dateTo).trim();
  if (period === "custom" && customFrom && customTo) {
    const fromDate = new Date(customFrom);
    const toDate = new Date(customTo);
    if (Number.isFinite(fromDate.getTime()) && Number.isFinite(toDate.getTime()) && fromDate <= toDate) {
      return {
        from: toIsoDayStart(fromDate),
        to: toIsoDayEnd(toDate),
        label: `${fromDate.toISOString().slice(0, 10)}..${toDate.toISOString().slice(0, 10)}`
      };
    }
  }

  const dayCount = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  const fromDate = new Date(now.getTime() - (dayCount - 1) * 24 * 60 * 60 * 1000);
  return {
    from: toIsoDayStart(fromDate),
    to: toIsoDayEnd(now),
    label: `${dayCount} дней`
  };
}

function normalizeStage(stage: string): "new" | "qualified" | "booked" | "lost" {
  const value = String(stage || "").toLowerCase();
  if (value === "booked" || value === "записан") return "booked";
  if (value === "lost" || value === "потерян") return "lost";
  if (value === "interested" || value === "asked_price" || value === "thinking" || value === "заинтересован" || value === "спросил цену" || value === "думает") {
    return "qualified";
  }
  return "new";
}

function safeRub(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function channelToUi(channel: string): "Telegram" | "WhatsApp" | "Instagram" | "Website" {
  const c = channel.toLowerCase();
  if (c === "telegram") return "Telegram";
  if (c === "whatsapp") return "WhatsApp";
  if (c === "instagram") return "Instagram";
  return "Website";
}

function inRange(iso: string, fromTs: number, toTs: number): boolean {
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) && ts >= fromTs && ts <= toTs;
}

function getDayKey(iso: string): string {
  return iso.slice(0, 10);
}

function fmtRuDay(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

async function fetchRows(path: string): Promise<AnyRecord[]> {
  const resp = await supabaseRestOrThrow(path, {}, "analytics_fetch_rows");
  const rows = await readJsonSafe<AnyRecord[]>(resp);
  return Array.isArray(rows) ? rows : [];
}

function computeResponsePairs(messages: AnyRecord[], fromTs: number, toTs: number): number[] {
  const byConversation = new Map<string, AnyRecord[]>();
  for (const row of messages) {
    const key = asString(row.conversation_id);
    if (!key) continue;
    if (!byConversation.has(key)) byConversation.set(key, []);
    byConversation.get(key)!.push(row);
  }

  const samples: number[] = [];
  for (const rows of byConversation.values()) {
    rows.sort((a, b) => new Date(asString(a.sent_at)).getTime() - new Date(asString(b.sent_at)).getTime());
    for (let i = 0; i < rows.length; i += 1) {
      const current = rows[i];
      if (asString(current.direction) !== "inbound") continue;
      const currentTs = new Date(asString(current.sent_at)).getTime();
      if (!Number.isFinite(currentTs) || currentTs < fromTs || currentTs > toTs) continue;
      const nextOutbound = rows.slice(i + 1).find((item) => asString(item.direction) === "outbound");
      if (!nextOutbound) continue;
      const outboundTs = new Date(asString(nextOutbound.sent_at)).getTime();
      if (!Number.isFinite(outboundTs) || outboundTs < currentTs) continue;
      const sec = Math.round((outboundTs - currentTs) / 1000);
      if (sec > 0 && sec <= 24 * 60 * 60) samples.push(sec);
    }
  }
  return samples;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_analytics_${Date.now().toString(36)}`;
    const authCtx = await requireRequestContext(req, "api/analytics/metrics");
    const workspaceId = authCtx.workspaceId;
    const userId = authCtx.userId;
    await ensureWorkspaceAccess({ workspaceId, userId, traceId });
    const range = parseRange(req.query || {});

    const fromTs = new Date(range.from).getTime();
    const toTs = new Date(range.to).getTime();

    const [messages, leads, followUps, crmHandoffs, connections] = await Promise.all([
      fetchRows(
        `messages?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&sent_at=gte.${encodeURIComponent(range.from)}&sent_at=lte.${encodeURIComponent(range.to)}&select=id,lead_id,conversation_id,channel,direction,sent_at,metadata&order=sent_at.asc&limit=10000`
      ),
      fetchRows(
        `leads?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,stage,estimated_revenue,lost_reason,channel,updated_at,created_at`
      ),
      fetchRows(
        `follow_up_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(range.from)}&created_at=lte.${encodeURIComponent(range.to)}&select=id,lead_id,status,trigger_type,created_at,executed_at,result`
      ),
      fetchRows(
        `crm_handoffs?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(range.from)}&created_at=lte.${encodeURIComponent(range.to)}&select=id,lead_id,status,created_at,event_type`
      ),
      listConnections({ workspaceId, userId })
    ]);

    const inboundMessages = messages.filter((row) => asString(row.direction) === "inbound");
    const outboundMessages = messages.filter((row) => asString(row.direction) === "outbound");
    const activeLeadIds = new Set(inboundMessages.map((row) => asString(row.lead_id)).filter(Boolean));

    const leadsById = new Map<string, AnyRecord>();
    for (const lead of leads) leadsById.set(asString(lead.id), lead);

    const incomingLeads = activeLeadIds.size;
    let qualified = 0;
    let booked = 0;
    let lost = 0;
    let estimatedLostRevenue = 0;

    for (const leadId of activeLeadIds) {
      const lead = leadsById.get(leadId);
      if (!lead) continue;
      const stage = normalizeStage(asString(lead.stage));
      if (stage === "qualified") qualified += 1;
      if (stage === "booked") booked += 1;
      if (stage === "lost") {
        lost += 1;
        estimatedLostRevenue += safeRub(lead.estimated_revenue);
      }
    }

    const followUpActivated = followUps.length;
    const followUpSent = followUps.filter((row) => ["sent", "recovered"].includes(asString(row.status))).length;
    const recovered = followUps.filter((row) => asString(row.status) === "recovered").length;

    const handoffToCrm = crmHandoffs.length;
    const handoffSuccess = crmHandoffs.filter((row) => asString(row.status) === "success").length;

    const responseSamples = computeResponsePairs(messages, fromTs, toTs);
    const responseTimeAvgSec = responseSamples.length > 0 ? Math.round(responseSamples.reduce((a, b) => a + b, 0) / responseSamples.length) : 0;
    const responseTimeP95Sec = percentile(responseSamples, 95);

    const dayMap = new Map<string, TrendPoint>();
    const dayCursor = new Date(range.from);
    while (dayCursor <= new Date(range.to)) {
      const key = dayCursor.toISOString().slice(0, 10);
      dayMap.set(key, {
        day: fmtRuDay(key),
        incoming: 0,
        booked: 0,
        lost: 0,
        followUpActivated: 0,
        handoffToCrm: 0,
        responseAvgSec: 0
      });
      dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
    }

    const bookedLeadsByDay = new Map<string, Set<string>>();
    const lostLeadsByDay = new Map<string, Set<string>>();

    for (const row of inboundMessages) {
      const key = getDayKey(asString(row.sent_at));
      if (dayMap.has(key)) dayMap.get(key)!.incoming += 1;
    }

    for (const lead of leads) {
      const updatedAt = asString(lead.updated_at || lead.created_at);
      if (!inRange(updatedAt, fromTs, toTs)) continue;
      const key = getDayKey(updatedAt);
      if (!dayMap.has(key)) continue;
      const stage = normalizeStage(asString(lead.stage));
      const leadId = asString(lead.id);
      if (stage === "booked") {
        if (!bookedLeadsByDay.has(key)) bookedLeadsByDay.set(key, new Set<string>());
        bookedLeadsByDay.get(key)!.add(leadId);
      }
      if (stage === "lost") {
        if (!lostLeadsByDay.has(key)) lostLeadsByDay.set(key, new Set<string>());
        lostLeadsByDay.get(key)!.add(leadId);
      }
    }

    for (const [key, leadsSet] of bookedLeadsByDay.entries()) {
      if (dayMap.has(key)) dayMap.get(key)!.booked = leadsSet.size;
    }
    for (const [key, leadsSet] of lostLeadsByDay.entries()) {
      if (dayMap.has(key)) dayMap.get(key)!.lost = leadsSet.size;
    }

    for (const row of followUps) {
      const key = getDayKey(asString(row.created_at));
      if (dayMap.has(key)) dayMap.get(key)!.followUpActivated += 1;
    }

    for (const row of crmHandoffs) {
      const key = getDayKey(asString(row.created_at));
      if (dayMap.has(key)) dayMap.get(key)!.handoffToCrm += 1;
    }

    const responseByDay = new Map<string, number[]>();
    const byConv = new Map<string, AnyRecord[]>();
    for (const row of messages) {
      const convId = asString(row.conversation_id);
      if (!convId) continue;
      if (!byConv.has(convId)) byConv.set(convId, []);
      byConv.get(convId)!.push(row);
    }

    for (const rows of byConv.values()) {
      rows.sort((a, b) => new Date(asString(a.sent_at)).getTime() - new Date(asString(b.sent_at)).getTime());
      for (let i = 0; i < rows.length; i += 1) {
        const inbound = rows[i];
        if (asString(inbound.direction) !== "inbound") continue;
        const inboundTs = new Date(asString(inbound.sent_at)).getTime();
        if (!Number.isFinite(inboundTs) || inboundTs < fromTs || inboundTs > toTs) continue;
        const reply = rows.slice(i + 1).find((item) => asString(item.direction) === "outbound");
        if (!reply) continue;
        const replyTs = new Date(asString(reply.sent_at)).getTime();
        const sec = Math.round((replyTs - inboundTs) / 1000);
        if (!(sec > 0 && sec <= 24 * 60 * 60)) continue;
        const key = getDayKey(asString(inbound.sent_at));
        if (!responseByDay.has(key)) responseByDay.set(key, []);
        responseByDay.get(key)!.push(sec);
      }
    }

    for (const [key, values] of responseByDay.entries()) {
      if (!dayMap.has(key)) continue;
      const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      dayMap.get(key)!.responseAvgSec = avg;
    }

    const channels = ["telegram", "whatsapp", "instagram", "website", "vk", "email"];
    const channelData = channels
      .map((channelKey) => {
        const channelInboundLeadIds = new Set(
          inboundMessages
            .filter((row) => asString(row.channel).toLowerCase() === channelKey)
            .map((row) => asString(row.lead_id))
            .filter(Boolean)
        );
        const incoming = channelInboundLeadIds.size;
        let qualifiedCount = 0;
        let bookedCount = 0;
        let lostCount = 0;
        for (const leadId of channelInboundLeadIds) {
          const lead = leadsById.get(leadId);
          if (!lead) continue;
          const stage = normalizeStage(asString(lead.stage));
          if (stage === "qualified") qualifiedCount += 1;
          if (stage === "booked") bookedCount += 1;
          if (stage === "lost") lostCount += 1;
        }
        const conversion = incoming > 0 ? Number(((bookedCount / incoming) * 100).toFixed(1)) : 0;
        return {
          channel: channelToUi(channelKey),
          incoming,
          qualified: qualifiedCount,
          booked: bookedCount,
          lost: lostCount,
          conversion
        };
      })
      .filter((row) => row.incoming > 0);

    const funnel = [
      { stage: "Новый", value: Math.max(0, incomingLeads - qualified - booked - lost) },
      { stage: "Заинтересован", value: qualified },
      { stage: "Записан", value: booked },
      { stage: "Потеряно", value: lost }
    ];

    const lostReasonMap = new Map<string, { reason: string; count: number; revenue: number }>();
    for (const leadId of activeLeadIds) {
      const lead = leadsById.get(leadId);
      if (!lead) continue;
      if (normalizeStage(asString(lead.stage)) !== "lost") continue;
      const reason = asString(lead.lost_reason).trim() || "Без зафиксированной причины";
      if (!lostReasonMap.has(reason)) lostReasonMap.set(reason, { reason, count: 0, revenue: 0 });
      const item = lostReasonMap.get(reason)!;
      item.count += 1;
      item.revenue += safeRub(lead.estimated_revenue);
    }

    const reasons = [...lostReasonMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 4);
    const channelSupport = connections.map((item) => ({
      channel: item.channel,
      status: item.status,
      supportLevel:
        item.capabilities.supportsInbound &&
        item.capabilities.supportsOutbound &&
        item.capabilities.supportsAutoReply &&
        item.capabilities.supportsFollowUp &&
        item.capabilities.supportsCrmHandoffTrigger &&
        item.capabilities.supportsHealthCheck
          ? "full"
          : "partial",
      capabilities: item.capabilities
    }));

    res.status(200).json({
      range,
      sourceOfTruth: {
        leads: "leads",
        messages: "messages",
        followUps: "follow_up_jobs",
        crmHandoffs: "crm_handoffs"
      },
      metrics: {
        incomingLeads,
        qualified,
        booked,
        lost,
        followUpActivated,
        followUpSent,
        recovered,
        handoffToCrm,
        handoffSuccess,
        estimatedLostRevenue: Math.round(estimatedLostRevenue),
        responseTimeAvgSec,
        responseTimeP95Sec,
        outboundMessages: outboundMessages.length
      },
      trend: [...dayMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((entry) => entry[1]),
      funnel,
      channels: channelData,
      channelSupport,
      conversion: incomingLeads > 0 ? Number(((booked / incomingLeads) * 100).toFixed(1)) : 0,
      lostRevenue: {
        periodLabel: range.label,
        lostLeads: lost,
        estimatedRevenue: Math.round(estimatedLostRevenue),
        topReason: reasons[0]?.reason || "Недостаточно данных для причин потерь",
        reasons,
        actions: [
          "Проверьте, где лиды чаще всего теряются по стадии и каналу.",
          "Запустите follow-up для сегмента с высоким lost revenue.",
          "Ускорьте первый ответ в каналах с самым долгим response time."
        ]
      },
      emptyState: incomingLeads === 0
    });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_")) {
      const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_analytics_${Date.now().toString(36)}`;
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    if (error?.code?.startsWith?.("workspace_")) {
      const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_analytics_${Date.now().toString(36)}`;
      const failure = workspaceAccessErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    res.status(500).json({
      error: error?.message || "analytics_metrics_failed",
      metrics: {
        incomingLeads: 0,
        qualified: 0,
        booked: 0,
        lost: 0,
        followUpActivated: 0,
        followUpSent: 0,
        recovered: 0,
        handoffToCrm: 0,
        handoffSuccess: 0,
        estimatedLostRevenue: 0,
        responseTimeAvgSec: 0,
        responseTimeP95Sec: 0,
        outboundMessages: 0
      },
      trend: [],
      funnel: [],
      channels: [],
      channelSupport: [],
      conversion: 0,
      lostRevenue: {
        periodLabel: "—",
        lostLeads: 0,
        estimatedRevenue: 0,
        topReason: "Нет данных",
        reasons: [],
        actions: []
      },
      emptyState: true
    });
  }
}
