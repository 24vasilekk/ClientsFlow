export type PlanId = "trial" | "starter" | "growth" | "scale";

export type FeatureKey =
  | "basicInbox"
  | "leadQualification"
  | "recoveryFlows"
  | "aiRecommendations"
  | "advancedAnalytics"
  | "sitesBuilder";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyPriceRub: number;
  description: string;
  cta: string;
  features: string[];
  limits: {
    conversationsPerMonth: number;
    channels: number;
  };
  gates: Record<FeatureKey, boolean>;
  highlighted?: boolean;
};

export type LeadStatus = "Новый лид" | "Квалифицирован" | "Ожидает запись" | "Продажа" | "Потерян";

export type Lead = {
  id: string;
  name: string;
  source: string;
  service: string;
  status: LeadStatus;
  potentialRevenueRub: number;
  responseTimeSec: number;
};

export type Conversation = {
  id: string;
  client: string;
  channel: "WhatsApp" | "Telegram" | "Instagram" | "Сайт";
  summary: string;
  sentiment: "Теплый" | "Горячий" | "Риск ухода";
  unread: number;
  updatedAt: string;
};

export type Recommendation = {
  id: string;
  title: string;
  impact: string;
  action: string;
};

export type SiteTemplate = {
  id: string;
  name: string;
  niche: string;
  preview: string;
};

export type OnboardingData = {
  businessName: string;
  niche: string;
  primaryChannel: string;
  averageLeadsPerMonth: number;
};

export type CheckoutState = {
  selectedPlanId: PlanId;
  isPaid: boolean;
  activatedAt: string | null;
};

export type AppState = {
  checkout: CheckoutState;
  onboardingCompleted: boolean;
  onboardingData: OnboardingData;
};
