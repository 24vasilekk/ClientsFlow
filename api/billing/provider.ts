import { readJsonSafe, supabaseRestOrThrow } from "../_db/supabase.js";
import { getStripePriceIdForPlan } from "./plans.js";

type AnyRecord = Record<string, any>;
type SubscriptionStatus = "active" | "trial" | "past_due" | "canceled";
type ProviderName = "mock" | "stripe_stub";

type ProcessEnv = { env?: Record<string, string | undefined> };
declare const process: ProcessEnv;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function monthRange(now = new Date()): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export type CreateSubscriptionInput = {
  workspaceId: string;
  userId: string;
  planId: string;
  status?: SubscriptionStatus;
  metadata?: Record<string, unknown>;
};

export type CancelSubscriptionInput = {
  workspaceId: string;
  userId: string;
  reason?: string;
};

export type UpdatePlanInput = {
  workspaceId: string;
  userId: string;
  planId: string;
  metadata?: Record<string, unknown>;
};

export type BillingProviderResult = {
  ok: boolean;
  provider: ProviderName;
  subscriptionId: string;
  status: SubscriptionStatus;
  planId: string;
  providerSubscriptionId?: string;
  stripePriceId?: string;
};

export interface BillingProvider {
  name: ProviderName;
  createSubscription(input: CreateSubscriptionInput): Promise<BillingProviderResult>;
  cancelSubscription(input: CancelSubscriptionInput): Promise<BillingProviderResult>;
  updatePlan(input: UpdatePlanInput): Promise<BillingProviderResult>;
}

async function readSubscription(workspaceId: string, userId: string): Promise<AnyRecord | null> {
  const response = await supabaseRestOrThrow(
    `subscriptions?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
    {},
    "billing_provider_read_subscription"
  );
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function upsertSubscription(args: {
  provider: ProviderName;
  workspaceId: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  providerSubscriptionId?: string;
  stripePriceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<BillingProviderResult> {
  const existing = await readSubscription(args.workspaceId, args.userId);
  const existingMeta = existing?.metadata && typeof existing.metadata === "object" ? (existing.metadata as AnyRecord) : {};
  const period = monthRange();
  const subscriptionId = asString(existing?.id, `sub_${args.workspaceId}_${args.userId}`);
  await supabaseRestOrThrow(
    "subscriptions?on_conflict=workspace_id,user_id",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: subscriptionId,
          workspace_id: args.workspaceId,
          user_id: args.userId,
          plan_id: args.planId,
          status: args.status,
          provider: args.provider,
          provider_subscription_id: asString(args.providerSubscriptionId || existing?.provider_subscription_id || ""),
          current_period_start: existing?.current_period_start || period.startIso,
          current_period_end: existing?.current_period_end || period.endIso,
          canceled_at: args.status === "canceled" ? nowIso() : null,
          metadata: {
            ...existingMeta,
            ...(args.metadata || {}),
            stripePriceId: args.stripePriceId || existingMeta.stripePriceId || null,
            updatedByProvider: args.provider,
            updatedAt: nowIso()
          },
          updated_at: nowIso(),
          created_at: asString(existing?.created_at || nowIso())
        }
      ])
    },
    "billing_provider_upsert_subscription"
  );

  return {
    ok: true,
    provider: args.provider,
    subscriptionId,
    status: args.status,
    planId: args.planId,
    providerSubscriptionId: asString(args.providerSubscriptionId || existing?.provider_subscription_id || ""),
    stripePriceId: asString(args.stripePriceId || "")
  };
}

const mockProvider: BillingProvider = {
  name: "mock",
  async createSubscription(input) {
    return upsertSubscription({
      provider: "mock",
      workspaceId: input.workspaceId,
      userId: input.userId,
      planId: input.planId,
      status: input.status || "active",
      providerSubscriptionId: `mock_sub_${input.workspaceId}_${input.userId}`,
      stripePriceId: getStripePriceIdForPlan(input.planId),
      metadata: {
        ...(input.metadata || {}),
        mode: "mock"
      }
    });
  },
  async cancelSubscription(input) {
    const existing = await readSubscription(input.workspaceId, input.userId);
    if (!existing) {
      return {
        ok: false,
        provider: "mock",
        subscriptionId: "",
        status: "canceled",
        planId: ""
      };
    }
    return upsertSubscription({
      provider: "mock",
      workspaceId: input.workspaceId,
      userId: input.userId,
      planId: asString(existing.plan_id, "free"),
      status: "canceled",
      providerSubscriptionId: asString(existing.provider_subscription_id),
      stripePriceId: getStripePriceIdForPlan(asString(existing.plan_id, "free")),
      metadata: {
        cancelReason: asString(input.reason || "manual_cancel"),
        mode: "mock"
      }
    });
  },
  async updatePlan(input) {
    const existing = await readSubscription(input.workspaceId, input.userId);
    return upsertSubscription({
      provider: "mock",
      workspaceId: input.workspaceId,
      userId: input.userId,
      planId: input.planId,
      status: asString(existing?.status, "active") as SubscriptionStatus,
      providerSubscriptionId: asString(existing?.provider_subscription_id, `mock_sub_${input.workspaceId}_${input.userId}`),
      stripePriceId: getStripePriceIdForPlan(input.planId),
      metadata: {
        ...(input.metadata || {}),
        mode: "mock"
      }
    });
  }
};

const stripeStubProvider: BillingProvider = {
  name: "stripe_stub",
  async createSubscription(input) {
    return upsertSubscription({
      provider: "stripe_stub",
      workspaceId: input.workspaceId,
      userId: input.userId,
      planId: input.planId,
      status: input.status || "active",
      providerSubscriptionId: `stripe_stub_sub_${input.workspaceId}_${input.userId}`,
      stripePriceId: getStripePriceIdForPlan(input.planId),
      metadata: {
        ...(input.metadata || {}),
        mode: "stripe_stub",
        stripeReady: true
      }
    });
  },
  async cancelSubscription(input) {
    const existing = await readSubscription(input.workspaceId, input.userId);
    if (!existing) {
      return {
        ok: false,
        provider: "stripe_stub",
        subscriptionId: "",
        status: "canceled",
        planId: ""
      };
    }
    return upsertSubscription({
      provider: "stripe_stub",
      workspaceId: input.workspaceId,
      userId: input.userId,
      planId: asString(existing.plan_id, "free"),
      status: "canceled",
      providerSubscriptionId: asString(existing.provider_subscription_id, `stripe_stub_sub_${input.workspaceId}_${input.userId}`),
      stripePriceId: getStripePriceIdForPlan(asString(existing.plan_id, "free")),
      metadata: {
        cancelReason: asString(input.reason || "manual_cancel"),
        mode: "stripe_stub",
        stripeReady: true
      }
    });
  },
  async updatePlan(input) {
    const existing = await readSubscription(input.workspaceId, input.userId);
    return upsertSubscription({
      provider: "stripe_stub",
      workspaceId: input.workspaceId,
      userId: input.userId,
      planId: input.planId,
      status: asString(existing?.status, "active") as SubscriptionStatus,
      providerSubscriptionId: asString(existing?.provider_subscription_id, `stripe_stub_sub_${input.workspaceId}_${input.userId}`),
      stripePriceId: getStripePriceIdForPlan(input.planId),
      metadata: {
        ...(input.metadata || {}),
        mode: "stripe_stub",
        stripeReady: true
      }
    });
  }
};

function resolveProviderName(): ProviderName {
  const configured = asString(process?.env?.BILLING_PROVIDER, "mock").trim().toLowerCase();
  if (configured === "stripe_stub") return "stripe_stub";
  return "mock";
}

export function getBillingProvider(): BillingProvider {
  return resolveProviderName() === "stripe_stub" ? stripeStubProvider : mockProvider;
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<BillingProviderResult> {
  return getBillingProvider().createSubscription(input);
}

export async function cancelSubscription(input: CancelSubscriptionInput): Promise<BillingProviderResult> {
  return getBillingProvider().cancelSubscription(input);
}

export async function updatePlan(input: UpdatePlanInput): Promise<BillingProviderResult> {
  return getBillingProvider().updatePlan(input);
}
