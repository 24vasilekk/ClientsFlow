export type AsyncStatus = "idle" | "loading" | "success" | "error";

export type SitesStep = "intro" | "brief" | "concepts" | "editor" | "publish";

export type ReferenceItem = {
  id: string;
  url: string;
  screenshotUrl?: string;
  likesStyle: boolean;
  likesStructure: boolean;
  likesOffer: boolean;
};

export type StructuredBrief = {
  businessBrief: string;
  offerBrief: string;
  styleBrief: string;
  contentBrief: string;
  sectionPlan: string;
  visualConstraints: string;
};

export type BriefAnswers = {
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  tone: string;
  primaryColor: string;
  telegramLink: string;
  instagramLink: string;
  whatsappLink: string;
};

export type SiteConcept = {
  id: string;
  name: string;
  description: string;
  strengths: string[];
  variant: "premium" | "conversion" | "trust" | "minimal";
  palette: {
    accent: string;
    base: string;
    hero: string;
  };
  hero: {
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    stats: Array<{ label: string; value: string }>;
  };
  services: Array<{ id: string; title: string; price: string; description: string }>;
  testimonials: Array<{ id: string; author: string; role: string; text: string }>;
  faq: Array<{ id: string; q: string; a: string }>;
  contacts: {
    phone: string;
    email: string;
    address: string;
    messengerLabel: string;
  };
  footer: {
    links: string[];
    legal: string;
  };
  cabinet: {
    title: string;
    text: string;
    cta: string;
  };
};

export type SitesBuilderState = {
  step: SitesStep;
  brief: BriefAnswers;
  interviewAnswers: Record<string, string>;
  currentQuestionIndex: number;
  structuredBrief: StructuredBrief | null;
  structuredBriefStatus: AsyncStatus;
  structuredBriefError: string | null;
  references: ReferenceItem[];
  logos: string[];
  photos: string[];
  conceptsStatus: AsyncStatus;
  conceptsError: string | null;
  concepts: SiteConcept[];
  selectedConceptId: string | null;
  paymentStatus: AsyncStatus;
  paymentError: string | null;
  publishStatus: AsyncStatus;
  publishError: string | null;
  publishedPath: string | null;
};

export type SitesBuilderAction =
  | { type: "set_step"; step: SitesStep }
  | { type: "set_brief"; field: keyof BriefAnswers; value: string }
  | { type: "set_interview_answer"; id: string; value: string }
  | { type: "set_current_question"; index: number }
  | { type: "add_reference" }
  | { type: "remove_reference"; id: string }
  | { type: "update_reference_url"; id: string; url: string }
  | { type: "update_reference_screenshot"; id: string; screenshotUrl: string }
  | { type: "toggle_reference_flag"; id: string; flag: "likesStyle" | "likesStructure" | "likesOffer" }
  | { type: "set_logos"; logos: string[] }
  | { type: "set_photos"; photos: string[] }
  | {
      type: "set_structured_brief";
      payload: StructuredBrief;
    }
  | { type: "structured_brief_loading" }
  | { type: "structured_brief_error"; error: string }
  | { type: "concepts_loading" }
  | { type: "concepts_success"; concepts: SiteConcept[] }
  | { type: "concepts_error"; error: string }
  | { type: "select_concept"; id: string }
  | { type: "payment_loading" }
  | { type: "payment_success" }
  | { type: "payment_error"; error: string }
  | { type: "publish_loading" }
  | { type: "publish_success"; path: string }
  | { type: "publish_error"; error: string };
