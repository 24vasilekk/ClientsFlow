import { WebsiteBrief } from "./websiteBuilderTypes";

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
