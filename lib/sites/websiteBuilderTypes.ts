export type WebsiteBuilderMode = "generate" | "fix" | "improve";

export type WebsiteGenerationProfile = {
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  style: string;
  styleReference: string;
  mustHave: string[];
};

export type WebsiteBrief = {
  businessType: string;
  city: string;
  brandName: string;
  targetAudience: string;
  styleKeywords: string[];
  tone: string;
  primaryGoal: string;
  primaryCTA: string;
  sections: string[];
  colorDirection: string;
  visualDirection: string;
  contentHints: string[];
  needsContactForm: boolean;
  needsPricing: boolean;
  needsTestimonials: boolean;
  needsMap: boolean;
};

export type WebsiteBuilderRequest = {
  mode?: WebsiteBuilderMode;
  sessionId?: string;
  round?: number;
  guidance?: string;
  currentComponentCode?: string;
  errorText?: string;
  profile?: {
    businessName?: string;
    niche?: string;
    city?: string;
    goal?: string;
    style?: string;
    styleReference?: string;
    mustHave?: string[];
  };
};

export type WebsiteGenerationModels = {
  brief: string;
  code: string;
  polish: string;
};

export type WebsiteGenerationFlowResult = {
  brief: WebsiteBrief;
  componentCode: string;
  meta: {
    usedFallbackBrief: boolean;
    usedFallbackCode: boolean;
    usedPolish: boolean;
    normalizedGuidance: string;
  };
};
