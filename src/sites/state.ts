import { SitesBuilderAction, SitesBuilderState } from "./types";

const SITES_BUILDER_STATE_KEY = "clientsflow_sites_builder_v3_state";
const VALID_STEPS = new Set(["intro", "brief", "concepts", "editor", "publish"]);

const initialReference = {
  id: "ref-1",
  url: "",
  screenshotUrl: "",
  likesStyle: true,
  likesStructure: true,
  likesOffer: false
};

export const initialSitesBuilderState: SitesBuilderState = {
  step: "intro",
  brief: {
    businessName: "",
    niche: "",
    city: "",
    goal: "",
    tone: "Премиально и спокойно",
    primaryColor: "#0f172a",
    telegramLink: "",
    instagramLink: "",
    whatsappLink: ""
  },
  interviewAnswers: {},
  currentQuestionIndex: 0,
  structuredBrief: null,
  structuredBriefStatus: "idle",
  structuredBriefError: null,
  references: [initialReference],
  logos: [],
  photos: [],
  conceptsStatus: "idle",
  conceptsError: null,
  concepts: [],
  selectedConceptId: null,
  paymentStatus: "idle",
  paymentError: null,
  publishStatus: "idle",
  publishError: null,
  publishedPath: null
};

export function loadSitesBuilderState(): SitesBuilderState {
  if (typeof window === "undefined") return initialSitesBuilderState;
  try {
    const raw = localStorage.getItem(SITES_BUILDER_STATE_KEY);
    if (!raw) return initialSitesBuilderState;
    const parsed = JSON.parse(raw) as Partial<SitesBuilderState>;
    const normalizedStep =
      parsed.step && typeof parsed.step === "string" && VALID_STEPS.has(parsed.step) ? parsed.step : initialSitesBuilderState.step;
    return {
      ...initialSitesBuilderState,
      ...parsed,
      step: normalizedStep as SitesBuilderState["step"],
      brief: { ...initialSitesBuilderState.brief, ...(parsed.brief || {}) },
      interviewAnswers: parsed.interviewAnswers || {},
      references: Array.isArray(parsed.references) && parsed.references.length
        ? parsed.references.slice(0, 5).map((ref) => ({
            id: ref.id || `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            url: ref.url || "",
            screenshotUrl: ref.screenshotUrl || "",
            likesStyle: ref.likesStyle !== false,
            likesStructure: ref.likesStructure === true,
            likesOffer: ref.likesOffer === true
          }))
        : initialSitesBuilderState.references,
      logos: Array.isArray(parsed.logos) ? parsed.logos.slice(0, 1) : [],
      photos: Array.isArray(parsed.photos) ? parsed.photos.slice(0, 10) : []
    };
  } catch {
    return initialSitesBuilderState;
  }
}

export function saveSitesBuilderState(state: SitesBuilderState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SITES_BUILDER_STATE_KEY, JSON.stringify(state));
  } catch {
    // storage might overflow (large images); ignore for now
  }
}

export function sitesBuilderReducer(state: SitesBuilderState, action: SitesBuilderAction): SitesBuilderState {
  switch (action.type) {
    case "set_step":
      return { ...state, step: action.step };
    case "set_brief":
      return { ...state, brief: { ...state.brief, [action.field]: action.value } };
    case "set_interview_answer":
      return { ...state, interviewAnswers: { ...state.interviewAnswers, [action.id]: action.value } };
    case "set_current_question":
      return { ...state, currentQuestionIndex: Math.max(0, action.index) };
    case "add_reference":
      if (state.references.length >= 5) return state;
      return {
        ...state,
        references: [
          ...state.references,
          {
            id: `ref-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            url: "",
            screenshotUrl: "",
            likesStyle: true,
            likesStructure: false,
            likesOffer: false
          }
        ]
      };
    case "remove_reference":
      return { ...state, references: state.references.filter((item) => item.id !== action.id) };
    case "update_reference_url":
      return {
        ...state,
        references: state.references.map((item) => (item.id === action.id ? { ...item, url: action.url } : item))
      };
    case "update_reference_screenshot":
      return {
        ...state,
        references: state.references.map((item) =>
          item.id === action.id ? { ...item, screenshotUrl: action.screenshotUrl } : item
        )
      };
    case "toggle_reference_flag":
      return {
        ...state,
        references: state.references.map((item) =>
          item.id === action.id ? { ...item, [action.flag]: !item[action.flag] } : item
        )
      };
    case "set_logos":
      return { ...state, logos: action.logos.slice(0, 1) };
    case "set_photos":
      return { ...state, photos: action.photos.slice(0, 10) };
    case "structured_brief_loading":
      return { ...state, structuredBriefStatus: "loading", structuredBriefError: null };
    case "set_structured_brief":
      return {
        ...state,
        structuredBriefStatus: "success",
        structuredBriefError: null,
        structuredBrief: action.payload
      };
    case "structured_brief_error":
      return { ...state, structuredBriefStatus: "error", structuredBriefError: action.error };
    case "concepts_loading":
      return { ...state, conceptsStatus: "loading", conceptsError: null };
    case "concepts_success":
      return {
        ...state,
        conceptsStatus: "success",
        conceptsError: null,
        concepts: action.concepts,
        selectedConceptId: action.concepts[0]?.id ?? null,
        step: "concepts"
      };
    case "concepts_error":
      return { ...state, conceptsStatus: "error", conceptsError: action.error };
    case "select_concept":
      return { ...state, selectedConceptId: action.id };
    case "payment_loading":
      return { ...state, paymentStatus: "loading", paymentError: null };
    case "payment_success":
      return { ...state, paymentStatus: "success", paymentError: null, step: "publish" };
    case "payment_error":
      return { ...state, paymentStatus: "error", paymentError: action.error };
    case "publish_loading":
      return { ...state, publishStatus: "loading", publishError: null, publishedPath: null };
    case "publish_success":
      return { ...state, publishStatus: "success", publishError: null, publishedPath: action.path, step: "publish" };
    case "publish_error":
      return { ...state, publishStatus: "error", publishError: action.error };
    default:
      return state;
  }
}
