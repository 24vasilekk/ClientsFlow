import type { WebsiteBrief } from "./websiteBuilderTypes";

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown, min = 1) {
  return Array.isArray(value) && value.length >= min && value.every((item) => typeof item === "string" && item.trim().length > 0);
}

export function isValidWebsiteBriefShape(raw: unknown): raw is WebsiteBrief {
  if (!raw || typeof raw !== "object") return false;
  const b = raw as Record<string, unknown>;
  return (
    isNonEmptyString(b.businessType) &&
    isNonEmptyString(b.city) &&
    isNonEmptyString(b.brandName) &&
    isNonEmptyString(b.targetAudience) &&
    isStringArray(b.styleKeywords) &&
    isNonEmptyString(b.tone) &&
    isNonEmptyString(b.primaryGoal) &&
    isNonEmptyString(b.primaryCTA) &&
    isStringArray(b.sections) &&
    isNonEmptyString(b.colorDirection) &&
    isNonEmptyString(b.visualDirection) &&
    isStringArray(b.contentHints) &&
    typeof b.needsContactForm === "boolean" &&
    typeof b.needsPricing === "boolean" &&
    typeof b.needsTestimonials === "boolean" &&
    typeof b.needsMap === "boolean"
  );
}

export function isValidCodePayloadShape(raw: unknown) {
  if (!raw || typeof raw !== "object") return false;
  const c = raw as Record<string, unknown>;
  return (
    isNonEmptyString(c.componentCode) ||
    isNonEmptyString(c.code) ||
    isNonEmptyString(c.appCode) ||
    isNonEmptyString(c.jsx) ||
    isNonEmptyString(c.appJsx)
  );
}
