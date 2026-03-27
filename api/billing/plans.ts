function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export type BillingPlanId = "free" | "pro" | "enterprise";

export type PlanStripeMapping = {
  planId: BillingPlanId;
  stripePriceId: string;
};

type ProcessEnv = { env?: Record<string, string | undefined> };

declare const process: ProcessEnv;

export function getStripePriceIdForPlan(planIdRaw: string): string {
  const planId = asString(planIdRaw).trim().toLowerCase();
  const env = process?.env || {};
  if (planId === "free") return asString(env.STRIPE_PRICE_ID_FREE, "price_mock_free");
  if (planId === "pro") return asString(env.STRIPE_PRICE_ID_PRO, "price_mock_pro");
  if (planId === "enterprise") return asString(env.STRIPE_PRICE_ID_ENTERPRISE, "price_mock_enterprise");
  return "";
}

export function listPlanStripeMapping(): PlanStripeMapping[] {
  return [
    { planId: "free", stripePriceId: getStripePriceIdForPlan("free") },
    { planId: "pro", stripePriceId: getStripePriceIdForPlan("pro") },
    { planId: "enterprise", stripePriceId: getStripePriceIdForPlan("enterprise") }
  ];
}
