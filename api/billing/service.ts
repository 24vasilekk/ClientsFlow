import { readJsonSafe, safeSupabaseCall, supabaseRestOrThrow } from "../_db/supabase.js";
import { createSubscription, updatePlan as providerUpdatePlan, cancelSubscription as providerCancelSubscription } from "./provider.js";
import { getStripePriceIdForPlan } from "./plans.js";

type AnyRecord = Record<string, any>;
type BillingMetric = "leads" | "messages" | "channels";
type UsageMetric = BillingMetric | "inbound_messages" | "ai_replies" | "follow_up_jobs" | "crm_handoffs";

type PlanRow = {
  id: string;
  title: string;
  description?: string;
  price_monthly?: number;
  currency?: string;
  leads_limit?: number | null;
  messages_limit?: number | null;
  channels_limit?: number | null;
  is_placeholder?: boolean;
};

type SubscriptionRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  plan_id: string;
  status: string;
  provider?: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
};

type UsageCounters = {
  periodKey: string;
  leads: number;
  messages: number;
  channels: number;
  inboundMessages: number;
  aiReplies: number;
  followUpJobs: number;
  crmHandoffs: number;
};

type InvoiceRow = {
  id?: string;
  plan_id?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  created_at?: string;
  issued_at?: string;
  paid_at?: string;
  period_start?: string;
  period_end?: string;
  provider?: string;
};

export type BillingSummary = {
  plan: {
    id: string;
    title: string;
    description: string;
    priceMonthly: number;
    currency: string;
    isPlaceholder: boolean;
    limits: {
      leads: number | null;
      messages: number | null;
      channels: number | null;
    };
  };
  subscription: {
    id: string;
    status: string;
    provider: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  usage: {
    periodKey: string;
    leads: number;
    messages: number;
    channels: number;
    inboundMessages: number;
    aiReplies: number;
    followUpJobs: number;
    crmHandoffs: number;
  };
  limitFlags: {
    leadsNearLimit: boolean;
    messagesNearLimit: boolean;
    channelsNearLimit: boolean;
  };
  stripeMapping: {
    free: string;
    pro: string;
    enterprise: string;
  };
  invoices: Array<{
    id: string;
    planId: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
    issuedAt: string;
    paidAt: string;
    periodStart: string;
    periodEnd: string;
    provider: string;
  }>;
};

export type BillingLimitDecision = {
  allowed: boolean;
  metric: BillingMetric;
  used: number;
  increment: number;
  limit: number | null;
  remaining: number | null;
  planId: string;
  reason?: string;
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function monthRange(now = new Date()): { periodKey: string; startIso: string; endIso: string; startDate: string; endDate: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  const periodKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    periodKey,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function addMonths(date: Date, diff: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + diff, 1, 0, 0, 0, 0));
}

function parseContentRangeCount(contentRange: string | null): number | null {
  if (!contentRange) return null;
  const slashIndex = contentRange.lastIndexOf("/");
  if (slashIndex === -1) return null;
  const total = Number(contentRange.slice(slashIndex + 1));
  return Number.isFinite(total) ? total : null;
}

async function countRows(path: string, context: string): Promise<number> {
  const response = await safeSupabaseCall(path, {
    method: "GET",
    headers: {
      Prefer: "count=exact"
    }
  }, { context });
  const countFromHeader = parseContentRangeCount(response.headers.get("content-range"));
  if (countFromHeader !== null) return countFromHeader;
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows.length : 0;
}

async function listPlans(): Promise<PlanRow[]> {
  const response = await supabaseRestOrThrow("plans?select=*&order=price_monthly.asc,id.asc", {}, "billing_list_plans");
  const rows = await readJsonSafe<PlanRow[]>(response);
  return Array.isArray(rows) ? rows : [];
}

async function findPlanById(id: string): Promise<PlanRow | null> {
  const response = await supabaseRestOrThrow(`plans?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {}, "billing_find_plan");
  const rows = await readJsonSafe<PlanRow[]>(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function ensureDefaultSubscription(workspaceId: string, userId: string): Promise<SubscriptionRow> {
  const existingResp = await supabaseRestOrThrow(
    `subscriptions?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    {},
    "billing_find_subscription"
  );
  const existingRows = await readJsonSafe<SubscriptionRow[]>(existingResp);
  if (Array.isArray(existingRows) && existingRows[0]) return existingRows[0];

  await createSubscription({
    workspaceId,
    userId,
    planId: "free",
    status: "active",
    metadata: { source: "auto_default_subscription" }
  });

  const createdResp = await supabaseRestOrThrow(
    `subscriptions?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    {},
    "billing_read_created_subscription"
  );
  const createdRows = await readJsonSafe<SubscriptionRow[]>(createdResp);
  if (!Array.isArray(createdRows) || !createdRows[0]) throw new Error("billing_subscription_not_available");
  return createdRows[0];
}

function metricLimit(plan: PlanRow, metric: BillingMetric): number | null {
  if (metric === "leads") return Number.isFinite(Number(plan.leads_limit)) ? Number(plan.leads_limit) : null;
  if (metric === "messages") return Number.isFinite(Number(plan.messages_limit)) ? Number(plan.messages_limit) : null;
  return Number.isFinite(Number(plan.channels_limit)) ? Number(plan.channels_limit) : null;
}

async function ensureMockInvoices(workspaceId: string, userId: string, subscription: SubscriptionRow, plan: PlanRow): Promise<void> {
  const now = new Date();
  const rows: AnyRecord[] = [];
  for (let i = 0; i < 3; i += 1) {
    const monthDate = addMonths(now, -i);
    const nextMonth = addMonths(now, -i + 1);
    const periodKey = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const amount = Math.max(0, asNumber(plan.price_monthly, 0));
    const currency = asString(plan.currency, "RUB");
    const createdAt = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 2, 10, 0, 0, 0)).toISOString();
    const paidAt = amount > 0 ? new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth(), 3, 12, 0, 0, 0)).toISOString() : createdAt;
    rows.push({
      id: `inv_mock_${workspaceId}_${userId}_${periodKey}`,
      workspace_id: workspaceId,
      user_id: userId,
      subscription_id: asString(subscription.id),
      plan_id: asString(plan.id, "free"),
      provider: "mock",
      provider_invoice_id: `mock_invoice_${periodKey}`,
      amount,
      currency,
      status: "paid",
      period_start: monthDate.toISOString().slice(0, 10),
      period_end: nextMonth.toISOString().slice(0, 10),
      issued_at: createdAt,
      paid_at: paidAt,
      metadata: {
        source: "mock_seed",
        periodKey
      },
      created_at: createdAt,
      updated_at: new Date().toISOString()
    });
  }
  await supabaseRestOrThrow(
    "invoices?on_conflict=id",
    {
      method: "POST",
      body: JSON.stringify(rows)
    },
    "billing_mock_invoices_seed"
  );
}

async function listInvoices(workspaceId: string, userId: string): Promise<InvoiceRow[]> {
  const response = await supabaseRestOrThrow(
    `invoices?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,plan_id,amount,currency,status,created_at,issued_at,paid_at,period_start,period_end,provider&order=created_at.desc&limit=50`,
    {},
    "billing_list_invoices"
  );
  const rows = await readJsonSafe<InvoiceRow[]>(response);
  return Array.isArray(rows) ? rows : [];
}

async function getUsageCounts(workspaceId: string, userId: string): Promise<UsageCounters> {
  const month = monthRange();
  const [leads, messages, channels, inboundMessages, aiReplies, followUpJobs, crmHandoffs] = await Promise.all([
    countRows(
      `leads?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(month.startIso)}&created_at=lt.${encodeURIComponent(month.endIso)}&select=id&limit=1`,
      "billing_count_leads"
    ),
    countRows(
      `messages?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&sent_at=gte.${encodeURIComponent(month.startIso)}&sent_at=lt.${encodeURIComponent(month.endIso)}&select=id&limit=1`,
      "billing_count_messages"
    ),
    countRows(
      `channel_connections?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&status=neq.disabled&select=id&limit=1`,
      "billing_count_channels"
    ),
    countRows(
      `messages?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&direction=eq.inbound&sent_at=gte.${encodeURIComponent(month.startIso)}&sent_at=lt.${encodeURIComponent(month.endIso)}&select=id&limit=1`,
      "billing_count_inbound_messages"
    ),
    countRows(
      `messages?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&direction=eq.outbound&metadata->>source=eq.ai_decision_pipeline&sent_at=gte.${encodeURIComponent(month.startIso)}&sent_at=lt.${encodeURIComponent(month.endIso)}&select=id&limit=1`,
      "billing_count_ai_replies"
    ),
    countRows(
      `follow_up_jobs?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(month.startIso)}&created_at=lt.${encodeURIComponent(month.endIso)}&select=id&limit=1`,
      "billing_count_followup_jobs"
    ),
    countRows(
      `crm_handoffs?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(month.startIso)}&created_at=lt.${encodeURIComponent(month.endIso)}&select=id&limit=1`,
      "billing_count_crm_handoffs"
    )
  ]);
  return {
    periodKey: month.periodKey,
    leads,
    messages,
    channels,
    inboundMessages,
    aiReplies,
    followUpJobs,
    crmHandoffs
  };
}

async function getUsageFromCountersTable(workspaceId: string, userId: string): Promise<{ usage: UsageCounters; complete: boolean }> {
  const month = monthRange();
  const response = await supabaseRestOrThrow(
    `usage?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&metric=in.(leads,messages,channels,inbound_messages,ai_replies,follow_up_jobs,crm_handoffs)&period_key=in.(${encodeURIComponent(month.periodKey)},current)&select=metric,period_key,used_value`,
    {},
    "billing_load_usage_counters"
  );
  const rows = await readJsonSafe<Array<{ metric?: string; period_key?: string; used_value?: number }>>(response);
  const list = Array.isArray(rows) ? rows : [];
  const findMetric = (metric: string, periodKey: string) =>
    list.find((row) => asString(row.metric) === metric && asString(row.period_key) === periodKey);

  const usage: UsageCounters = {
    periodKey: month.periodKey,
    leads: asNumber(findMetric("leads", month.periodKey)?.used_value, 0),
    messages: asNumber(findMetric("messages", month.periodKey)?.used_value, 0),
    channels: asNumber(findMetric("channels", "current")?.used_value, 0),
    inboundMessages: asNumber(findMetric("inbound_messages", month.periodKey)?.used_value, 0),
    aiReplies: asNumber(findMetric("ai_replies", month.periodKey)?.used_value, 0),
    followUpJobs: asNumber(findMetric("follow_up_jobs", month.periodKey)?.used_value, 0),
    crmHandoffs: asNumber(findMetric("crm_handoffs", month.periodKey)?.used_value, 0)
  };

  const complete =
    Boolean(findMetric("leads", month.periodKey)) &&
    Boolean(findMetric("messages", month.periodKey)) &&
    Boolean(findMetric("channels", "current")) &&
    Boolean(findMetric("inbound_messages", month.periodKey)) &&
    Boolean(findMetric("ai_replies", month.periodKey)) &&
    Boolean(findMetric("follow_up_jobs", month.periodKey)) &&
    Boolean(findMetric("crm_handoffs", month.periodKey));

  return { usage, complete };
}

async function syncUsageRows(args: {
  workspaceId: string;
  userId: string;
  usage: UsageCounters;
  plan: PlanRow;
}) {
  const month = monthRange();
  const rows = [
    {
      id: `usage_${args.workspaceId}_${args.userId}_leads_${args.usage.periodKey}`,
      workspace_id: args.workspaceId,
      user_id: args.userId,
      metric: "leads",
      period_key: args.usage.periodKey,
      period_start: month.startDate,
      period_end: month.endDate,
      used_value: args.usage.leads,
      limit_value: metricLimit(args.plan, "leads")
    },
    {
      id: `usage_${args.workspaceId}_${args.userId}_messages_${args.usage.periodKey}`,
      workspace_id: args.workspaceId,
      user_id: args.userId,
      metric: "messages",
      period_key: args.usage.periodKey,
      period_start: month.startDate,
      period_end: month.endDate,
      used_value: args.usage.messages,
      limit_value: metricLimit(args.plan, "messages")
    },
    {
      id: `usage_${args.workspaceId}_${args.userId}_inbound_messages_${args.usage.periodKey}`,
      workspace_id: args.workspaceId,
      user_id: args.userId,
      metric: "inbound_messages",
      period_key: args.usage.periodKey,
      period_start: month.startDate,
      period_end: month.endDate,
      used_value: args.usage.inboundMessages,
      limit_value: null
    },
    {
      id: `usage_${args.workspaceId}_${args.userId}_ai_replies_${args.usage.periodKey}`,
      workspace_id: args.workspaceId,
      user_id: args.userId,
      metric: "ai_replies",
      period_key: args.usage.periodKey,
      period_start: month.startDate,
      period_end: month.endDate,
      used_value: args.usage.aiReplies,
      limit_value: null
    },
    {
      id: `usage_${args.workspaceId}_${args.userId}_follow_up_jobs_${args.usage.periodKey}`,
      workspace_id: args.workspaceId,
      user_id: args.userId,
      metric: "follow_up_jobs",
      period_key: args.usage.periodKey,
      period_start: month.startDate,
      period_end: month.endDate,
      used_value: args.usage.followUpJobs,
      limit_value: null
    },
    {
      id: `usage_${args.workspaceId}_${args.userId}_crm_handoffs_${args.usage.periodKey}`,
      workspace_id: args.workspaceId,
      user_id: args.userId,
      metric: "crm_handoffs",
      period_key: args.usage.periodKey,
      period_start: month.startDate,
      period_end: month.endDate,
      used_value: args.usage.crmHandoffs,
      limit_value: null
    },
    {
      id: `usage_${args.workspaceId}_${args.userId}_channels_current`,
      workspace_id: args.workspaceId,
      user_id: args.userId,
      metric: "channels",
      period_key: "current",
      period_start: null,
      period_end: null,
      used_value: args.usage.channels,
      limit_value: metricLimit(args.plan, "channels")
    }
  ].map((row) => ({ ...row, updated_at: new Date().toISOString(), created_at: new Date().toISOString() }));

  await supabaseRestOrThrow(
    "usage?on_conflict=workspace_id,user_id,metric,period_key",
    {
      method: "POST",
      body: JSON.stringify(rows)
    },
    "billing_sync_usage_rows"
  );
}

async function resolveBilling(workspaceId: string, userId: string): Promise<{ subscription: SubscriptionRow; plan: PlanRow; usage: UsageCounters }> {
  const subscription = await ensureDefaultSubscription(workspaceId, userId);
  const plan = (await findPlanById(asString(subscription.plan_id).trim() || "free")) || {
    id: "free",
    title: "Free",
    description: "Fallback free plan",
    price_monthly: 0,
    currency: "RUB",
    leads_limit: 100,
    messages_limit: 1000,
    channels_limit: 1,
    is_placeholder: false
  };
  const usageCounters = await getUsageFromCountersTable(workspaceId, userId);
  let usage = usageCounters.usage;
  if (!usageCounters.complete) {
    usage = await getUsageCounts(workspaceId, userId);
    await syncUsageRows({ workspaceId, userId, usage, plan });
  }
  await ensureMockInvoices(workspaceId, userId, subscription, plan);
  return { subscription, plan, usage };
}

function isNearLimit(used: number, limit: number | null): boolean {
  if (limit === null || limit <= 0) return false;
  return used / limit >= 0.8;
}

export async function getBillingSummary(workspaceId: string, userId: string): Promise<BillingSummary> {
  const { subscription, plan, usage } = await resolveBilling(workspaceId, userId);
  const invoices = await listInvoices(workspaceId, userId);
  return {
    plan: {
      id: asString(plan.id, "free"),
      title: asString(plan.title, "Free"),
      description: asString(plan.description, ""),
      priceMonthly: asNumber(plan.price_monthly, 0),
      currency: asString(plan.currency, "RUB"),
      isPlaceholder: Boolean(plan.is_placeholder),
      limits: {
        leads: metricLimit(plan, "leads"),
        messages: metricLimit(plan, "messages"),
        channels: metricLimit(plan, "channels")
      }
    },
    subscription: {
      id: asString(subscription.id),
      status: asString(subscription.status, "active"),
      provider: asString(subscription.provider, "mock"),
      currentPeriodStart: asString(subscription.current_period_start || ""),
      currentPeriodEnd: asString(subscription.current_period_end || "")
    },
    usage: {
      periodKey: usage.periodKey,
      leads: usage.leads,
      messages: usage.messages,
      channels: usage.channels,
      inboundMessages: usage.inboundMessages,
      aiReplies: usage.aiReplies,
      followUpJobs: usage.followUpJobs,
      crmHandoffs: usage.crmHandoffs
    },
    limitFlags: {
      leadsNearLimit: isNearLimit(usage.leads, metricLimit(plan, "leads")),
      messagesNearLimit: isNearLimit(usage.messages, metricLimit(plan, "messages")),
      channelsNearLimit: isNearLimit(usage.channels, metricLimit(plan, "channels"))
    },
    stripeMapping: {
      free: getStripePriceIdForPlan("free"),
      pro: getStripePriceIdForPlan("pro"),
      enterprise: getStripePriceIdForPlan("enterprise")
    },
    invoices: invoices.map((row) => ({
      id: asString(row.id),
      planId: asString(row.plan_id, "free"),
      amount: asNumber(row.amount, 0),
      currency: asString(row.currency, "RUB"),
      status: asString(row.status, "paid"),
      createdAt: asString(row.created_at || ""),
      issuedAt: asString(row.issued_at || row.created_at || ""),
      paidAt: asString(row.paid_at || ""),
      periodStart: asString(row.period_start || ""),
      periodEnd: asString(row.period_end || ""),
      provider: asString(row.provider, "mock")
    }))
  };
}

export async function checkWorkspaceLimit(args: {
  workspaceId: string;
  userId: string;
  metric: BillingMetric;
  increment?: number;
}): Promise<BillingLimitDecision> {
  const increment = Math.max(1, asNumber(args.increment, 1));
  const { plan, usage } = await resolveBilling(args.workspaceId, args.userId);
  const limit = metricLimit(plan, args.metric);
  const used = args.metric === "leads" ? usage.leads : args.metric === "messages" ? usage.messages : usage.channels;
  if (limit === null || limit <= 0) {
    return {
      allowed: true,
      metric: args.metric,
      used,
      increment,
      limit: null,
      remaining: null,
      planId: asString(plan.id, "free")
    };
  }
  const next = used + increment;
  if (next > limit) {
    return {
      allowed: false,
      metric: args.metric,
      used,
      increment,
      limit,
      remaining: Math.max(0, limit - used),
      planId: asString(plan.id, "free"),
      reason: `limit_exceeded_${args.metric}`
    };
  }
  return {
    allowed: true,
    metric: args.metric,
    used,
    increment,
    limit,
    remaining: Math.max(0, limit - next),
    planId: asString(plan.id, "free")
  };
}

export async function listBillingPlans(): Promise<
  Array<{
    id: string;
    title: string;
    description: string;
    priceMonthly: number;
    currency: string;
    isPlaceholder: boolean;
    limits: { leads: number | null; messages: number | null; channels: number | null };
  }>
> {
  const plans = await listPlans();
  return plans.map((plan) => ({
    id: asString(plan.id),
    title: asString(plan.title),
    description: asString(plan.description),
    priceMonthly: asNumber(plan.price_monthly, 0),
    currency: asString(plan.currency, "RUB"),
    isPlaceholder: Boolean(plan.is_placeholder),
    limits: {
      leads: metricLimit(plan, "leads"),
      messages: metricLimit(plan, "messages"),
      channels: metricLimit(plan, "channels")
    }
  }));
}

export async function billingCreateSubscription(args: {
  workspaceId: string;
  userId: string;
  planId: string;
  metadata?: Record<string, unknown>;
}) {
  return createSubscription({
    workspaceId: args.workspaceId,
    userId: args.userId,
    planId: args.planId,
    status: "active",
    metadata: args.metadata
  });
}

export async function billingCancelSubscription(args: {
  workspaceId: string;
  userId: string;
  reason?: string;
}) {
  return providerCancelSubscription({
    workspaceId: args.workspaceId,
    userId: args.userId,
    reason: args.reason
  });
}

export async function billingUpdatePlan(args: {
  workspaceId: string;
  userId: string;
  planId: string;
  metadata?: Record<string, unknown>;
}) {
  return providerUpdatePlan({
    workspaceId: args.workspaceId,
    userId: args.userId,
    planId: args.planId,
    metadata: args.metadata
  });
}

export async function trackUsage(args: {
  workspaceId: string;
  userId: string;
  metric: UsageMetric;
  delta?: number;
  occurredAt?: string;
}) {
  const workspaceId = asString(args.workspaceId).trim();
  const userId = asString(args.userId).trim();
  const metric = asString(args.metric).trim();
  if (!workspaceId || !userId || !metric) return;

  const delta = Math.max(1, asNumber(args.delta, 1));
  const occurredAt = asString(args.occurredAt).trim() || new Date().toISOString();
  try {
    await supabaseRestOrThrow(
      "rpc/increment_usage_metric",
      {
        method: "POST",
        body: JSON.stringify({
          p_workspace_id: workspaceId,
          p_user_id: userId,
          p_metric: metric,
          p_delta: delta,
          p_occurred_at: occurredAt
        })
      },
      "billing_track_usage"
    );
  } catch (error) {
    console.error("[billing/trackUsage]", {
      workspaceId,
      userId,
      metric,
      delta,
      occurredAt,
      error: (error as Error)?.message || "unknown_error"
    });
  }
}
