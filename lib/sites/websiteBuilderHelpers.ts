import type { WebsiteBrief } from "./websiteBuilderTypes";
import { resolveWebsiteNiche, websiteDefaultsByNiche } from "./websiteDefaultsByNiche.js";

export function compact(input: unknown) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

export function parseJsonFromText(raw: string): any | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // continue
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export function extractCodeBlock(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const fenced = text.match(/```(?:tsx|jsx|typescript|javascript|js|ts)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] || text).trim();
}

export function looksLikeReactComponent(code: string) {
  const text = String(code || "").trim();
  const lower = text.toLowerCase();
  if (!text) return false;
  if (lower.includes("<!doctype html") || lower.includes("<html")) return false;
  const hasJsx = /<\s*[A-Za-z][^>]*>/.test(text) || text.includes("className=");
  const hasComponentShape =
    /export\s+default\s+function\s+[A-Z][A-Za-z0-9_]*/.test(text) ||
    /function\s+[A-Z][A-Za-z0-9_]*\s*\(/.test(text) ||
    /const\s+[A-Z][A-Za-z0-9_]*\s*=/.test(text);
  return hasJsx && hasComponentShape;
}

export function looksLowQualityComponent(code: string) {
  const text = String(code || "");
  const lower = text.toLowerCase();
  if (!text.trim()) return true;
  if (lower.includes("studio name") || lower.includes("company name") || lower.includes("lorem ipsum")) return true;
  if (text.length < 4500) return true;
  if (!/\.map\(/.test(text)) return true;
  if ((text.match(/<section\b/g) || []).length < 4) return true;
  return false;
}

function inferBusinessType(raw: string) {
  const lower = raw.toLowerCase();
  if (lower.includes("барбер") || lower.includes("barber")) return "barbershop";
  if (lower.includes("компьютер") || lower.includes("кибер") || lower.includes("gaming")) return "computer club";
  if (lower.includes("салон") || lower.includes("nail")) return "beauty salon";
  return "local business";
}

function inferCity(raw: string) {
  const lower = raw.toLowerCase();
  if (lower.includes("обнинск")) return "Обнинск";
  if (lower.includes("моск")) return "Москва";
  if (lower.includes("санкт") || lower.includes("питер") || lower.includes("спб")) return "Санкт-Петербург";
  const m = raw.match(/\bв\s+([a-zа-яё\-]{3,32})\b/i);
  if (m?.[1]) return m[1].trim();
  return "Россия";
}

export function inferFallbackBrief(input: {
  guidance: string;
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  style: string;
  mustHave: string[];
}): WebsiteBrief {
  const context = `${input.guidance} ${input.niche} ${input.style}`.trim();
  const businessType = input.niche || inferBusinessType(context);
  const city = input.city || inferCity(context);
  const brandName = input.businessName || `${businessType} в ${city}`;
  const styleKeywords = [input.style || "современный", "commercial", "premium"].filter(Boolean);
  return {
    businessType,
    city,
    brandName,
    targetAudience: "локальные клиенты 18-45, которым важны качество и сервис",
    styleKeywords,
    tone: "уверенный, современный, премиальный",
    primaryGoal: input.goal || "заявки и записи",
    primaryCTA: "Записаться",
    sections: ["hero", "benefits", "services", "pricing", "testimonials", "faq", "booking", "contacts"],
    colorDirection: businessType.includes("barber") ? "dark + gold accents" : "high-contrast modern palette",
    visualDirection: "bold hero, strong typography, premium cards, balanced spacing",
    contentHints: input.mustHave?.length ? input.mustHave : ["цены", "отзывы", "форма записи", "контакты"],
    needsContactForm: true,
    needsPricing: true,
    needsTestimonials: true,
    needsMap: businessType.includes("local") || businessType.includes("barber")
  };
}

type WebsitePromptProfile = {
  businessName?: string;
  niche?: string;
  city?: string;
  goal?: string;
  style?: string;
  mustHave?: string[];
};

type WebsitePromptEnrichment = {
  normalizedPrompt: string;
  wasEnriched: boolean;
  reason: "very_short" | "too_generic" | "already_detailed";
  brief: WebsiteBrief;
};

function detectGeneralRequest(text: string) {
  const normalized = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return true;
  const wordCount = normalized.split(" ").filter(Boolean).length;
  const hasBusinessCue = /(сайт|лендинг|landing|барбершоп|бренд|магазин|салон|клуб|clinic|shop|store)/i.test(normalized);
  const hasDetailCue = /(стиль|hero|cta|цвет|аудитори|контент|секц|отзыв|форма|контакт|конверс|преми|минимал|react|tailwind)/i.test(normalized);
  if (wordCount <= 8) return true;
  if (wordCount <= 14 && !hasDetailCue) return true;
  if (hasBusinessCue && !hasDetailCue && wordCount <= 18) return true;
  return false;
}

function detectVeryShortRequest(text: string) {
  const normalized = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return true;
  const words = normalized.split(" ").filter(Boolean);
  return words.length <= 5;
}

function hasCityInInput(text: string, briefCity: string) {
  const source = String(text || "").toLowerCase();
  const city = String(briefCity || "").toLowerCase();
  if (!city || city === "россия") return false;
  return source.includes(city);
}

function buildExpandedPromptFromBrief(rawUserPrompt: string, brief: WebsiteBrief) {
  const cityInstruction = hasCityInInput(rawUserPrompt, brief.city)
    ? `город из запроса использовать в hero, CTA и контактах: ${brief.city}`
    : brief.city && brief.city !== "Россия"
      ? `если уместно для локального бизнеса, использовать город ${brief.city} в hero, CTA и контактах`
      : "если город не указан, использовать нейтральные формулировки без выдумывания адреса";

  return [
    rawUserPrompt || `Сделай сайт для ${brief.businessType}`,
    "Internal auto-expansion enabled: convert short request into full conversion brief.",
    `business_type=${brief.businessType}; brand_name=${brief.brandName}; city=${brief.city};`,
    `target_audience=${brief.targetAudience};`,
    `style_direction=${brief.styleKeywords.join(", ")}; visual_direction=${brief.visualDirection}; color_direction=${brief.colorDirection};`,
    `primary_goal=${brief.primaryGoal}; primary_cta=${brief.primaryCTA}; tone=${brief.tone};`,
    `mandatory_sections=${brief.sections.join(", ")};`,
    `content_hints=${brief.contentHints.join(", ")};`,
    `requires_contact_form=${brief.needsContactForm}; requires_pricing=${brief.needsPricing}; requires_testimonials=${brief.needsTestimonials}; requires_map=${brief.needsMap};`,
    `locality_rule=${cityInstruction}.`,
    "Requirements: React + Tailwind, one self-contained App.jsx, realistic commercial copy, conversion-first layout."
  ].join(" ");
}

export function autoExpandWebsitePrompt(userInput: string, profile: WebsitePromptProfile = {}) {
  const raw = String(userInput || "").replace(/\s+/g, " ").trim();
  const brief = buildWebsiteBrief(raw, profile);
  const shouldExpand = detectVeryShortRequest(raw) || detectGeneralRequest(raw);
  if (!shouldExpand) {
    return {
      expandedPrompt: raw,
      expanded: false,
      reason: "already_detailed" as const,
      brief
    };
  }
  return {
    expandedPrompt: buildExpandedPromptFromBrief(raw, brief),
    expanded: true,
    reason: detectVeryShortRequest(raw) ? ("very_short" as const) : ("too_generic" as const),
    brief
  };
}

export function buildWebsiteBrief(userInput: string, profile: WebsitePromptProfile = {}): WebsiteBrief {
  const base = inferFallbackBrief({
    guidance: userInput,
    businessName: profile.businessName || "",
    niche: profile.niche || "",
    city: profile.city || "",
    goal: profile.goal || "",
    style: profile.style || "",
    mustHave: profile.mustHave || []
  });

  const nicheKey = resolveWebsiteNiche(userInput, profile.niche || base.businessType);
  const defaults = websiteDefaultsByNiche[nicheKey];
  const businessType = profile.niche || defaults.businessType || base.businessType;
  const city = profile.city || base.city || "Россия";
  const goal = profile.goal || defaults.primaryGoal || base.primaryGoal;
  const style = profile.style || defaults.styleDirection || "modern commercial contemporary";
  const sections = defaults.sections || base.sections;
  const primaryCTA = defaults.primaryCTA || base.primaryCTA;
  const targetAudience = defaults.audienceTemplate ? defaults.audienceTemplate(city) : base.targetAudience;
  const brandName = profile.businessName || base.brandName || `${businessType} в ${city}`;
  const contentHints = profile.mustHave?.length
    ? profile.mustHave
    : defaults.contentBlocks || ["реалистичный коммерческий оффер", "сильный CTA", "выгоды", "отзывы", "форма заявки", "контакты"];

  return sanitizeBrief(
    {
      ...base,
      businessType,
      city,
      brandName,
      targetAudience,
      tone: defaults.tone || "уверенный, коммерческий, современный",
      primaryGoal: goal,
      primaryCTA,
      sections,
      styleKeywords: Array.from(new Set([style, ...(defaults.styleKeywords || []), "modern landing page", "react", "tailwind"])),
      colorDirection: defaults.colorDirection || (style.includes("dark") ? "dark base + accent color" : "clean light base + strong contrast accents"),
      visualDirection: defaults.visualDirection || (style.includes("premium")
        ? "premium composition, bold hero, rich hierarchy, strong CTA blocks"
        : "clean commercial composition, clear hierarchy, conversion-first layout"),
      contentHints,
      needsContactForm: true,
      needsPricing: defaults.needsPricing,
      needsTestimonials: true,
      needsMap: defaults.needsMap && city !== "Россия"
    },
    base
  );
}

export function normalizeWebsitePrompt(userInput: string, profile: WebsitePromptProfile = {}) {
  const raw = String(userInput || "").replace(/\s+/g, " ").trim();
  return enrichWebsitePrompt(raw, profile).normalizedPrompt;
}

export function enrichWebsitePrompt(userInput: string, profile: WebsitePromptProfile = {}): WebsitePromptEnrichment {
  const raw = String(userInput || "").replace(/\s+/g, " ").trim();
  const expanded = autoExpandWebsitePrompt(raw, profile);
  if (!expanded.expanded) {
    return {
      normalizedPrompt: raw,
      wasEnriched: false,
      reason: "already_detailed",
      brief: expanded.brief
    };
  }

  return {
    normalizedPrompt: expanded.expandedPrompt,
    wasEnriched: true,
    reason: expanded.reason,
    brief: expanded.brief
  };
}

export function sanitizeBrief(raw: any, fallback: WebsiteBrief): WebsiteBrief {
  const next = { ...fallback };
  if (!raw || typeof raw !== "object") return next;
  const str = (key: keyof WebsiteBrief) => {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) (next as any)[key] = value.trim();
  };
  str("businessType");
  str("city");
  str("brandName");
  str("targetAudience");
  str("tone");
  str("primaryGoal");
  str("primaryCTA");
  str("colorDirection");
  str("visualDirection");
  if (Array.isArray(raw.styleKeywords)) next.styleKeywords = raw.styleKeywords.filter((x: unknown) => typeof x === "string" && x.trim()).slice(0, 8);
  if (Array.isArray(raw.sections)) next.sections = raw.sections.filter((x: unknown) => typeof x === "string" && x.trim()).slice(0, 12);
  if (Array.isArray(raw.contentHints)) next.contentHints = raw.contentHints.filter((x: unknown) => typeof x === "string" && x.trim()).slice(0, 12);
  if (typeof raw.needsContactForm === "boolean") next.needsContactForm = raw.needsContactForm;
  if (typeof raw.needsPricing === "boolean") next.needsPricing = raw.needsPricing;
  if (typeof raw.needsTestimonials === "boolean") next.needsTestimonials = raw.needsTestimonials;
  if (typeof raw.needsMap === "boolean") next.needsMap = raw.needsMap;
  return next;
}
