import { FormEvent, useEffect, useMemo, useState } from "react";

type ChatSitesBuilderPageProps = {
  onNavigate: (path: string) => void;
};

type BuilderStatus = "idle" | "loading" | "success" | "error";
type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  time: string;
  tone?: "default" | "soft";
};

type ServiceItem = {
  id: string;
  emoji: string;
  title: string;
  duration: string;
  price: string;
};

type FaqItem = {
  id: string;
  q: string;
  a: string;
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
};

type ReviewItem = {
  id: string;
  author: string;
  text: string;
};

type SectionKey = "about" | "services" | "team" | "reviews" | "faq" | "booking" | "contacts" | "gallery";
type ThemeDensity = "airy" | "balanced" | "compact";
type ThemeRadius = "soft" | "rounded" | "sharp";
type ThemeContrast = "soft" | "medium" | "high";
type LayoutBlock =
  | { id: string; type: "hero"; variant: "centered" | "split"; title: string; subtitle: string; primaryCta: string; secondaryCta: string }
  | { id: string; type: "about"; variant: "story" | "statement"; title: string; body: string }
  | { id: string; type: "services"; variant: "cards" | "rows"; items: Array<{ emoji: string; title: string; duration: string; price: string }> }
  | { id: string; type: "team"; variant: "grid" | "list"; items: Array<{ name: string; role: string }> }
  | { id: string; type: "reviews"; variant: "cards" | "quotes"; items: Array<{ author: string; text: string }> }
  | { id: string; type: "faq"; variant: "accordion" | "list"; items: Array<{ q: string; a: string }> }
  | { id: string; type: "booking"; variant: "panel"; primaryCta: string }
  | { id: string; type: "contacts"; variant: "panel" | "minimal"; line: string }
  | { id: string; type: "gallery"; variant: "masonry" | "tiles"; title: string };
type PageDslBlock = {
  id: string;
  type: string;
  variant?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  line?: string;
  primaryCta?: string;
  secondaryCta?: string;
  items?: Array<Record<string, string>>;
};
type DslAction =
  | { kind: "regenerate"; guidance: string }
  | { kind: "styleLike"; reference: string }
  | { kind: "addSection"; section: SectionKey }
  | { kind: "removeSection"; section: SectionKey }
  | { kind: "rewriteHero"; text: string }
  | { kind: "rewriteBlock"; blockId: string; instruction: string }
  | { kind: "moveBlock"; blockId: string; beforeId: string }
  | { kind: "undo" }
  | { kind: "revert"; round: number }
  | { kind: "none" };

type DraftState = {
  businessName: string;
  city: string;
  niche: string;
  accentColor: string;
  pageBg: string;
  surfaceBg: string;
  headlineStyle: "serif" | "sans";
  styleLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutBody: string;
  primaryCta: string;
  secondaryCta: string;
  contactLine: string;
  navItems: string[];
  services: ServiceItem[];
  team: TeamMember[];
  reviews: ReviewItem[];
  faq: FaqItem[];
  sectionOrder: SectionKey[];
  sectionsEnabled: Record<SectionKey, boolean>;
  summaryPoints: string[];
  socialLinks: { telegram?: string; whatsapp?: string; instagram?: string };
  fontHeading: string;
  fontBody: string;
  density: ThemeDensity;
  radius: ThemeRadius;
  contrast: ThemeContrast;
  layoutSpec: LayoutBlock[];
  pageDsl: PageDslBlock[];
  componentCode: string;
  pageCode: string;
};
type AgentProfile = {
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  style: string;
  styleReference: string;
  mustHave: string[];
};

type GenerationHistoryItem = {
  id: string;
  round: number;
  engine: "openrouter" | "algorithm";
  createdAt: string;
};

type DesignPreset = {
  id: string;
  label: string;
  accent: string;
  pageBg: string;
  surfaceBg: string;
  headlineStyle: "serif" | "sans";
};

type PublishPayload = {
  businessName: string;
  city?: string;
  logoUrl: string;
  accentColor: string;
  baseColor: string;
  heroTitle: string;
  heroSubtitle: string;
  about: string;
  primaryCta: string;
  secondaryCta: string;
  trustStats: Array<{ label: string; value: string }>;
  valueProps: string[];
  processSteps: string[];
  testimonials: Array<{ name: string; role: string; text: string }>;
  faq: Array<{ q: string; a: string }>;
  contactLine: string;
  products: Array<{ id: string; title: string; price: string; description: string; ctaText: string; images: string[] }>;
  sections: Record<string, boolean>;
  sectionOrder: string[];
  galleryUrls: string[];
  cabinetEnabled: boolean;
  telegramBot: string;
  socialLinks?: { telegram?: string; whatsapp?: string; instagram?: string };
  theme?: {
    fontHeading?: string;
    fontBody?: string;
    density?: ThemeDensity;
    radius?: ThemeRadius;
    contrast?: ThemeContrast;
  };
  layoutSpec?: LayoutBlock[];
  pageDsl?: PageDslBlock[];
  pageCode?: string;
};

const LOCAL_PUBLISHED_SITE_PREFIX = "clientsflow_local_published_site:";
const SITE_SESSION_STORAGE_KEY = "clientsflow_sites_generation_session";
const PUBLISH_REDIRECT_DELAY_MS = 1200;

const navItems = [
  { key: "create-site", label: "Создать сайт", icon: "✨" }
];

const quickPrompts = [
  "Создать сайт под мой бизнес"
];

const suggestions = ["Создать сайт"];

const designPresets: DesignPreset[] = [
  {
    id: "workspace-ash",
    label: "Workspace Ash",
    accent: "#0ea5e9",
    pageBg: "#eff8ff",
    surfaceBg: "#ffffff",
    headlineStyle: "sans"
  },
  {
    id: "editorial-rose",
    label: "Editorial Rose",
    accent: "#c77a7a",
    pageBg: "#f6f2f3",
    surfaceBg: "#fffafb",
    headlineStyle: "serif"
  },
  {
    id: "noir-modern",
    label: "Noir Modern",
    accent: "#334155",
    pageBg: "#f3f5f8",
    surfaceBg: "#f8fafc",
    headlineStyle: "sans"
  },
  {
    id: "deep-indigo",
    label: "Deep Indigo",
    accent: "#4f46e5",
    pageBg: "#f4f4ff",
    surfaceBg: "#f8f8ff",
    headlineStyle: "sans"
  },
  {
    id: "forest-premium",
    label: "Forest Premium",
    accent: "#0f766e",
    pageBg: "#f2f7f6",
    surfaceBg: "#f8fdfc",
    headlineStyle: "serif"
  }
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function sanitizeSessionId(raw: string) {
  const cleaned = String(raw || "")
    .replace(/[^\w-]/g, "")
    .slice(0, 64);
  return cleaned || `session-${uid()}`;
}

function sitesGenerateEndpoint() {
  if (typeof window === "undefined") return "/api/sites/generate";
  try {
    return new URL("/api/sites/generate", window.location.origin).toString();
  } catch {
    return "/api/sites/generate";
  }
}

async function parseJsonResponseSafe(response: Response) {
  const status = response.status;
  const contentType = response.headers.get("content-type") || "";
  const buffer = await response.arrayBuffer();
  const text = new TextDecoder("utf-8").decode(buffer);
  try {
    return {
      ok: true as const,
      status,
      contentType,
      body: JSON.parse(text) as any
    };
  } catch (error: any) {
    return {
      ok: false as const,
      status,
      contentType,
      rawText: text.slice(0, 600),
      parseError: String(error?.message || "json_parse_failed")
    };
  }
}

function parseMaybeJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;
  const text = raw.trim();
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    // continue
  }
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      // continue
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function extractHtmlDocument(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fenced = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || text).trim();
  const lower = candidate.toLowerCase();
  if (lower.includes("<!doctype html") || (lower.includes("<html") && lower.includes("</html>"))) return candidate;
  return null;
}

function extractCodeBlock(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fenced = text.match(/```(?:tsx|jsx|typescript|javascript|js|ts)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return text;
}

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function statusClass(status: BuilderStatus) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "loading") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function humanizeGenerationError(raw: string) {
  const text = String(raw || "").toLowerCase();
  if (text.includes("did not match the expected pattern")) {
    return "Сервер вернул ошибку формата переменных. Сделай redeploy и повтори запрос.";
  }
  if (text.includes("failed to fetch") || text.includes("networkerror")) {
    return "Сервер генерации сейчас недоступен. Повтори через 10-20 секунд.";
  }
  if (text.includes("openrouter_api_key") || text.includes("ai engine is not configured")) {
    return "Для этого окружения Vercel не настроен OPENROUTER_API_KEY.";
  }
  if (text.includes("ai generation failed")) {
    return "OpenRouter не вернул валидный JSON сайта. Повтори запрос или уточни задачу.";
  }
  return raw || "Ошибка генерации сайта.";
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function seeded(seed: number) {
  let value = seed || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function pick<T>(items: T[], rnd: () => number) {
  return items[Math.floor(rnd() * items.length)];
}

function detectRegenerateIntent(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("перегенер") ||
    lower.includes("новый вариант") ||
    lower.includes("с нуля") ||
    lower.includes("другой дизайн") ||
    lower.includes("переделай полностью")
  );
}

function detectRestyleIntent(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("измени дизайн") ||
    lower.includes("смени дизайн") ||
    lower.includes("редизайн") ||
    lower.includes("другой стиль") ||
    lower.includes("в стиле") ||
    lower.includes("по примеру") ||
    lower.includes("как в") ||
    lower.includes("как у")
  );
}

function detectAiEditIntent(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("измени") ||
    lower.includes("поменяй") ||
    lower.includes("сделай") ||
    lower.includes("добавь") ||
    lower.includes("убери") ||
    lower.includes("перестав") ||
    lower.includes("перепиши") ||
    lower.includes("обнови дизайн") ||
    lower.includes("сгенерируй") ||
    lower.includes("редизайн")
  );
}

function detectCopyToneIntent(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("сделай текст") ||
    lower.includes("перепиши текст") ||
    lower.includes("более премиально") ||
    lower.includes("короче") ||
    lower.includes("агрессив") ||
    lower.includes("вежлив") ||
    lower.includes("дружелюб")
  );
}

function parseCopyTone(text: string): "premium" | "short" | "aggressive" | "friendly" | null {
  const lower = text.toLowerCase();
  if (lower.includes("преми")) return "premium";
  if (lower.includes("короче") || lower.includes("коротк")) return "short";
  if (lower.includes("агрессив") || lower.includes("дерзк")) return "aggressive";
  if (lower.includes("дружелюб") || lower.includes("вежлив") || lower.includes("теплее")) return "friendly";
  return null;
}

function rewriteCopyTone(draft: DraftState, tone: "premium" | "short" | "aggressive" | "friendly"): DraftState {
  const next = { ...draft };
  if (tone === "premium") {
    next.heroTitle = `${next.businessName}: премиальный сервис без компромиссов`;
    next.heroSubtitle = "Точная подача, сильный визуал и конверсионный путь от первого экрана до заявки.";
    next.aboutBody = "Мы собираем digital-витрину бизнеса так, чтобы бренд выглядел дороже, а клиент принимал решение быстрее.";
    next.primaryCta = "Записаться сейчас";
    next.secondaryCta = "Смотреть предложения";
    next.styleLabel = `${next.styleLabel} · Premium Copy`;
  } else if (tone === "short") {
    next.heroTitle = `${next.businessName}: сайт для быстрых заявок`;
    next.heroSubtitle = "Коротко. Понятно. Конверсионно.";
    next.aboutBody = "Четкий оффер, прайс, доверие, запись.";
    next.styleLabel = `${next.styleLabel} · Short Copy`;
  } else if (tone === "aggressive") {
    next.heroTitle = `${next.businessName}: забирайте клиентов быстрее конкурентов`;
    next.heroSubtitle = "Сильный оффер, четкая упаковка и мгновенный путь к брони.";
    next.aboutBody = "Делаем сайт, который не просто красиво выглядит, а стабильно забирает заявки в работу.";
    next.primaryCta = "Забронировать место";
    next.secondaryCta = "Получить оффер";
    next.styleLabel = `${next.styleLabel} · Aggressive Copy`;
  } else {
    next.heroTitle = `${next.businessName}: удобно, понятно, по-человечески`;
    next.heroSubtitle = "Аккуратный сайт, который помогает клиенту быстро понять ценность и записаться.";
    next.aboutBody = "Мы делаем структуру и тексты так, чтобы человеку было легко выбрать услугу и сделать первый шаг.";
    next.styleLabel = `${next.styleLabel} · Friendly Copy`;
  }
  return next;
}

function detectCapabilityQuestion(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("что ты умеешь") || lower.includes("что ты еще можешь") || lower.includes("что ты можешь");
}

function parseSectionArg(input: string): SectionKey | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("about") || normalized.includes("о нас")) return "about";
  if (normalized.includes("service") || normalized.includes("услуг") || normalized.includes("прайс")) return "services";
  if (normalized.includes("team") || normalized.includes("команд") || normalized.includes("мастер")) return "team";
  if (normalized.includes("review") || normalized.includes("отзыв") || normalized.includes("кейсы")) return "reviews";
  if (normalized.includes("faq") || normalized.includes("вопрос")) return "faq";
  if (normalized.includes("booking") || normalized.includes("запис") || normalized.includes("форма")) return "booking";
  if (normalized.includes("contact") || normalized.includes("контакт")) return "contacts";
  if (normalized.includes("gallery") || normalized.includes("галер") || normalized.includes("фото")) return "gallery";
  return null;
}

function parseDslCommand(text: string): DslAction {
  const raw = text.trim();
  if (!raw.startsWith("/")) return { kind: "none" };
  // DSL path is intentionally disabled to keep the flow deterministic.
  return { kind: "none" };
}

function detectFontIntent(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("шрифт") || lower.includes("font") || lower.includes("типограф");
}

function parseFontPair(text: string): { heading: string; body: string; label: string } | null {
  const lower = text.toLowerCase();
  if (lower.includes("playfair") || lower.includes("с засеч")) {
    return { heading: '"Playfair Display", Georgia, serif', body: '"Lora", Georgia, serif', label: "Playfair + Lora" };
  }
  if (lower.includes("manrope")) {
    return { heading: '"Manrope", "Segoe UI", sans-serif', body: '"Manrope", "Segoe UI", sans-serif', label: "Manrope" };
  }
  if (lower.includes("montserrat")) {
    return { heading: '"Montserrat", "Segoe UI", sans-serif', body: '"Montserrat", "Segoe UI", sans-serif', label: "Montserrat" };
  }
  if (lower.includes("inter") || lower.includes("без засеч")) {
    return { heading: '"Inter", "Segoe UI", sans-serif', body: '"Inter", "Segoe UI", sans-serif', label: "Inter" };
  }
  return null;
}

function parseDensity(text: string): ThemeDensity | null {
  const lower = text.toLowerCase();
  if (lower.includes("возду") || lower.includes("больше отступ") || lower.includes("простор")) return "airy";
  if (lower.includes("плотн") || lower.includes("компакт")) return "compact";
  return null;
}

function parseRadius(text: string): ThemeRadius | null {
  const lower = text.toLowerCase();
  if (lower.includes("остр") || lower.includes("угл")) return "sharp";
  if (lower.includes("скругл") || lower.includes("round")) return "rounded";
  if (lower.includes("мягк")) return "soft";
  return null;
}

function parseContrast(text: string): ThemeContrast | null {
  const lower = text.toLowerCase();
  if (lower.includes("высок") || lower.includes("контрастнее")) return "high";
  if (lower.includes("мягк") || lower.includes("спокойн")) return "soft";
  return null;
}

function styleReferenceHints(input: string): Partial<Pick<DraftState, "fontHeading" | "fontBody" | "density" | "radius" | "contrast" | "accentColor" | "pageBg" | "surfaceBg" | "styleLabel">> {
  const lower = input.toLowerCase();
  const next: Partial<Pick<DraftState, "fontHeading" | "fontBody" | "density" | "radius" | "contrast" | "accentColor" | "pageBg" | "surfaceBg" | "styleLabel">> = {};
  if (!lower.trim()) return next;
  if (lower.includes("base44") || lower.includes("workspace")) {
    next.radius = "rounded";
    next.density = "balanced";
    next.contrast = "medium";
    next.accentColor = "#0ea5e9";
    next.pageBg = "#eff8ff";
    next.surfaceBg = "#ffffff";
    next.fontHeading = '"Inter", "Segoe UI", sans-serif';
    next.fontBody = '"Inter", "Segoe UI", sans-serif';
    next.styleLabel = "Workspace Ash · Reference";
  }
  if (lower.includes("editorial") || lower.includes("серф") || lower.includes("playfair")) {
    next.fontHeading = '"Playfair Display", Georgia, serif';
    next.fontBody = '"Lora", Georgia, serif';
    next.styleLabel = "Editorial Rose · Reference";
  }
  if (lower.includes("dark") || lower.includes("темн")) {
    next.contrast = "high";
    next.pageBg = "#eef2f7";
    next.surfaceBg = "#f8fafc";
    next.styleLabel = `${next.styleLabel || "Noir Modern"} · Dark`;
  }
  return next;
}

function radiusPx(radius: ThemeRadius) {
  if (radius === "sharp") return 10;
  if (radius === "rounded") return 24;
  return 16;
}

function sectionPadding(density: ThemeDensity) {
  if (density === "compact") return "14px";
  if (density === "airy") return "26px";
  return "20px";
}

function composeLayoutSpec(draft: Pick<DraftState, "businessName" | "styleLabel" | "heroTitle" | "heroSubtitle" | "primaryCta" | "secondaryCta" | "aboutTitle" | "aboutBody" | "services" | "team" | "reviews" | "faq" | "contactLine" | "sectionOrder" | "sectionsEnabled">): LayoutBlock[] {
  const rnd = seeded(hashString(`${draft.businessName}|${draft.styleLabel}|${draft.heroTitle}`));
  const heroBlock: LayoutBlock = {
    id: uid(),
    type: "hero",
    variant: rnd() > 0.5 ? "split" : "centered",
    title: draft.heroTitle,
    subtitle: draft.heroSubtitle,
    primaryCta: draft.primaryCta,
    secondaryCta: draft.secondaryCta
  };

  const blocks: LayoutBlock[] = [heroBlock];
  for (const section of draft.sectionOrder) {
    if (!draft.sectionsEnabled[section]) continue;
    if (section === "about") {
      blocks.push({ id: uid(), type: "about", variant: rnd() > 0.5 ? "story" : "statement", title: draft.aboutTitle, body: draft.aboutBody });
      continue;
    }
    if (section === "services") {
      blocks.push({
        id: uid(),
        type: "services",
        variant: rnd() > 0.5 ? "cards" : "rows",
        items: draft.services.map((item) => ({ emoji: item.emoji, title: item.title, duration: item.duration, price: item.price }))
      });
      continue;
    }
    if (section === "team") {
      blocks.push({ id: uid(), type: "team", variant: rnd() > 0.5 ? "grid" : "list", items: draft.team.map((item) => ({ name: item.name, role: item.role })) });
      continue;
    }
    if (section === "reviews") {
      blocks.push({ id: uid(), type: "reviews", variant: rnd() > 0.5 ? "cards" : "quotes", items: draft.reviews.map((item) => ({ author: item.author, text: item.text })) });
      continue;
    }
    if (section === "faq") {
      blocks.push({ id: uid(), type: "faq", variant: rnd() > 0.5 ? "accordion" : "list", items: draft.faq.map((item) => ({ q: item.q, a: item.a })) });
      continue;
    }
    if (section === "booking") {
      blocks.push({ id: uid(), type: "booking", variant: "panel", primaryCta: draft.primaryCta });
      continue;
    }
    if (section === "contacts") {
      blocks.push({ id: uid(), type: "contacts", variant: rnd() > 0.5 ? "panel" : "minimal", line: draft.contactLine });
      continue;
    }
    blocks.push({ id: uid(), type: "gallery", variant: rnd() > 0.5 ? "masonry" : "tiles", title: "Галерея" });
  }
  return blocks;
}

function normalizeLayoutSpec(raw: unknown, fallback: DraftState): LayoutBlock[] {
  if (!Array.isArray(raw)) return composeLayoutSpec(fallback);
  const result: LayoutBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const type = typeof (item as any).type === "string" ? (item as any).type : "";
    if (type === "hero") {
      result.push({
        id: uid(),
        type: "hero",
        variant: (item as any).variant === "split" ? "split" : "centered",
        title: String((item as any).title || fallback.heroTitle),
        subtitle: String((item as any).subtitle || fallback.heroSubtitle),
        primaryCta: String((item as any).primaryCta || fallback.primaryCta),
        secondaryCta: String((item as any).secondaryCta || fallback.secondaryCta)
      });
      continue;
    }
    if (type === "about") {
      result.push({
        id: uid(),
        type: "about",
        variant: (item as any).variant === "statement" ? "statement" : "story",
        title: String((item as any).title || fallback.aboutTitle),
        body: String((item as any).body || fallback.aboutBody)
      });
      continue;
    }
    if (type === "services") {
      const rows = Array.isArray((item as any).items) ? (item as any).items : [];
      result.push({
        id: uid(),
        type: "services",
        variant: (item as any).variant === "rows" ? "rows" : "cards",
        items: rows
          .filter((row: any) => row && typeof row.title === "string")
          .slice(0, 8)
          .map((row: any) => ({
            emoji: String(row.emoji || "•"),
            title: String(row.title || ""),
            duration: String(row.duration || "по записи"),
            price: String(row.price || "по запросу")
          }))
      });
      continue;
    }
    if (type === "team") {
      const rows = Array.isArray((item as any).items) ? (item as any).items : [];
      result.push({
        id: uid(),
        type: "team",
        variant: (item as any).variant === "list" ? "list" : "grid",
        items: rows.filter((row: any) => row && typeof row.name === "string").slice(0, 8).map((row: any) => ({ name: String(row.name || ""), role: String(row.role || "Специалист") }))
      });
      continue;
    }
    if (type === "reviews") {
      const rows = Array.isArray((item as any).items) ? (item as any).items : [];
      result.push({
        id: uid(),
        type: "reviews",
        variant: (item as any).variant === "quotes" ? "quotes" : "cards",
        items: rows.filter((row: any) => row && typeof row.text === "string").slice(0, 8).map((row: any) => ({ author: String(row.author || "Клиент"), text: String(row.text || "") }))
      });
      continue;
    }
    if (type === "faq") {
      const rows = Array.isArray((item as any).items) ? (item as any).items : [];
      result.push({
        id: uid(),
        type: "faq",
        variant: (item as any).variant === "list" ? "list" : "accordion",
        items: rows.filter((row: any) => row && typeof row.q === "string" && typeof row.a === "string").slice(0, 8).map((row: any) => ({ q: String(row.q || ""), a: String(row.a || "") }))
      });
      continue;
    }
    if (type === "booking") {
      result.push({ id: uid(), type: "booking", variant: "panel", primaryCta: String((item as any).primaryCta || fallback.primaryCta) });
      continue;
    }
    if (type === "contacts") {
      result.push({
        id: uid(),
        type: "contacts",
        variant: (item as any).variant === "minimal" ? "minimal" : "panel",
        line: String((item as any).line || fallback.contactLine)
      });
      continue;
    }
    if (type === "gallery") {
      result.push({
        id: uid(),
        type: "gallery",
        variant: (item as any).variant === "tiles" ? "tiles" : "masonry",
        title: String((item as any).title || "Галерея")
      });
    }
  }
  if (!result.length) return composeLayoutSpec(fallback);
  return result;
}

function composePageDsl(draft: Pick<DraftState, "businessName" | "styleLabel" | "primaryCta" | "contactLine" | "layoutSpec">): PageDslBlock[] {
  const rnd = seeded(hashString(`${draft.businessName}|${draft.styleLabel}|dsl`));
  const base = draft.layoutSpec.map((block) => {
    const next: PageDslBlock = { id: block.id, type: block.type, variant: (block as any).variant };
    if ("title" in block && typeof block.title === "string") next.title = block.title;
    if ("subtitle" in block && typeof block.subtitle === "string") next.subtitle = block.subtitle;
    if ("body" in block && typeof block.body === "string") next.body = block.body;
    if ("line" in block && typeof block.line === "string") next.line = block.line;
    if ("primaryCta" in block && typeof block.primaryCta === "string") next.primaryCta = block.primaryCta;
    if ("secondaryCta" in block && typeof block.secondaryCta === "string") next.secondaryCta = block.secondaryCta;
    if ("items" in block && Array.isArray((block as any).items)) next.items = ((block as any).items as Array<Record<string, string>>).slice(0, 12);
    return next;
  });

  const statsBlock: PageDslBlock = {
    id: uid(),
    type: "stats",
    variant: rnd() > 0.5 ? "inline" : "cards",
    items: [
      { label: "Скорость ответа", value: "< 2 мин" },
      { label: "Повторные клиенты", value: "72%" },
      { label: "Средний чек", value: "+18%" }
    ]
  };
  const ctaBlock: PageDslBlock = {
    id: uid(),
    type: "cta",
    variant: rnd() > 0.5 ? "centered" : "split",
    title: "Готовы зафиксировать удобное время?",
    subtitle: "Оставьте заявку и получите подтверждение в течение пары минут.",
    primaryCta: draft.primaryCta,
    secondaryCta: "Связаться в мессенджере"
  };
  const contactsBlock: PageDslBlock = {
    id: uid(),
    type: "contacts",
    variant: "panel",
    line: draft.contactLine
  };

  const withHero = base.some((b) => b.type === "hero") ? base : [{ id: uid(), type: "hero", variant: "centered", title: "Сайт под ваш запрос", subtitle: "Собран с нуля на базе AI-спека", primaryCta: draft.primaryCta, secondaryCta: "Подробнее" }, ...base];
  const next = [...withHero];
  if (!next.some((b) => b.type === "stats")) next.splice(Math.min(1, next.length), 0, statsBlock);
  if (!next.some((b) => b.type === "cta")) next.push(ctaBlock);
  if (!next.some((b) => b.type === "contacts")) next.push(contactsBlock);
  return next.slice(0, 24);
}

function normalizePageDsl(raw: unknown, fallback: DraftState): PageDslBlock[] {
  if (!Array.isArray(raw)) return composePageDsl(fallback);
  const allowedTypes = new Set(["hero", "about", "services", "team", "reviews", "faq", "booking", "contacts", "gallery", "stats", "cta", "text"]);
  const cleaned = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const inferredType = typeof item.type === "string" && item.type ? item.type.toLowerCase() : "text";
      const normalizedType = allowedTypes.has(inferredType) ? inferredType : "text";
      const block: PageDslBlock = {
        id: typeof item.id === "string" && item.id ? item.id : uid(),
        type: normalizedType
      };
      if (typeof item.variant === "string") block.variant = item.variant;
      if (typeof item.title === "string") block.title = item.title;
      if (typeof item.subtitle === "string") block.subtitle = item.subtitle;
      if (typeof item.body === "string") block.body = item.body;
      if (typeof item.line === "string") block.line = item.line;
      if (typeof item.primaryCta === "string") block.primaryCta = item.primaryCta;
      if (typeof item.secondaryCta === "string") block.secondaryCta = item.secondaryCta;
      if (Array.isArray(item.items)) {
        block.items = item.items
          .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
          .slice(0, 12)
          .map((row) => {
            const normalized: Record<string, string> = {};
            for (const [key, value] of Object.entries(row)) {
              if (typeof value === "string") normalized[key] = value;
            }
            return normalized;
          });
      }
      return block;
    })
    .slice(0, 24);
  if (!cleaned.length) return composePageDsl(fallback);
  const withEssentials = [...cleaned];
  if (!withEssentials.some((b) => b.type === "hero")) withEssentials.unshift({ id: uid(), type: "hero", variant: "centered", title: fallback.heroTitle, subtitle: fallback.heroSubtitle, primaryCta: fallback.primaryCta, secondaryCta: fallback.secondaryCta });
  if (!withEssentials.some((b) => b.type === "services")) withEssentials.push({ id: uid(), type: "services", variant: "cards", items: fallback.services.map((item) => ({ emoji: item.emoji, title: item.title, duration: item.duration, price: item.price })) });
  if (!withEssentials.some((b) => b.type === "cta")) withEssentials.push({ id: uid(), type: "cta", title: "Готовы начать?", subtitle: "Оставьте заявку и получите быстрый ответ.", primaryCta: fallback.primaryCta, secondaryCta: fallback.secondaryCta });
  if (!withEssentials.some((b) => b.type === "contacts")) withEssentials.push({ id: uid(), type: "contacts", line: fallback.contactLine });
  return withEssentials.slice(0, 24);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function wrapReactComponentForPreview(componentCode: string) {
  const sanitized = String(componentCode || "").trim();
  const escaped = sanitized
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="bg-slate-100">
  <div id="root"></div>
  <script type="text/babel" data-presets="typescript,react">
    const source = \`${escaped}\`;
    let cleaned = source.replace(/^\\s*import\\s+.*$/gm, "");
    window.__CF_COMPONENT__ = null;

    // Prefer explicit default export from model output.
    if (/export\\s+default\\s+/m.test(cleaned)) {
      cleaned = cleaned.replace(/export\\s+default\\s+/m, "const __CF_COMPONENT__ = ");
      cleaned += "\\nwindow.__CF_COMPONENT__ = __CF_COMPONENT__;";
    } else {
      // Fallback: infer component symbol name from function/const declaration.
      const fnMatch = cleaned.match(/function\\s+([A-Z][A-Za-z0-9_]*)\\s*\\(/);
      const constMatch = cleaned.match(/const\\s+([A-Z][A-Za-z0-9_]*)\\s*=\\s*/);
      const inferred = (fnMatch && fnMatch[1]) || (constMatch && constMatch[1]) || "";
      if (inferred) cleaned += "\\nwindow.__CF_COMPONENT__ = " + inferred + ";";
    }

    try {
      const transformed = Babel.transform(cleaned, {
        filename: "Site.tsx",
        presets: ["typescript", "react"]
      }).code;
      eval(transformed);
    } catch (e) {
      document.body.innerHTML = "<pre style='padding:16px;color:#b91c1c;white-space:pre-wrap'>Ошибка рендера React-кода\\n\\n" + String(e) + "</pre>";
    }

    const Component = window.__CF_COMPONENT__;
    if (typeof Component === "function") {
      const root = ReactDOM.createRoot(document.getElementById("root"));
      root.render(React.createElement(Component));
    } else if (!document.body.innerHTML.includes("Ошибка рендера")) {
      document.body.innerHTML = "<pre style='padding:16px;color:#b91c1c;white-space:pre-wrap'>Ошибка рендера React-кода\\n\\nКомпонент не найден. Ожидается export default function Site() { ... }</pre>";
    }
  </script>
</body>
</html>`;
}

function buildPageCode(draft: Pick<DraftState, "businessName" | "niche" | "city" | "accentColor" | "pageBg" | "surfaceBg" | "fontHeading" | "fontBody" | "density" | "radius" | "contrast" | "pageDsl">) {
  const radius = draft.radius === "rounded" ? 24 : draft.radius === "sharp" ? 10 : 16;
  const sectionPad = draft.density === "compact" ? "14px" : draft.density === "airy" ? "28px" : "20px";
  const borderColor = draft.contrast === "high" ? "rgba(15,23,42,.28)" : "rgba(148,163,184,.28)";
  const lowerNiche = `${draft.niche || ""}`.toLowerCase();
  const isComputerClub =
    lowerNiche.includes("computer") ||
    lowerNiche.includes("компьютер") ||
    lowerNiche.includes("кибер") ||
    lowerNiche.includes("gaming") ||
    lowerNiche.includes("esport");

  if (isComputerClub) {
    const hero = draft.pageDsl.find((block) => block.type === "hero");
    const services = draft.pageDsl.find((block) => block.type === "services")?.items || [];
    const stats = draft.pageDsl.find((block) => block.type === "stats")?.items || [
      { label: "Игровых мест", value: "50+" },
      { label: "Игр в библиотеке", value: "2000+" },
      { label: "Режим работы", value: "24/7" },
      { label: "Топ-железо", value: "RTX 4080" }
    ];
    const reviews = draft.pageDsl.find((block) => block.type === "reviews")?.items || [];
    const faq = draft.pageDsl.find((block) => block.type === "faq")?.items || [];
    const cta = draft.pageDsl.find((block) => block.type === "cta");
    const contacts = draft.pageDsl.find((block) => block.type === "contacts");
    const heroTitle = hero?.title || `${draft.businessName}: кибер-клуб с топовым железом`;
    const heroSubtitle = hero?.subtitle || `Мощное железо, честные цены и атмосферные игровые зоны в ${draft.city || "вашем городе"}.`;
    const primaryCta = hero?.primaryCta || cta?.primaryCta || "Забронировать место";
    const secondaryCta = hero?.secondaryCta || cta?.secondaryCta || "Смотреть зоны";
    const zones = services.length
      ? services
      : [
          { emoji: "🖥️", title: "Standard", duration: "RTX 4060 · 144 Hz", price: "от 120 ₽/час" },
          { emoji: "⚡", title: "PRO Zone", duration: "RTX 4070 Super · 240 Hz", price: "от 220 ₽/час" },
          { emoji: "👑", title: "VIP Solo", duration: "RTX 4080 · private room", price: "от 390 ₽/час" },
          { emoji: "🎮", title: "PlayStation 5", duration: "4K TV · до 4 игроков", price: "от 350 ₽/час" }
        ];
    const games = [
      { icon: "🔫", title: "Counter-Strike 2", subtitle: "Prime" },
      { icon: "⚔️", title: "Dota 2", subtitle: "Calibrated" },
      { icon: "💥", title: "Valorant", subtitle: "Ranked / Unrated" },
      { icon: "🚗", title: "GTA V Online", subtitle: "Rockstar account" },
      { icon: "🥊", title: "Mortal Kombat", subtitle: "PS5" },
      { icon: "🎯", title: "Warzone", subtitle: "Battle Royale" }
    ];
    const neonAccent = draft.accentColor || "#15c9ff";
    return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(draft.businessName)}</title>
  <style>
    :root { --accent: ${neonAccent}; --bg:#050816; --bg2:#090d22; --card:#0c122a; --line:rgba(88, 120, 255, .26); --txt:#eaf2ff; --muted:#9db1cf; }
    * { box-sizing: border-box; }
    html, body { margin:0; padding:0; font-family: ${draft.fontBody}, "Segoe UI", sans-serif; color: var(--txt); background:
      radial-gradient(1200px 700px at 10% -10%, rgba(21,201,255,.2), transparent 55%),
      radial-gradient(900px 600px at 100% 0%, rgba(124,58,237,.16), transparent 48%),
      linear-gradient(180deg, var(--bg), #06091a 40%, #050816);
    }
    .wrap { max-width: 1160px; margin: 0 auto; padding: 28px 20px 60px; }
    .nav { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(12px); background: rgba(4,8,22,.75); border-bottom: 1px solid rgba(148,163,184,.18); }
    .nav-inner { max-width: 1160px; margin: 0 auto; padding: 14px 20px; display:flex; align-items:center; justify-content:space-between; }
    .brand { font-weight: 800; letter-spacing: .02em; font-size: 32px; font-family: ${draft.fontHeading}, "Segoe UI", sans-serif; }
    .brand b { color: var(--accent); }
    .menu { display:flex; gap:24px; color:#d4e0f7; font-weight:600; font-size:15px; }
    .menu a { color:inherit; text-decoration:none; opacity:.88; }
    .btn { border:0; font:inherit; font-weight:700; border-radius: 12px; padding: 11px 18px; cursor:pointer; }
    .btn-primary { background: var(--accent); color:#04111b; box-shadow: 0 0 0 1px rgba(255,255,255,.08) inset, 0 14px 36px rgba(21,201,255,.25); }
    .btn-secondary { background: transparent; color: var(--txt); border:1px solid var(--line); }
    .hero { padding: 72px 0 44px; text-align:center; }
    .eyebrow { color: var(--accent); letter-spacing: .28em; text-transform: uppercase; font-size: 12px; font-weight: 700; margin:0 0 16px; }
    h1 { margin:0; font-family: ${draft.fontHeading}, "Segoe UI", sans-serif; font-size: clamp(44px, 8vw, 108px); line-height: .95; letter-spacing: -.02em; }
    .subtitle { max-width: 780px; margin: 24px auto 0; color: var(--muted); font-size: clamp(18px, 2.2vw, 36px); line-height: 1.35; }
    .cta-row { display:flex; justify-content:center; gap:12px; margin: 34px 0 0; flex-wrap:wrap; }
    .stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin: 28px 0 10px; }
    .stat { border:1px solid var(--line); border-radius: 14px; padding: 16px; background: linear-gradient(180deg, rgba(14,23,52,.72), rgba(9,13,34,.72)); }
    .stat .v { color: var(--accent); font-size: 36px; font-weight: 800; letter-spacing: -.02em; }
    .stat .l { color:#8ea4c9; font-size: 14px; margin-top: 6px; }
    .section { margin-top: 46px; border:1px solid var(--line); border-radius: 20px; padding: 26px; background: linear-gradient(180deg, rgba(12,18,42,.86), rgba(9,13,34,.9)); }
    .section h2 { margin:0 0 16px; font-size: clamp(30px, 4vw, 54px); line-height: 1.05; font-family: ${draft.fontHeading}, "Segoe UI", sans-serif; }
    .section .lead { margin:0 0 20px; color: var(--muted); font-size: 18px; }
    .zones { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:12px; }
    .zone { border:1px solid var(--line); border-radius: 14px; padding: 16px; background: rgba(5,8,22,.58); }
    .zone .title { margin: 8px 0 0; font-size: 24px; font-weight: 800; font-family: ${draft.fontHeading}, "Segoe UI", sans-serif; }
    .zone .meta { margin: 8px 0 0; color:#8ea4c9; font-size:14px; }
    .zone .price { margin: 12px 0 0; color: var(--accent); font-weight: 800; font-size: 30px; }
    .games { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:12px; }
    .game { border:1px solid var(--line); border-radius: 14px; padding: 14px; background: rgba(5,8,22,.58); }
    .game .title { margin-top:8px; font-size: 18px; font-weight:700; }
    .game .meta { margin-top: 6px; font-size: 14px; color:#8ea4c9; }
    .reviews { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:12px; }
    .review { border:1px solid var(--line); border-radius: 14px; padding: 16px; background: rgba(5,8,22,.58); color:#dbe7ff; line-height:1.6; }
    .review .author { margin-top: 10px; color: var(--accent); font-weight:700; font-size:14px; }
    .faq details { border-top:1px solid rgba(148,163,184,.2); padding:12px 0; }
    .faq summary { cursor:pointer; font-weight:700; color:#e7f1ff; }
    .faq p { margin:8px 0 0; color:#8ea4c9; line-height:1.55; }
    .booking { margin-top: 20px; display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
    .field { border:1px solid var(--line); border-radius: 10px; padding: 12px; background: rgba(5,8,22,.66); color:#dce8ff; }
    .full { grid-column: 1 / -1; }
    .footer { margin-top: 34px; text-align:center; color:#8ea4c9; line-height:1.7; }
    @media (max-width: 980px) {
      .menu { display:none; }
      .stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .zones { grid-template-columns:1fr 1fr; }
      .games { grid-template-columns:1fr 1fr; }
      .reviews { grid-template-columns:1fr; }
      .booking { grid-template-columns:1fr; }
    }
    @media (max-width: 640px) {
      .zones, .games, .stats { grid-template-columns:1fr; }
      .brand { font-size: 26px; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="nav-inner">
      <div class="brand"><b>${escapeHtml(draft.businessName.split(" ")[0] || draft.businessName)}</b> ${escapeHtml(draft.businessName.split(" ").slice(1).join(" ") || "Gaming Club")}</div>
      <div class="menu">
        <a href="#zones">Зоны</a><a href="#prices">Цены</a><a href="#games">Игры</a><a href="#reviews">Отзывы</a><a href="#faq">FAQ</a>
      </div>
      <button class="btn btn-primary">Записаться</button>
    </div>
  </nav>
  <main class="wrap">
    <section class="hero">
      <p class="eyebrow">${escapeHtml(draft.city || "Россия")} • Gaming Club</p>
      <h1>${escapeHtml(heroTitle)}</h1>
      <p class="subtitle">${escapeHtml(heroSubtitle)}</p>
      <div class="cta-row">
        <button class="btn btn-primary">${escapeHtml(primaryCta)}</button>
        <button class="btn btn-secondary">${escapeHtml(secondaryCta)}</button>
      </div>
      <div class="stats">
        ${stats
          .map((item) => `<div class="stat"><div class="v">${escapeHtml(item.value || "")}</div><div class="l">${escapeHtml(item.label || "")}</div></div>`)
          .join("")}
      </div>
    </section>

    <section id="zones" class="section">
      <h2>Выбери своё место</h2>
      <p class="lead">Игровые зоны под любой формат: катки с друзьями, турниры, стримы, консольные вечера.</p>
      <div class="zones">
        ${zones
          .map(
            (item) => `<article class="zone"><div>${escapeHtml(item.emoji || "🎮")}</div><p class="title">${escapeHtml(item.title || "")}</p><p class="meta">${escapeHtml(item.duration || "")}</p><p class="price">${escapeHtml(item.price || "")}</p></article>`
          )
          .join("")}
      </div>
    </section>

    <section id="games" class="section">
      <h2>2000+ игр</h2>
      <p class="lead">От соревновательных шутеров до больших кооперативных тайтлов.</p>
      <div class="games">${games
        .map((item) => `<article class="game"><div>${item.icon}</div><div class="title">${escapeHtml(item.title)}</div><div class="meta">${escapeHtml(item.subtitle)}</div></article>`)
        .join("")}</div>
    </section>

    <section id="prices" class="section">
      <h2>Тарифы</h2>
      <p class="lead">Гибкая сетка цен: будни, выходные и ночные пакеты.</p>
      <div class="zones">
        ${zones
          .map(
            (item) => `<article class="zone"><p class="title">${escapeHtml(item.title || "")}</p><p class="meta">${escapeHtml(item.duration || "по запросу")}</p><p class="price">${escapeHtml(item.price || "по запросу")}</p></article>`
          )
          .join("")}
      </div>
    </section>

    <section id="reviews" class="section">
      <h2>Отзывы</h2>
      <div class="reviews">
        ${(reviews.length ? reviews : [{ author: "Гость клуба", text: "Атмосфера мощная, железо топ, админы всегда на связи." }])
          .map((item) => `<article class="review">“${escapeHtml(item.text || "")}”<div class="author">${escapeHtml(item.author || "Клиент")}</div></article>`)
          .join("")}
      </div>
    </section>

    <section id="faq" class="section faq">
      <h2>FAQ</h2>
      ${(faq.length
        ? faq
        : [
            { q: "Можно забронировать зону заранее?", a: "Да, оставьте заявку и мы подтвердим слот в течение 10-15 минут." },
            { q: "Есть ли ночные тарифы?", a: "Да, доступны ночные пакеты с фиксированной ценой." }
          ]
      )
        .map((item) => `<details><summary>${escapeHtml(item.q || "")}</summary><p>${escapeHtml(item.a || "")}</p></details>`)
        .join("")}
    </section>

    <section class="section">
      <h2>${escapeHtml(cta?.title || "Забронируй место")}</h2>
      <p class="lead">${escapeHtml(cta?.subtitle || "Оставь контакт, и админ быстро подтвердит удобное время.")}</p>
      <div class="booking">
        <input class="field" placeholder="Твое имя или ник" />
        <input class="field" placeholder="Телефон / Telegram" />
        <select class="field full"><option>Выбери зону</option></select>
        <button class="btn btn-primary full">${escapeHtml(primaryCta)}</button>
      </div>
      <div class="footer">${escapeHtml(contacts?.line || `${draft.businessName} • ${draft.city || "Россия"}`)}</div>
    </section>
  </main>
</body>
</html>`;
  }

  const blocks = (draft.pageDsl || [])
    .map((block) => {
      if (block.type === "hero") {
        return `<section class="card ${block.variant === "split" ? "hero-split" : "hero"}">
  <div>
    <p class="eyebrow">${escapeHtml(draft.businessName)}</p>
    <h1>${escapeHtml(block.title || "Сайт вашего бизнеса")}</h1>
    <p class="sub">${escapeHtml(block.subtitle || "")}</p>
    <div class="cta-row">
      <button class="cta-primary">${escapeHtml(block.primaryCta || "Записаться")}</button>
      <button class="cta-secondary">${escapeHtml(block.secondaryCta || "Подробнее")}</button>
    </div>
  </div>
  ${block.variant === "split" ? `<div class="hero-aside">Индивидуальный layout сгенерирован AI</div>` : ""}
</section>`;
      }
      if (block.type === "services") {
        const items = (block.items || [])
          .map((item) => `<div class="tile"><p class="t">${escapeHtml(item.title || "")}</p><p class="m">${escapeHtml(item.duration || "")}</p><p class="p">${escapeHtml(item.price || "")}</p></div>`)
          .join("");
        return `<section class="card"><h2>Услуги</h2><div class="grid">${items}</div></section>`;
      }
      if (block.type === "reviews") {
        const items = (block.items || [])
          .map((item) => `<div class="tile"><p class="q">“${escapeHtml(item.text || "")}”</p><p class="m">${escapeHtml(item.author || "Клиент")}</p></div>`)
          .join("");
        return `<section class="card"><h2>Отзывы</h2><div class="grid">${items}</div></section>`;
      }
      if (block.type === "faq") {
        const items = (block.items || [])
          .map((item) => `<details class="faq"><summary>${escapeHtml(item.q || "")}</summary><p>${escapeHtml(item.a || "")}</p></details>`)
          .join("");
        return `<section class="card"><h2>FAQ</h2>${items}</section>`;
      }
      if (block.type === "stats") {
        const items = (block.items || [])
          .map((item) => `<div class="tile stat"><p class="m">${escapeHtml(item.label || "")}</p><p class="p">${escapeHtml(item.value || "")}</p></div>`)
          .join("");
        return `<section class="grid">${items}</section>`;
      }
      if (block.type === "cta") {
        return `<section class="card center"><h2>${escapeHtml(block.title || "Готовы начать?")}</h2><p class="sub">${escapeHtml(block.subtitle || "")}</p><div class="cta-row"><button class="cta-primary">${escapeHtml(block.primaryCta || "Записаться")}</button><button class="cta-secondary">${escapeHtml(block.secondaryCta || "Подробнее")}</button></div></section>`;
      }
      if (block.type === "contacts") {
        return `<section class="card"><h2>Контакты</h2><p>${escapeHtml(block.line || "")}</p></section>`;
      }
      return `<section class="card"><h2>${escapeHtml(block.title || "Раздел")}</h2><p>${escapeHtml(block.body || "Контент заполнен AI под ваш запрос.")}</p></section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(draft.businessName)}</title>
  <style>
    :root { --accent:${draft.accentColor}; --bg:${draft.pageBg}; --surface:${draft.surfaceBg}; --border:${borderColor}; --radius:${radius}px; --pad:${sectionPad}; --fontH:${draft.fontHeading}; --fontB:${draft.fontBody}; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: var(--fontB), sans-serif; background: var(--bg); color:#0f172a; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 24px; display: grid; gap: 14px; }
    .card { border:1px solid var(--border); background: var(--surface); border-radius: var(--radius); padding: var(--pad); }
    .hero { text-align: center; }
    .hero-split { display:grid; gap:16px; grid-template-columns: 1.2fr .8fr; align-items: stretch; }
    .hero-aside { border:1px dashed var(--border); border-radius: calc(var(--radius) - 4px); padding:16px; color:#475569; display:flex; align-items:center; justify-content:center; }
    .eyebrow { margin:0; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); font-size:11px; font-weight:700; }
    h1,h2 { font-family: var(--fontH), serif; margin: 0 0 10px; line-height: 1.15; }
    h1 { font-size: 44px; }
    h2 { font-size: 28px; }
    .sub { color:#475569; margin:0; line-height:1.55; }
    .grid { display:grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap:10px; }
    .tile { border:1px solid var(--border); border-radius: calc(var(--radius) - 6px); padding:12px; background:#fff; }
    .t { margin:0; font-weight:700; }
    .m { margin:6px 0 0; color:#64748b; font-size:13px; }
    .p { margin:8px 0 0; color:var(--accent); font-weight:700; font-size:20px; }
    .q { margin:0; line-height:1.5; }
    .faq { border-top:1px solid var(--border); padding:10px 0; }
    .faq summary { cursor:pointer; font-weight:700; }
    .faq p { color:#475569; margin:8px 0 0; }
    .cta-row { display:flex; gap:8px; flex-wrap: wrap; margin-top:14px; }
    button { border:0; font:inherit; cursor:pointer; }
    .cta-primary { background: var(--accent); color:#fff; border-radius:999px; padding:10px 16px; font-weight:700; }
    .cta-secondary { background:#fff; color:#0f172a; border-radius:999px; padding:10px 16px; border:1px solid var(--border); font-weight:700; }
    .center { text-align: center; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } .hero-split { grid-template-columns: 1fr; } h1{font-size:34px;} }
  </style>
</head>
<body>
  <main class="wrap">${blocks}</main>
</body>
</html>`;
}

function finalizeDraft(draft: DraftState): DraftState {
  const next = { ...draft };
  if (!next.layoutSpec.length) next.layoutSpec = composeLayoutSpec(next);
  if (!next.pageDsl.length) next.pageDsl = composePageDsl(next);
  next.pageCode = buildPageCode(next);
  return next;
}

function resolveBlockId(pageDsl: PageDslBlock[], ref: string): string | null {
  const token = ref.trim();
  if (!token) return null;
  const byId = pageDsl.find((block) => block.id === token);
  if (byId) return byId.id;
  const numeric = token.startsWith("#") ? Number(token.slice(1)) : Number(token);
  if (Number.isFinite(numeric) && numeric >= 1) {
    const block = pageDsl[Math.floor(numeric) - 1];
    if (block) return block.id;
  }
  return null;
}

function rewriteDslBlock(pageDsl: PageDslBlock[], blockId: string, instruction: string): { next: PageDslBlock[]; ok: boolean } {
  const targetId = resolveBlockId(pageDsl, blockId);
  if (!targetId) return { next: pageDsl, ok: false };
  const text = instruction.trim();
  const next = pageDsl.map((block) => {
    if (block.id !== targetId) return block;
    const updated = { ...block };
    const lowered = text.toLowerCase();
    const setField = (field: keyof PageDslBlock, value: string) => {
      (updated as any)[field] = value;
    };
    if (lowered.startsWith("title:")) {
      setField("title", text.slice("title:".length).trim());
    } else if (lowered.startsWith("subtitle:")) {
      setField("subtitle", text.slice("subtitle:".length).trim());
    } else if (lowered.startsWith("body:")) {
      setField("body", text.slice("body:".length).trim());
    } else if (lowered.startsWith("line:")) {
      setField("line", text.slice("line:".length).trim());
    } else if (lowered.startsWith("variant:")) {
      setField("variant", text.slice("variant:".length).trim());
    } else if (updated.title) {
      updated.title = text;
    } else if (updated.body) {
      updated.body = text;
    } else if (updated.subtitle) {
      updated.subtitle = text;
    } else if (updated.line) {
      updated.line = text;
    } else {
      updated.body = text;
    }
    return updated;
  });
  return { next, ok: true };
}

function moveDslBlock(pageDsl: PageDslBlock[], blockId: string, beforeId: string): { next: PageDslBlock[]; ok: boolean } {
  const sourceId = resolveBlockId(pageDsl, blockId);
  const targetId = resolveBlockId(pageDsl, beforeId);
  if (!sourceId || !targetId || sourceId === targetId) return { next: pageDsl, ok: false };
  const sourceIndex = pageDsl.findIndex((block) => block.id === sourceId);
  const targetIndex = pageDsl.findIndex((block) => block.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return { next: pageDsl, ok: false };

  const next = [...pageDsl];
  const [picked] = next.splice(sourceIndex, 1);
  const insertIndex = next.findIndex((block) => block.id === targetId);
  if (!picked || insertIndex < 0) return { next: pageDsl, ok: false };
  next.splice(insertIndex, 0, picked);
  return { next, ok: true };
}

const sectionKeywords: Array<{ key: SectionKey; words: string[] }> = [
  { key: "about", words: ["о нас", "about"] },
  { key: "services", words: ["услуг", "прайс", "цены"] },
  { key: "team", words: ["команд", "мастер", "специалист"] },
  { key: "reviews", words: ["отзыв", "кейсы"] },
  { key: "faq", words: ["faq", "вопрос", "вопросы"] },
  { key: "booking", words: ["запис", "бронь", "форма"] },
  { key: "contacts", words: ["контакт", "адрес", "телефон"] },
  { key: "gallery", words: ["галер", "фото", "портфолио"] }
];

function findMentionedSections(text: string) {
  const lower = text.toLowerCase();
  const found: SectionKey[] = [];
  for (const item of sectionKeywords) {
    if (item.words.some((word) => lower.includes(word))) found.push(item.key);
  }
  return Array.from(new Set(found));
}

function applySectionCommand(prev: DraftState, text: string): DraftState {
  const lower = text.toLowerCase();
  const mentioned = findMentionedSections(lower);
  if (!mentioned.length) return prev;

  const enableIntent = /(добав|включ|покажи|нужен|сделай)\b/i.test(lower);
  const disableIntent = /(убери|скрой|без)\b/i.test(lower);
  if (!enableIntent && !disableIntent) return prev;

  const nextEnabled = { ...prev.sectionsEnabled };
  for (const key of mentioned) {
    if (disableIntent) nextEnabled[key] = false;
    if (enableIntent) nextEnabled[key] = true;
  }

  const nextOrder = [...prev.sectionOrder];
  for (const key of mentioned) {
    if (enableIntent && !nextOrder.includes(key)) nextOrder.push(key);
  }

  return { ...prev, sectionsEnabled: nextEnabled, sectionOrder: nextOrder };
}

function normalizeBusinessName(raw: string) {
  return raw
    .replace(/["«»']/g, "")
    .replace(/\b(остальное|сделай|заполни|сам|и)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractBusinessName(text: string) {
  const byName = text.match(/(?:названи[ея]|name)\s*[:\-]?\s*["«]?([a-zа-я0-9][^"»\n,.]{1,42})["»]?/i);
  if (byName?.[1]) {
    const candidate = normalizeBusinessName(byName[1]);
    if (candidate.length >= 2) return candidate;
  }
  const byTypeAndName = text.match(/(?:клуб|барбершоп|салон|студия)\s+["«]?([a-zа-я0-9][a-zа-я0-9 .\-]{1,32})["»]?/i);
  if (byTypeAndName?.[1]) {
    const candidate = normalizeBusinessName(byTypeAndName[1]);
    if (candidate.length >= 2) return candidate;
  }
  const quoted = text.match(/["«]([^"»]{2,42})["»]/);
  if (quoted?.[1]) {
    const candidate = normalizeBusinessName(quoted[1]);
    if (candidate.length >= 2) return candidate;
  }
  return "";
}

function extractCity(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("обнинск")) return "Обнинск";
  if (lower.includes("моск")) return "Москва";
  if (lower.includes("спб") || lower.includes("питер") || lower.includes("санкт")) return "Санкт-Петербург";
  if (lower.includes("казан")) return "Казань";
  if (lower.includes("екб") || lower.includes("екатерин")) return "Екатеринбург";
  const explicit = text.match(/(?:город|в городе|локация)\s*[:\-]?\s*([a-zа-яё\- ]{2,40})/i);
  if (explicit?.[1]) return explicit[1].trim();
  const simple = text.match(/\bв\s+([a-zа-яё][a-zа-яё\-]{2,30})\b/i);
  if (simple?.[1]) return simple[1].trim();
  return "";
}

function extractNiche(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("компьютерн") || lower.includes("кибер") || lower.includes("игров") || lower.includes("esports")) return "Computer Club";
  if (lower.includes("барбер")) return "Barbershop";
  if (lower.includes("салон") || lower.includes("nails") || lower.includes("маник")) return "Nail Studio";
  if (lower.includes("клиник") || lower.includes("стомат")) return "Clinic";
  if (lower.includes("юрист") || lower.includes("адвокат")) return "Legal";
  const explicit = text.match(/(?:ниша|бизнес|проект|сайт для)\s*[:\-]?\s*([a-zа-яё0-9\- ]{2,60})/i);
  if (explicit?.[1]) return explicit[1].trim();
  return "";
}

function extractGoal(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("заяв")) return "Больше заявок";
  if (lower.includes("запис")) return "Больше онлайн-записей";
  if (lower.includes("звон")) return "Больше звонков";
  if (lower.includes("продаж")) return "Больше продаж";
  return "";
}

function extractStyle(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("преми") || lower.includes("дорог")) return "Премиальный";
  if (lower.includes("минимал")) return "Минимализм";
  if (lower.includes("строг")) return "Строгий";
  if (lower.includes("дружелюб")) return "Дружелюбный";
  return "";
}

function extractStyleReference(text: string) {
  const url = text.match(/https?:\/\/\S+/i);
  if (url?.[0]) return url[0];
  const byPattern = text.match(/(?:по примеру|как в|как у|в стиле)\s+([a-zа-я0-9][a-zа-я0-9 .,:_/"'«»\-()]{2,100})/i);
  if (byPattern?.[1]) return byPattern[1].trim();
  return "";
}

function extractMustHave(text: string) {
  const lower = text.toLowerCase();
  const must: string[] = [];
  if (lower.includes("онлайн") && lower.includes("запис")) must.push("Онлайн-запись");
  if (lower.includes("прайс") || lower.includes("цены")) must.push("Прайс");
  if (lower.includes("галер")) must.push("Галерея работ");
  if (lower.includes("отзыв")) must.push("Отзывы");
  if (lower.includes("команд") || lower.includes("мастер")) must.push("Команда");
  if (lower.includes("контакт")) must.push("Контакты");
  return must;
}

function parseProfileFromMessage(text: string): Partial<AgentProfile> {
  const businessName = extractBusinessName(text);
  const niche = extractNiche(text);
  const city = extractCity(text);
  const goal = extractGoal(text);
  const style = extractStyle(text);
  const styleReference = extractStyleReference(text);
  const mustHave = extractMustHave(text);
  return {
    businessName,
    niche,
    city,
    goal,
    style,
    styleReference,
    mustHave
  };
}

function mergeProfile(current: AgentProfile, patch: Partial<AgentProfile>): AgentProfile {
  const next: AgentProfile = { ...current };
  if (patch.businessName) next.businessName = patch.businessName;
  if (patch.niche) next.niche = patch.niche;
  if (patch.city) next.city = patch.city;
  if (patch.goal) next.goal = patch.goal;
  if (patch.style) next.style = patch.style;
  if (patch.styleReference) next.styleReference = patch.styleReference;
  if (patch.mustHave?.length) {
    next.mustHave = Array.from(new Set([...next.mustHave, ...patch.mustHave]));
  }
  return next;
}

function normalizeProfile(raw: Partial<AgentProfile>): AgentProfile {
  return {
    businessName: typeof raw.businessName === "string" ? raw.businessName : "",
    niche: typeof raw.niche === "string" ? raw.niche : "",
    city: typeof raw.city === "string" ? raw.city : "",
    goal: typeof raw.goal === "string" ? raw.goal : "",
    style: typeof raw.style === "string" ? raw.style : "",
    styleReference: typeof raw.styleReference === "string" ? raw.styleReference : "",
    mustHave: Array.isArray(raw.mustHave) ? raw.mustHave.map((item) => String(item)) : []
  };
}

function getMissingProfileFields(profile: AgentProfile) {
  const missing: Array<"businessName" | "niche" | "city"> = [];
  // We no longer hard-block generation by profile completeness.
  return missing;
}

function nextClarifyingQuestion(profile: AgentProfile) {
  if (!profile.businessName.trim()) return "Как называется ваш бизнес?";
  return "Опиши стиль, услуги и что важно на первом экране.";
}

function shouldForceGenerate(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("сделай сам") ||
    lower.includes("заполни сам") ||
    lower.includes("остальное сам") ||
    lower.includes("сам заполни")
  );
}

function createDraftFromProfile(profile: AgentProfile, guidance = "", round = 1): DraftState {
  const normalizedNiche = profile.niche || "Service";
  const isComputerClub =
    normalizedNiche.toLowerCase().includes("computer club") ||
    normalizedNiche.toLowerCase().includes("компьютер") ||
    normalizedNiche.toLowerCase().includes("кибер") ||
    normalizedNiche.toLowerCase().includes("esport");
  const isBarber = normalizedNiche.toLowerCase().includes("barber") || normalizedNiche.toLowerCase().includes("барбер");
  const isNails = normalizedNiche.toLowerCase().includes("nail") || normalizedNiche.toLowerCase().includes("салон");
  const isClinic = normalizedNiche.toLowerCase().includes("clinic") || normalizedNiche.toLowerCase().includes("клиник");

  const seed = hashString(`${profile.businessName}|${profile.niche}|${profile.city}|${profile.goal}|${profile.style}|${guidance}|${round}`);
  const rnd = seeded(seed);
  const styleContext = `${profile.style} ${profile.styleReference} ${guidance}`.toLowerCase();
  const preset =
    styleContext.includes("base44") || styleContext.includes("workspace")
      ? designPresets.find((item) => item.id === "workspace-ash") || designPresets[0]
      : styleContext.includes("dark") || styleContext.includes("темн")
      ? designPresets.find((item) => item.id === "noir-modern") || designPresets[0]
      : styleContext.includes("минимал")
      ? designPresets.find((item) => item.id === "noir-modern") || designPresets[0]
      : styleContext.includes("преми") || styleContext.includes("editorial")
      ? designPresets.find((item) => item.id === "editorial-rose") || designPresets[0]
      : pick(designPresets, rnd);

  const businessName = profile.businessName || (isComputerClub ? "AirDrop Arena" : isBarber ? "Noe Barbershop" : isNails ? "Nails Beauty" : "Studio Name");
  const nav = isComputerClub
    ? ["О нас", "Тарифы", "Залы", "Турниры", "Бронь"]
    : isBarber
    ? ["О нас", "Услуги", "Барберы", "Отзывы", "Запись"]
    : isNails
    ? ["О нас", "Услуги", "Команда", "Отзывы", "Запись"]
    : ["О нас", "Услуги", "Отзывы", "FAQ", "Контакты"];

  const barberServices = [
    { emoji: "✂️", title: "Стрижка мужская", duration: "60 мин", price: "1 800 ₽" },
    { emoji: "🧔", title: "Стрижка + борода", duration: "90 мин", price: "2 500 ₽" },
    { emoji: "💈", title: "Оформление бороды", duration: "45 мин", price: "1 200 ₽" },
    { emoji: "🔥", title: "Премиум-комплекс", duration: "120 мин", price: "3 500 ₽" }
  ];
  const nailsServices = [
    { emoji: "💅", title: "Маникюр классический", duration: "60 мин", price: "1 200 ₽" },
    { emoji: "✨", title: "Маникюр с покрытием", duration: "90 мин", price: "1 800 ₽" },
    { emoji: "🦶", title: "Педикюр", duration: "80 мин", price: "2 100 ₽" },
    { emoji: "💎", title: "Комплекс VIP", duration: "120 мин", price: "3 500 ₽" }
  ];
  const clinicServices = [
    { emoji: "🩺", title: "Первичная консультация", duration: "40 мин", price: "2 000 ₽" },
    { emoji: "🧪", title: "Диагностика", duration: "50 мин", price: "3 500 ₽" },
    { emoji: "📋", title: "План лечения", duration: "30 мин", price: "1 500 ₽" },
    { emoji: "✅", title: "Контрольный прием", duration: "25 мин", price: "1 200 ₽" }
  ];
  const computerClubServices = [
    { emoji: "🎮", title: "Игровое место Standard", duration: "1 час", price: "250 ₽" },
    { emoji: "🖥️", title: "VIP зона", duration: "1 час", price: "450 ₽" },
    { emoji: "🏆", title: "Турнирный пакет", duration: "3 часа", price: "990 ₽" },
    { emoji: "🌙", title: "Ночной пакет", duration: "8 часов", price: "1 490 ₽" }
  ];
  const base = isComputerClub ? computerClubServices : isBarber ? barberServices : isNails ? nailsServices : isClinic ? clinicServices : nailsServices;
  const services = base.map((item) => ({
    id: uid(),
    emoji: item.emoji,
    title: item.title,
    duration: item.duration,
    price: item.price
  }));

  const heroVariants = isComputerClub
    ? [
        "Компьютерный клуб, где комфорт и FPS на максимуме",
        "Современное игровое пространство для турниров и каток",
        "Киберклуб, куда приходят за атмосферой и уровнем"
      ]
    : isBarber
    ? [
        "Место, где стиль и сервис работают на тебя",
        "Барбершоп, куда возвращаются за уровнем и атмосферой",
        "Точная стрижка, сильный образ, сервис без компромиссов"
      ]
    : isNails
    ? [
        "Место, где сервис - это искусство",
        "Салон, где каждый визит выглядит как забота о себе",
        "Тонкая эстетика и высокий сервис в каждом касании"
      ]
    : [
        "Сервис, где качество чувствуется в каждой детали",
        "Точный процесс, понятный результат, сильная подача",
        "Современный сайт, который превращает интерес в запись"
      ];

  const heroSubtitle = [
    `Собрали индивидуальный сайт для ${businessName} в ${profile.city || "вашем городе"}.`,
    profile.goal ? `Фокус: ${profile.goal.toLowerCase()}.` : "Фокус на конверсии из первого экрана.",
    profile.style ? `Визуальный стиль: ${profile.style.toLowerCase()}.` : `Дизайн-концепт: ${preset.label}.`
    ,
    profile.styleReference ? `Референс: ${profile.styleReference}.` : ""
  ].join(" ");

  const mustHave = profile.mustHave.length ? profile.mustHave : ["Прайс", "Отзывы", "Онлайн-запись"];
  const sectionsEnabled: Record<SectionKey, boolean> = {
    about: true,
    services: true,
    team: mustHave.some((item) => item.toLowerCase().includes("команд")),
    reviews: mustHave.some((item) => item.toLowerCase().includes("отзыв")),
    faq: true,
    booking: true,
    contacts: true,
    gallery: mustHave.some((item) => item.toLowerCase().includes("галер"))
  };
  const allSections: SectionKey[] = ["about", "services", "team", "reviews", "faq", "booking", "contacts", "gallery"];
  const sectionOrder = allSections.filter((key) => sectionsEnabled[key]);

  const team = [
    { id: uid(), name: "Анастасия", role: isComputerClub ? "Администратор клуба" : isBarber ? "Барбер" : "Старший мастер" },
    { id: uid(), name: "Екатерина", role: isComputerClub ? "Менеджер зала" : isBarber ? "Барбер-стилист" : "Мастер" },
    { id: uid(), name: "Мария", role: isComputerClub ? "Организатор турниров" : isBarber ? "Администратор" : "Топ-специалист" }
  ];
  const reviews = [
    { id: uid(), author: "Клиент", text: "Очень понравился сервис и результат. Записалась онлайн за пару минут." },
    { id: uid(), author: "Постоянный клиент", text: "Сильная команда, аккуратная подача и всегда понятная коммуникация." }
  ];
  const summaryPoints = [
    "Индивидуальный первый экран с оффером и CTA",
    `Навигация под нишу: ${nav.join(", ")}`,
    `Секции под задачу: ${mustHave.join(", ")}`,
    `Дизайн-вариант: ${preset.label}`,
    "Готов к публикации и дальнейшей перегенерации"
  ];

  const nextDraft: DraftState = {
    businessName,
    city: profile.city || "Москва",
    niche: normalizedNiche,
    accentColor: preset.accent,
    pageBg: preset.pageBg,
    surfaceBg: preset.surfaceBg,
    headlineStyle: preset.headlineStyle,
    styleLabel: preset.label,
    heroTitle: pick(heroVariants, rnd),
    heroSubtitle,
    aboutTitle: "О нас",
    aboutBody:
      "Мы собрали структуру под ваш бизнес: понятный оффер, логичный путь к записи и контент, который работает на доверие и конверсию.",
    primaryCta: profile.goal.includes("звон") ? "Позвонить сейчас" : "Записаться",
    secondaryCta: "Открыть прайс",
    contactLine: `${businessName}, ${profile.city || "Москва"}`,
    navItems: nav,
    services,
    team,
    reviews,
    faq: [
      {
        id: uid(),
        q: "Как быстро можно записаться?",
        a: "Обычно на ближайшие слоты можно попасть в день обращения или на следующий день."
      },
      {
        id: uid(),
        q: "Можно поменять структуру и стиль?",
        a: "Да, можно перегенерировать дизайн и переписать контент под новый запрос в этом же чате."
      }
    ],
    sectionOrder,
    sectionsEnabled,
    summaryPoints,
    socialLinks: {},
    fontHeading: preset.headlineStyle === "serif" ? '"Playfair Display", Georgia, serif' : '"Inter", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    density: styleContext.includes("минимал") ? "airy" : "balanced",
    radius: styleContext.includes("workspace") ? "rounded" : "soft",
    contrast: styleContext.includes("dark") ? "high" : "medium",
    layoutSpec: [],
    pageDsl: [],
    componentCode: "",
    pageCode: ""
  };
  Object.assign(nextDraft, styleReferenceHints(`${profile.styleReference} ${guidance}`));
  return finalizeDraft(nextDraft);
}

function draftToPayload(draft: DraftState): PublishPayload {
  const ordered = draft.sectionOrder.filter((key) => draft.sectionsEnabled[key]);
  return {
    businessName: draft.businessName,
    city: draft.city,
    logoUrl: "",
    accentColor: draft.accentColor,
    baseColor: draft.pageBg || "#f8fafc",
    heroTitle: draft.heroTitle,
    heroSubtitle: draft.heroSubtitle,
    about: `${draft.aboutTitle}. ${draft.aboutBody}`,
    primaryCta: draft.primaryCta,
    secondaryCta: draft.secondaryCta,
    trustStats: [
      { label: "Скорость ответа", value: "< 2 мин" },
      { label: "Конверсия", value: "+28%" },
      { label: "Записей/мес", value: "200+" }
    ],
    valueProps: [],
    processSteps: ["Запрос", "Подбор", "Запись"],
    testimonials: [{ name: "Клиент", role: "Отзыв", text: "Очень удобно: быстро ответили и сразу предложили удобный слот." }],
    faq: draft.faq.map((item) => ({ q: item.q, a: item.a })),
    contactLine: draft.contactLine,
    products: draft.services.map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      description: `${item.duration}. Услуга с понятным результатом и аккуратной подачей.`,
      ctaText: draft.primaryCta,
      images: []
    })),
    sections: {
      about: draft.sectionsEnabled.about,
      valueProps: false,
      services: draft.sectionsEnabled.services,
      process: draft.sectionsEnabled.booking,
      gallery: draft.sectionsEnabled.gallery,
      testimonials: draft.sectionsEnabled.reviews,
      faq: draft.sectionsEnabled.faq,
      cabinet: true,
      contacts: draft.sectionsEnabled.contacts,
      map: false
    },
    sectionOrder: [...ordered, "cabinet"].map((key) => key.toString()),
    galleryUrls: [],
    cabinetEnabled: true,
    telegramBot: "@clientsflow_support_bot",
    socialLinks: draft.socialLinks,
    theme: {
      fontHeading: draft.fontHeading,
      fontBody: draft.fontBody,
      density: draft.density,
      radius: draft.radius,
      contrast: draft.contrast
    },
    layoutSpec: draft.layoutSpec,
    pageDsl: draft.pageDsl,
    pageCode: draft.pageCode
  };
}

function isSectionKey(value: string): value is SectionKey {
  return ["about", "services", "team", "reviews", "faq", "booking", "contacts", "gallery"].includes(value);
}

function normalizeSectionOrder(input: unknown, fallback: SectionKey[]) {
  if (!Array.isArray(input)) return fallback;
  const normalized = input
    .map((item) => (typeof item === "string" ? item : ""))
    .filter((item): item is SectionKey => isSectionKey(item));
  return normalized.length ? Array.from(new Set(normalized)) : fallback;
}

function normalizeSectionsEnabled(input: unknown, fallback: Record<SectionKey, boolean>) {
  if (!input || typeof input !== "object") return fallback;
  const next = { ...fallback };
  for (const key of Object.keys(next) as SectionKey[]) {
    const value = (input as any)[key];
    if (typeof value === "boolean") next[key] = value;
  }
  return next;
}

function normalizeAiDraftPatch(raw: any): Partial<DraftState> | null {
  if (!raw || typeof raw !== "object") return null;
  const patch: Partial<DraftState> = {};

  const strings: Array<keyof DraftState> = [
    "businessName",
    "city",
    "niche",
    "accentColor",
    "pageBg",
    "surfaceBg",
    "styleLabel",
    "heroTitle",
    "heroSubtitle",
    "aboutTitle",
    "aboutBody",
    "primaryCta",
    "secondaryCta",
    "contactLine",
    "fontHeading",
    "fontBody",
    "componentCode",
    "pageCode"
  ];
  for (const key of strings) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) (patch as any)[key] = value.trim();
  }

  if (raw.headlineStyle === "serif" || raw.headlineStyle === "sans") patch.headlineStyle = raw.headlineStyle;
  if (raw.density === "airy" || raw.density === "balanced" || raw.density === "compact") patch.density = raw.density;
  if (raw.radius === "soft" || raw.radius === "rounded" || raw.radius === "sharp") patch.radius = raw.radius;
  if (raw.contrast === "soft" || raw.contrast === "medium" || raw.contrast === "high") patch.contrast = raw.contrast;

  if (Array.isArray(raw.navItems)) {
    patch.navItems = raw.navItems.filter((item: unknown) => typeof item === "string" && item.trim()).slice(0, 8);
  }

  if (Array.isArray(raw.summaryPoints)) {
    patch.summaryPoints = raw.summaryPoints.filter((item: unknown) => typeof item === "string" && item.trim()).slice(0, 7);
  }

  if (Array.isArray(raw.services)) {
    patch.services = raw.services
      .filter((item: any) => item && typeof item.title === "string")
      .slice(0, 8)
      .map((item: any) => ({
        id: uid(),
        emoji: typeof item.emoji === "string" && item.emoji.trim() ? item.emoji.trim() : "•",
        title: item.title.trim(),
        duration: typeof item.duration === "string" && item.duration.trim() ? item.duration.trim() : "по записи",
        price: typeof item.price === "string" && item.price.trim() ? item.price.trim() : "по запросу"
      }));
  }

  if (Array.isArray(raw.team)) {
    patch.team = raw.team
      .filter((item: any) => item && typeof item.name === "string")
      .slice(0, 6)
      .map((item: any) => ({
        id: uid(),
        name: item.name.trim(),
        role: typeof item.role === "string" && item.role.trim() ? item.role.trim() : "Специалист"
      }));
  }

  if (Array.isArray(raw.reviews)) {
    patch.reviews = raw.reviews
      .filter((item: any) => item && typeof item.text === "string")
      .slice(0, 6)
      .map((item: any) => ({
        id: uid(),
        author: typeof item.author === "string" && item.author.trim() ? item.author.trim() : "Клиент",
        text: item.text.trim()
      }));
  }

  if (Array.isArray(raw.faq)) {
    patch.faq = raw.faq
      .filter((item: any) => item && typeof item.q === "string" && typeof item.a === "string")
      .slice(0, 8)
      .map((item: any) => ({
        id: uid(),
        q: item.q.trim(),
        a: item.a.trim()
      }));
  }

  if (typeof patch.componentCode === "string" && patch.componentCode.trim() && (!patch.pageCode || !String(patch.pageCode).trim())) {
    patch.pageCode = wrapReactComponentForPreview(patch.componentCode);
  }
  return patch;
}

function hydrateGeneratedDraft(raw: any, fallback: DraftState): DraftState {
  const patch = normalizeAiDraftPatch(raw);
  if (!patch) return fallback;
  const sectionsEnabled = normalizeSectionsEnabled(raw?.sectionsEnabled, fallback.sectionsEnabled);
  const sectionOrder = normalizeSectionOrder(raw?.sectionOrder, fallback.sectionOrder).filter((key) => sectionsEnabled[key]);
  const merged: DraftState = {
    ...fallback,
    ...patch,
    navItems: patch.navItems?.length ? patch.navItems : fallback.navItems,
    services: patch.services?.length ? patch.services : fallback.services,
    team: patch.team?.length ? patch.team : fallback.team,
    reviews: patch.reviews?.length ? patch.reviews : fallback.reviews,
    faq: patch.faq?.length ? patch.faq : fallback.faq,
    sectionOrder,
    sectionsEnabled,
    summaryPoints: patch.summaryPoints?.length ? patch.summaryPoints : fallback.summaryPoints,
    layoutSpec: [],
    pageDsl: [],
    componentCode: "",
    pageCode: ""
  };
  merged.layoutSpec = normalizeLayoutSpec(raw?.layoutSpec, merged);
  merged.pageDsl = normalizePageDsl(raw?.pageDsl, merged);
  const finalized = finalizeDraft(merged);
  if (typeof raw?.componentCode === "string" && raw.componentCode.trim()) finalized.componentCode = raw.componentCode;
  if (typeof raw?.pageCode === "string" && raw.pageCode.trim()) finalized.pageCode = raw.pageCode;
  // Strict code-first: when AI returns a component, preview must always render this component,
  // never the local HTML template produced by finalizeDraft/buildPageCode.
  if (finalized.componentCode?.trim()) {
    finalized.pageCode = wrapReactComponentForPreview(finalized.componentCode);
  }
  return finalized;
}

export default function ChatSitesBuilderPage({ onNavigate }: ChatSitesBuilderPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      text: "Окей, сайт соберу прямо в чате. Напиши нишу, город и что важно на первом экране.",
      time: nowTime(),
      tone: "default"
    }
  ]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [generationStatus, setGenerationStatus] = useState<BuilderStatus>("idle");
  const [paymentStatus, setPaymentStatus] = useState<BuilderStatus>("idle");
  const [publishStatus, setPublishStatus] = useState<BuilderStatus>("idle");
  const [publishPath, setPublishPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [workingText, setWorkingText] = useState("Saving in my memory...");
  const [publishingOverlay, setPublishingOverlay] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("Публикуем сайт...");
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [generationRound, setGenerationRound] = useState(1);
  const [generationEngine, setGenerationEngine] = useState<"openrouter" | "algorithm">("openrouter");
  const [generationSessionId, setGenerationSessionId] = useState(() => {
    if (typeof window === "undefined") return `session-${uid()}`;
    return sanitizeSessionId(localStorage.getItem(SITE_SESSION_STORAGE_KEY) || `session-${uid()}`);
  });
  const [generationHistory, setGenerationHistory] = useState<GenerationHistoryItem[]>([]);
  const [profile, setProfile] = useState<AgentProfile>({
    businessName: "",
    niche: "",
    city: "",
    goal: "",
    style: "",
    styleReference: "",
    mustHave: []
  });

  const canPublish = paymentStatus === "success" && publishStatus !== "loading" && !!draft;

  useEffect(() => {
    localStorage.setItem(SITE_SESSION_STORAGE_KEY, sanitizeSessionId(generationSessionId));
  }, [generationSessionId]);

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      if (!generationSessionId) return;
      try {
        const safeSessionId = sanitizeSessionId(generationSessionId);
        const endpoint = sitesGenerateEndpoint();
        const response = await fetch(`${endpoint}?sessionId=${encodeURIComponent(safeSessionId)}`);
        if (!response.ok) return;
        const body = (await response.json()) as { history?: GenerationHistoryItem[] };
        if (cancelled || !Array.isArray(body.history)) return;
        setGenerationHistory(body.history.slice(-8));
      } catch {
        // no-op: keep in-memory history
      }
    };
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [generationSessionId]);

  const addMessage = (role: ChatRole, text: string, tone: "default" | "soft" = "default") => {
    setMessages((prev) => [...prev, { id: uid(), role, text, time: nowTime(), tone }]);
  };

  const generateFromProfile = async (nextProfile: AgentProfile, guidance: string, nextRound: number, currentDraft?: DraftState | null) => {
    setError(null);
    setGenerationStatus("loading");
    setPaymentStatus("idle");
    setPublishStatus("idle");
    setPublishPath("");
    setIsWorking(true);
    setWorkingText("Saving in my memory...");

    addMessage("assistant", "Окей, понял задачу. Делаю структуру и дизайн под твой запрос.", "soft");
    setWorkingText("Updating pages...");

    let debugStage = "init";
    let debugEndpoint = "";
    let debugSession = sanitizeSessionId(generationSessionId);
    try {
      const requestGeneration = async (sessionId: string) => {
        const endpoint = sitesGenerateEndpoint();
        debugEndpoint = endpoint;
        try {
          debugStage = "fetch_request";
          return await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sanitizeSessionId(sessionId),
              profile: nextProfile,
              guidance,
              round: nextRound,
              target: "react-tailwind",
              currentPageCode: currentDraft?.pageCode || "",
              currentComponentCode: currentDraft?.componentCode || "",
              currentBusinessName: currentDraft?.businessName || ""
            })
          });
        } catch (error: any) {
          const name = String(error?.name || "FetchError");
          const message = String(error?.message || "request_failed");
          throw new Error(`request_failed:${name}:${message}:endpoint=${endpoint}:session=${sanitizeSessionId(sessionId)}`);
        }
      };

      let response: Response;
      try {
        debugStage = "first_attempt";
        response = await requestGeneration(sanitizeSessionId(generationSessionId));
      } catch {
        const freshSessionId = `session-${uid()}`;
        const safeFreshSessionId = sanitizeSessionId(freshSessionId);
        setGenerationSessionId(safeFreshSessionId);
        debugSession = safeFreshSessionId;
        debugStage = "retry_attempt";
        response = await requestGeneration(safeFreshSessionId);
      }

      debugStage = "read_body";
      const parsed = await parseJsonResponseSafe(response);
      if (!parsed.ok) {
        const snippet = parsed.rawText.replace(/\s+/g, " ").trim().slice(0, 220);
        throw new Error(
          `invalid_json_response:status=${parsed.status}:contentType=${parsed.contentType || "n/a"}:parse=${parsed.parseError}:snippet=${snippet}`
        );
      }
      const body = parsed.body as {
        error?: string;
        debug?: unknown;
        sessionId?: string;
        engine?: "openrouter" | "algorithm";
        draft?: unknown;
        history?: Array<{ id: string; round: number; engine: "openrouter" | "algorithm"; createdAt: string }>;
        stages?: Array<{ id: string; ms: number; source: string }>;
        candidates?: Array<{ id: string; engine: "openrouter" | "algorithm"; score: number; label: string }>;
        selectedCandidateId?: string;
      };

      if (!response.ok) {
        const debugText =
          body.debug && typeof body.debug === "object" ? JSON.stringify(body.debug) : body.debug ? String(body.debug) : "";
        debugStage = "response_not_ok";
        throw new Error(debugText ? `${body.error || "AI generation request failed"} | debug: ${debugText}` : body.error || "AI generation request failed");
      }

      if (body.sessionId) setGenerationSessionId(body.sessionId);
      if (body.engine !== "openrouter" || !body.draft) {
        debugStage = "invalid_ai_draft";
        throw new Error("AI engine did not return a valid draft");
      }
      const hasRawComponentCode =
        typeof (body.draft as { componentCode?: unknown }).componentCode === "string" &&
        String((body.draft as { componentCode?: unknown }).componentCode || "").trim().length > 0;
      if (!hasRawComponentCode) {
        debugStage = "missing_component_code";
        throw new Error("AI returned draft without componentCode");
      }
      debugStage = "hydrate_draft";
      const fallbackDraft = createDraftFromProfile(nextProfile, guidance, nextRound);
      const finalDraft = hydrateGeneratedDraft(body.draft, fallbackDraft);
      if (Array.isArray(body.history)) setGenerationHistory(body.history);
      setGenerationEngine("openrouter");
      setDraft(finalDraft);
      setGenerationRound(nextRound);
      setProfile(nextProfile);
      const summary = ["• Сгенерирован React+Tailwind код", "• Preview рендерится из этого же кода в iframe", "• Raw code доступен под превью"].join("\n");
      addMessage(
        "assistant",
        `Готово. Собрал индивидуальный вариант #${nextRound}.\n\nЧто уже есть:\n${summary}\n\nЕсли нужно, напиши «перегенерируй» — сделаю новый дизайн с нуля под тот же бриф.`
      );
      setGenerationStatus("success");
    } catch (error: any) {
      const message = String(error?.message || "AI generation failed");
      const userMessage = humanizeGenerationError(message);
      const debugTrace = `stage=${debugStage}; endpoint=${debugEndpoint || "n/a"}; session=${debugSession}; raw=${message}`;
      setGenerationStatus("error");
      setError(`${userMessage}\n\nDEBUG: ${debugTrace}`);
      addMessage(
        "assistant",
        `Не смог собрать сайт через AI: ${userMessage}\n\nDEBUG: ${debugTrace}`,
        "soft"
      );
    } finally {
      setIsWorking(false);
    }
  };

  const restoreRound = async (targetRound: number) => {
    if (targetRound < 1) {
      addMessage("assistant", "Нельзя откатиться ниже первого варианта.", "soft");
      return;
    }
    setGenerationStatus("loading");
    setIsWorking(true);
    setWorkingText(`Восстанавливаю вариант #${targetRound}...`);
    try {
      const safeSessionId = sanitizeSessionId(generationSessionId);
      const endpoint = sitesGenerateEndpoint();
      const response = await fetch(`${endpoint}?sessionId=${encodeURIComponent(safeSessionId)}`);
      if (!response.ok) {
        addMessage("assistant", "История сейчас недоступна. Попробуй чуть позже.", "soft");
        return;
      }
      const body = (await response.json()) as {
        history?: Array<{
          id: string;
          round: number;
          engine: "openrouter" | "algorithm";
          createdAt: string;
          profile: AgentProfile;
          draft: unknown;
        }>;
      };
      if (!Array.isArray(body.history)) {
        addMessage("assistant", "История вернулась в неверном формате.", "soft");
        return;
      }
      setGenerationHistory(body.history.map((item) => ({ id: item.id, round: item.round, engine: item.engine, createdAt: item.createdAt })).slice(-8));
      const record = body.history.find((item) => item.round === targetRound);
      if (!record) {
        addMessage("assistant", `Вариант #${targetRound} не найден.`, "soft");
        return;
      }
      const restoredProfile = normalizeProfile(record.profile);
      const fallback = createDraftFromProfile(restoredProfile, `restore-${targetRound}`, targetRound);
      const restored = hydrateGeneratedDraft(record.draft, fallback);
      setDraft(restored);
      setProfile(restoredProfile);
      setGenerationRound(targetRound);
      setGenerationEngine(record.engine);
      addMessage("assistant", `Готово. Восстановил вариант #${targetRound}.`, "soft");
    } catch {
      addMessage("assistant", "Не удалось восстановить версию из истории.", "soft");
    } finally {
      setGenerationStatus("success");
      setIsWorking(false);
    }
  };

  const onSend = (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    addMessage("user", text);
    setInput("");
    setError(null);

    const dsl = parseDslCommand(text);
    if (dsl.kind !== "none") {
      if (!draft && dsl.kind !== "regenerate") {
        addMessage("assistant", "Сначала сгенерируй первый вариант сайта, затем применяй DSL-команды.", "soft");
        return;
      }
      if (dsl.kind === "regenerate") {
        const merged = mergeProfile(profile, parseProfileFromMessage(dsl.guidance || text));
        void generateFromProfile(merged, dsl.guidance || text, generationRound + 1, draft);
        return;
      }
      if (dsl.kind === "styleLike") {
        const merged = mergeProfile(profile, { styleReference: dsl.reference });
        void generateFromProfile(merged, `Сделай дизайн по примеру: ${dsl.reference}`, generationRound + 1, draft);
        return;
      }
      if (dsl.kind === "undo") {
        void restoreRound(generationRound - 1);
        return;
      }
      if (dsl.kind === "revert") {
        void restoreRound(dsl.round);
        return;
      }
      if (dsl.kind === "rewriteBlock") {
        if (!draft) {
          addMessage("assistant", "Сначала сгенерируй сайт.", "soft");
          return;
        }
        const updated = rewriteDslBlock(draft.pageDsl, dsl.blockId, dsl.instruction);
        if (!updated.ok) {
          addMessage("assistant", "Блок не найден. Используй id из строки Blocks: #n:id.", "soft");
          return;
        }
        setDraft((prev) => (prev ? finalizeDraft({ ...prev, pageDsl: updated.next }) : prev));
        addMessage("assistant", "Блок обновлен по DSL-команде.", "soft");
        return;
      }
      if (dsl.kind === "moveBlock") {
        if (!draft) {
          addMessage("assistant", "Сначала сгенерируй сайт.", "soft");
          return;
        }
        const moved = moveDslBlock(draft.pageDsl, dsl.blockId, dsl.beforeId);
        if (!moved.ok) {
          addMessage("assistant", "Не удалось переставить блоки. Проверь id в строке Blocks: #n:id.", "soft");
          return;
        }
        setDraft((prev) => (prev ? finalizeDraft({ ...prev, pageDsl: moved.next }) : prev));
        addMessage("assistant", "Порядок блоков обновлен.", "soft");
        return;
      }
      if (dsl.kind === "addSection") {
        setDraft((prev) => {
          if (!prev) return prev;
          const nextEnabled = { ...prev.sectionsEnabled, [dsl.section]: true };
          const nextOrder = prev.sectionOrder.includes(dsl.section) ? prev.sectionOrder : [...prev.sectionOrder, dsl.section];
          const nextDraft = { ...prev, sectionsEnabled: nextEnabled, sectionOrder: nextOrder };
          return finalizeDraft(nextDraft);
        });
        addMessage("assistant", `Секция ${dsl.section} включена.`, "soft");
        return;
      }
      if (dsl.kind === "removeSection") {
        setDraft((prev) => {
          if (!prev) return prev;
          const nextEnabled = { ...prev.sectionsEnabled, [dsl.section]: false };
          const nextOrder = prev.sectionOrder.filter((item) => item !== dsl.section);
          const nextDraft = { ...prev, sectionsEnabled: nextEnabled, sectionOrder: nextOrder };
          return finalizeDraft(nextDraft);
        });
        addMessage("assistant", `Секция ${dsl.section} выключена.`, "soft");
        return;
      }
      if (dsl.kind === "rewriteHero") {
        if (!dsl.text) {
          addMessage("assistant", "Используй формат: /rewrite-hero <новый оффер>.", "soft");
          return;
        }
        setDraft((prev) => {
          if (!prev) return prev;
          const nextDraft = { ...prev, heroTitle: dsl.text };
          return finalizeDraft(nextDraft);
        });
        addMessage("assistant", "Hero-заголовок обновлен.", "soft");
        return;
      }
    }

    const profilePatch = parseProfileFromMessage(text);
    const mergedProfile = mergeProfile(profile, profilePatch);

    if (!draft) {
      void generateFromProfile(mergedProfile, text, 1, draft);
      return;
    }

    if (detectCapabilityQuestion(text)) {
      addMessage(
        "assistant",
        "Я могу: перегенерировать сайт под новый стиль, поправить блоки и тексты, и сразу показать результат в preview. Напиши, например: «сделай более минималистично» или «добавь блок тарифов».",
        "soft"
      );
      return;
    }

    if (detectRegenerateIntent(text) || detectRestyleIntent(text)) {
      void generateFromProfile(mergedProfile, text, generationRound + 1, draft);
      return;
    }

    if (detectCopyToneIntent(text) || detectAiEditIntent(text)) {
      void generateFromProfile(mergedProfile, text, generationRound + 1, draft);
      return;
    }

    void generateFromProfile(mergedProfile, text, generationRound + 1, draft);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSend(input);
  };

  const handleMockPayment = () => {
    if (!draft) {
      setError("Сначала создай сайт через чат.");
      return;
    }
    setPaymentStatus("loading");
    window.setTimeout(() => {
      setPaymentStatus("success");
      addMessage("assistant", "Оплата подтверждена. Теперь можно публиковать.", "soft");
    }, 700);
  };

  const handlePublish = async () => {
    if (!draft) {
      setError("Сначала создай сайт через чат.");
      return;
    }
    if (paymentStatus !== "success") {
      setError("Перед публикацией нужно оплатить.");
      return;
    }

    setError(null);
    setPublishStatus("loading");
    setPublishingOverlay(true);
    setOverlayMessage("Публикуем сайт в облаке...");

    const payload = draftToPayload(draft);

    try {
      const response = await fetch("/api/sites/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as { path?: string; slug?: string; error?: string };
      const path = body.path || (body.slug ? `/s/${body.slug}` : "");
      if (!response.ok || !path) throw new Error(body.error || "Не удалось опубликовать");

      setPublishPath(path);
      setPublishStatus("success");
      setOverlayMessage("Сайт опубликован. Открываем...");
      window.setTimeout(() => {
        setPublishingOverlay(false);
        onNavigate(path);
      }, PUBLISH_REDIRECT_DELAY_MS);
    } catch {
      try {
        setOverlayMessage("Облако недоступно. Включаем локальную публикацию...");
        const localSlug = `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        localStorage.setItem(`${LOCAL_PUBLISHED_SITE_PREFIX}${localSlug}`, JSON.stringify({ slug: localSlug, payload }));
        const localPath = `/s/${localSlug}`;
        setPublishPath(localPath);
        setPublishStatus("success");
        setOverlayMessage("Локальная ссылка готова. Открываем...");
        window.setTimeout(() => {
          setPublishingOverlay(false);
          onNavigate(localPath);
        }, PUBLISH_REDIRECT_DELAY_MS);
      } catch {
        setPublishStatus("error");
        setPublishingOverlay(false);
        setError("Публикация не удалась. Попробуйте снова.");
      }
    }
  };

  const previewPanel = (
    <div className="flex h-full flex-col">
      <div className="rounded-[22px] border border-slate-200/90 bg-white p-4 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-900">Live Preview</p>
          <button
            type="button"
            onClick={() => setPreviewExpanded((prev) => !prev)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            {previewExpanded ? "⌃ Hide preview" : "⌄ Show preview"}
          </button>
        </div>

        <div className="mt-3">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
            Engine: {generationEngine} · React+Tailwind
          </span>
        </div>
        {generationHistory.length > 0 ? (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Варианты: {generationHistory.map((item) => `#${item.round} (${item.engine})`).join(" · ")}
          </div>
        ) : null}

        {previewExpanded ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#eef1f6] px-4 py-2 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-2 truncate">https://preview.clientsflow.app/Home</span>
              </div>
              <span>↗</span>
            </div>

            <div className="border-b border-slate-200 bg-white p-2">
              <iframe
                title="Generated code preview"
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
                srcDoc={draft?.pageCode || ""}
                className="h-[520px] w-full rounded-xl border border-slate-200 bg-white"
              />
              <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                  Generated React+Tailwind Code
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 text-[11px] leading-5 text-slate-700">
{draft?.componentCode || draft?.pageCode || ""}
                </pre>
              </details>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const timeline = useMemo(() => {
    const rows: Array<{ key: string; node: JSX.Element }> = [];

    messages.forEach((message) => {
      if (message.role === "assistant") {
        rows.push({
          key: message.id,
          node: (
            <div className="flex gap-3">
              <div className="mt-2 h-3.5 w-3.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 shadow-[0_0_0_3px_rgba(56,189,248,.14)]" />
              <div className={`rounded-3xl border px-5 py-3 shadow-[0_22px_50px_-40px_rgba(15,23,42,.45)] transition ${message.tone === "soft" ? "border-slate-200 bg-white/85" : "border-slate-200 bg-white"}`}>
                <p className="text-base leading-[1.35] text-slate-800">{message.text}</p>
                <p className="mt-2 text-xs text-slate-500">{message.time}</p>
              </div>
            </div>
          )
        });
      } else {
        rows.push({
          key: message.id,
          node: (
            <div className="ml-auto max-w-[78%]">
              <div className="mb-1 flex items-center justify-end gap-2 text-sm font-semibold text-slate-500">
                <span>You</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-700">U</span>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-[0_22px_50px_-40px_rgba(15,23,42,.45)] transition">
                <p className="text-base leading-[1.35] text-slate-900">{message.text}</p>
                <p className="mt-2 text-xs text-slate-500">{message.time}</p>
              </div>
            </div>
          )
        });
      }
    });

    if (isWorking) {
      rows.push({
        key: "working",
        node: (
          <div className="flex gap-3">
            <div className="mt-2 h-3.5 w-3.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 shadow-[0_0_0_3px_rgba(56,189,248,.14)]" />
            <div>
              <p className="flex items-center gap-1 text-base font-medium text-slate-500">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                Working...
              </p>
              <div className="mt-1 rounded-3xl border border-slate-200 bg-white/80 px-5 py-3 shadow-[0_20px_50px_-42px_rgba(15,23,42,.45)]">
                <p className="text-sm text-slate-500">{workingText}</p>
              </div>
            </div>
          </div>
        )
      });
    }

    return rows;
  }, [messages, isWorking, workingText]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#edf8ff]">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-80" style={{ backgroundImage: "radial-gradient(circle at 20% 8%, rgba(56,189,248,.18), transparent 24%), radial-gradient(circle at 80% 80%, rgba(14,165,233,.16), transparent 26%)" }} />
      <div className="mx-auto flex min-h-screen w-full max-w-[1820px]">
        <aside className="relative hidden w-[290px] border-r border-sky-100 bg-white/85 p-4 backdrop-blur md:flex md:flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-sky-500 to-cyan-600 text-white">◈</div>
              <div>
                <p className="text-lg font-semibold text-slate-900">CFlow Agent</p>
                <p className="text-sm text-slate-500">Website Builder</p>
              </div>
            </div>
            <button type="button" className="rounded-lg p-2 text-sm text-slate-600 transition hover:bg-slate-100">◫</button>
          </div>

          <div className="mt-5 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                  item.key === "create-site"
                    ? "bg-gradient-to-r from-sky-100 to-cyan-50 shadow-[inset_0_0_0_1px_rgba(56,189,248,.35)]"
                    : "hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 text-base text-slate-800">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                <span className="text-base text-slate-500">›</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="relative flex min-h-screen flex-1 flex-col">
          <div className="mx-auto w-full max-w-[980px] px-4 pb-44 pt-7 sm:px-8">
            <div className="mb-6 flex items-center gap-4 text-xs font-semibold text-slate-500">
              <div className="h-px flex-1 bg-slate-300" />
              <span>Today</span>
              <div className="h-px flex-1 bg-slate-300" />
            </div>

            <div className="space-y-4">{timeline.map((row) => <div key={row.key}>{row.node}</div>)}</div>

            <div className="mt-6 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSend(prompt)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
          </div>

          <div className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-1rem)] max-w-[980px] -translate-x-1/2 sm:bottom-6">
            <form
              onSubmit={onSubmit}
              className="flex items-center gap-2 rounded-[22px] border border-sky-300 bg-white/96 px-3 py-2 shadow-[0_24px_65px_-44px_rgba(14,165,233,.35)] backdrop-blur transition focus-within:shadow-[0_28px_70px_-40px_rgba(14,165,233,.55)]"
            >
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-xl text-slate-700 transition hover:bg-slate-100">+</button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="h-11 flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg text-slate-700 transition hover:bg-slate-100">◉</button>
              <button type="submit" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-sm text-white transition hover:bg-sky-600">➤</button>
            </form>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-semibold">Быстро</span>
              {suggestions.map((item) => (
                <button key={item} type="button" onClick={() => onSend(item)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 transition hover:border-slate-300 hover:bg-slate-50">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </main>

        <aside className="hidden w-[760px] border-l border-slate-200/80 bg-[#f5f5f6] p-4 xl:block">{previewPanel}</aside>
      </div>

      <button
        type="button"
        onClick={() => setShowPreviewMobile(true)}
        className="fixed bottom-24 right-4 z-40 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg xl:hidden"
      >
        Open preview
      </button>

      {showPreviewMobile ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40 p-3 xl:hidden">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f5f5f6]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              <button type="button" onClick={() => setShowPreviewMobile(false)} className="rounded border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-700">
                Закрыть
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{previewPanel}</div>
          </div>
        </div>
      ) : null}

      {publishingOverlay ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-300" />
            <p className="mt-4 text-sm font-semibold text-white">{overlayMessage}</p>
            <p className="mt-2 text-xs text-slate-300">Подготавливаем ссылку для вашего сайта.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
