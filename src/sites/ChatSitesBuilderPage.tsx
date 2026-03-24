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
  const [command, ...restParts] = raw.slice(1).split(" ");
  const rest = restParts.join(" ").trim();
  const cmd = command.toLowerCase();

  if (cmd === "regenerate") return { kind: "regenerate", guidance: rest };
  if (cmd === "style-like") return rest ? { kind: "styleLike", reference: rest } : { kind: "none" };
  if (cmd === "undo") return { kind: "undo" };
  if (cmd === "revert") {
    const round = Number(rest);
    return Number.isFinite(round) && round > 0 ? { kind: "revert", round: Math.floor(round) } : { kind: "none" };
  }
  if (cmd === "add-section") {
    const section = parseSectionArg(rest);
    return section ? { kind: "addSection", section } : { kind: "none" };
  }
  if (cmd === "remove-section") {
    const section = parseSectionArg(rest);
    return section ? { kind: "removeSection", section } : { kind: "none" };
  }
  if (cmd === "rewrite-hero") return { kind: "rewriteHero", text: rest };
  if (cmd === "rewrite-block") {
    const [blockId, ...instructionParts] = rest.split(" ");
    const instruction = instructionParts.join(" ").trim();
    return blockId && instruction ? { kind: "rewriteBlock", blockId: blockId.trim(), instruction } : { kind: "none" };
  }
  if (cmd === "move-block") {
    const parts = rest.split(" ").filter(Boolean);
    const beforeIndex = parts.findIndex((part) => part.toLowerCase() === "before");
    if (beforeIndex > 0 && beforeIndex < parts.length - 1) {
      const blockId = parts.slice(0, beforeIndex).join(" ").trim();
      const beforeId = parts.slice(beforeIndex + 1).join(" ").trim();
      if (blockId && beforeId) return { kind: "moveBlock", blockId, beforeId };
    }
    return { kind: "none" };
  }
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
  const cleaned = raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => {
      const block: PageDslBlock = {
        id: typeof item.id === "string" && item.id ? item.id : uid(),
        type: typeof item.type === "string" && item.type ? item.type : "text"
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
  return cleaned;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPageCode(draft: Pick<DraftState, "businessName" | "accentColor" | "pageBg" | "surfaceBg" | "fontHeading" | "fontBody" | "density" | "radius" | "contrast" | "pageDsl">) {
  const radius = draft.radius === "rounded" ? 24 : draft.radius === "sharp" ? 10 : 16;
  const sectionPad = draft.density === "compact" ? "14px" : draft.density === "airy" ? "28px" : "20px";
  const borderColor = draft.contrast === "high" ? "rgba(15,23,42,.28)" : "rgba(148,163,184,.28)";
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
      return `<section class="card"><h2>${escapeHtml(block.title || "Блок")}</h2><p>${escapeHtml(block.body || "")}</p></section>`;
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
  const quoted = text.match(/["«]([^"»]{2,42})["»]/);
  if (quoted?.[1]) {
    const candidate = normalizeBusinessName(quoted[1]);
    if (candidate.length >= 2) return candidate;
  }
  return "";
}

function extractCity(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("моск")) return "Москва";
  if (lower.includes("спб") || lower.includes("питер") || lower.includes("санкт")) return "Санкт-Петербург";
  if (lower.includes("казан")) return "Казань";
  if (lower.includes("екб") || lower.includes("екатерин")) return "Екатеринбург";
  const explicit = text.match(/(?:город|в городе|локация)\s*[:\-]?\s*([a-zа-яё\- ]{2,40})/i);
  if (explicit?.[1]) return explicit[1].trim();
  const simple = text.match(/\bв\s+([A-ZА-ЯЁ][a-zа-яё\-]{2,30})\b/);
  if (simple?.[1]) return simple[1].trim();
  return "";
}

function extractNiche(text: string) {
  const lower = text.toLowerCase();
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

  const businessName = profile.businessName || (isBarber ? "Noe Barbershop" : isNails ? "Nails Beauty" : "Studio Name");
  const nav = isBarber
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
  const base = isBarber ? barberServices : isNails ? nailsServices : isClinic ? clinicServices : nailsServices;
  const services = base.map((item) => ({
    id: uid(),
    emoji: item.emoji,
    title: item.title,
    duration: item.duration,
    price: item.price
  }));

  const heroVariants = isBarber
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
    { id: uid(), name: "Анастасия", role: isBarber ? "Барбер" : "Старший мастер" },
    { id: uid(), name: "Екатерина", role: isBarber ? "Барбер-стилист" : "Мастер" },
    { id: uid(), name: "Мария", role: isBarber ? "Администратор" : "Топ-специалист" }
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
    pageCode: ""
  };
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
    "fontBody"
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
    pageCode: ""
  };
  merged.layoutSpec = normalizeLayoutSpec(raw?.layoutSpec, merged);
  merged.pageDsl = normalizePageDsl(raw?.pageDsl, merged);
  const finalized = finalizeDraft(merged);
  if (typeof raw?.pageCode === "string" && raw.pageCode.trim()) finalized.pageCode = raw.pageCode;
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

  const applyEditPrompt = (text: string) => {
    const lower = text.toLowerCase();
    const profilePatch = parseProfileFromMessage(text);
    setProfile((prev) => mergeProfile(prev, profilePatch));
    setDraft((prev) => {
      if (!prev) return prev;
      let next = { ...prev };

      if (lower.includes("короче")) {
        next.heroSubtitle = next.heroSubtitle.split(".")[0] + ".";
      }
      if (lower.includes("преми") || lower.includes("дорог")) {
        next.accentColor = "#c77a7a";
        next.heroTitle = "Сервис премиум-уровня для тех, кто ценит детали";
      }
      if (detectFontIntent(text)) {
        const font = parseFontPair(text);
        if (font) {
          next.fontHeading = font.heading;
          next.fontBody = font.body;
          next.styleLabel = `${next.styleLabel} · ${font.label}`;
        }
      }
      const density = parseDensity(text);
      if (density) next.density = density;
      const radius = parseRadius(text);
      if (radius) next.radius = radius;
      const contrast = parseContrast(text);
      if (contrast) next.contrast = contrast;
      if (lower.includes("запис") || lower.includes("лид")) {
        next.primaryCta = "Записаться онлайн";
        next.secondaryCta = "Выбрать время";
      }
      if (lower.includes("прайс")) {
        next.navItems = ["О нас", "Прайс", "Команда", "Отзывы", "Запись"];
      }
      if (lower.includes("отзыв")) {
        next.aboutBody = `${next.aboutBody} Отдельно усилили социальное доказательство через блок отзывов.`;
      }
      if (profilePatch.businessName) {
        next.businessName = profilePatch.businessName;
        next.contactLine = `${profilePatch.businessName}, ${profilePatch.city || next.city}`;
      }
      if (profilePatch.city) {
        next.city = profilePatch.city;
        next.contactLine = `${next.businessName}, ${profilePatch.city}`;
      }
      if (profilePatch.niche) {
        next.niche = profilePatch.niche;
      }
      next = applySectionCommand(next, text);
      return finalizeDraft(next);
    });
  };

  const generateFromProfile = async (nextProfile: AgentProfile, guidance: string, nextRound: number) => {
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
              round: nextRound
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

      debugStage = "read_json";
      const body = (await response.json()) as {
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
      debugStage = "hydrate_draft";
      const fallbackDraft = createDraftFromProfile(nextProfile, guidance, nextRound);
      const finalDraft = hydrateGeneratedDraft(body.draft, fallbackDraft);
      if (Array.isArray(body.history)) setGenerationHistory(body.history);
      if (Array.isArray(body.stages) && body.stages.length > 0) {
        const stageLine = body.stages.map((stage) => `${stage.id}:${stage.ms}ms`).join(" · ");
        addMessage("assistant", `Pipeline: ${stageLine}`, "soft");
      }
      if (Array.isArray(body.candidates) && body.candidates.length > 0) {
        const candidateLine = body.candidates.map((c) => `${c.id}(${c.engine}, ${c.score})`).join(" · ");
        addMessage("assistant", `Кандидаты: ${candidateLine}. Выбран: ${body.selectedCandidateId || body.candidates[0].id}`, "soft");
      }
      setGenerationEngine("openrouter");
      setDraft(finalizeDraft(finalDraft));
      setGenerationRound(nextRound);
      setProfile(nextProfile);
      const summary = finalDraft.summaryPoints.map((point) => `• ${point}`).join("\n");
      addMessage(
        "assistant",
        `Готово. Собрал индивидуальный вариант #${nextRound} для «${finalDraft.businessName}».\n\nЧто уже есть:\n${summary}\n\nЕсли нужно, напиши «перегенерируй» — сделаю новый дизайн с нуля под тот же бриф.`
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
        void generateFromProfile(merged, dsl.guidance || text, generationRound + 1);
        return;
      }
      if (dsl.kind === "styleLike") {
        const merged = mergeProfile(profile, { styleReference: dsl.reference });
        void generateFromProfile(merged, `Сделай дизайн по примеру: ${dsl.reference}`, generationRound + 1);
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
      void generateFromProfile(mergedProfile, text, 1);
      return;
    }

    if (detectCapabilityQuestion(text)) {
      addMessage(
        "assistant",
        "Я могу: сгенерировать новый дизайн с нуля, менять стиль по референсу, перестраивать блоки DSL-командами и публиковать сайт. Напиши конкретно: «измени стиль на минимализм», «добавь блок отзывов», «/rewrite-block #2 title: ...».",
        "soft"
      );
      return;
    }

    if (detectRegenerateIntent(text) || detectRestyleIntent(text) || detectAiEditIntent(text)) {
      void generateFromProfile(mergedProfile, text, generationRound + 1);
      return;
    }

    void generateFromProfile(mergedProfile, text, generationRound + 1);
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

  const previewRadiusValue = radiusPx(draft?.radius || "soft");
  const previewSectionPaddingValue = sectionPadding(draft?.density || "balanced");
  const previewCardBorder = draft?.contrast === "high" ? "rgba(15,23,42,0.22)" : "rgba(148,163,184,0.3)";
  const previewHeadingFont = draft?.fontHeading || '"Inter", "Segoe UI", sans-serif';
  const previewBodyFont = draft?.fontBody || '"Inter", "Segoe UI", sans-serif';

  const previewPanel = (
    <div className="flex h-full flex-col">
      <div className="rounded-[22px] border border-slate-200/90 bg-white p-4 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-900">Published Home</p>
          <button
            type="button"
            onClick={() => setPreviewExpanded((prev) => !prev)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            {previewExpanded ? "⌃ Hide preview" : "⌄ Show preview"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (publishPath) onNavigate(publishPath);
            }}
            className="rounded-xl bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-600"
          >
            ↗ Open App
          </button>
          <button type="button" className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200/70">
            ✎ Edit
          </button>
          <button type="button" className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200/70">
            ⟳ Refresh
          </button>
          <span className={`ml-auto rounded-full border px-2 py-1 text-xs ${statusClass(generationStatus)}`}>Build</span>
          <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(paymentStatus)}`}>Pay</span>
          <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(publishStatus)}`}>Publish</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
            Engine: {generationEngine}
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
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">Generated HTML/CSS Code</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 text-[11px] leading-5 text-slate-700">
{draft?.pageCode || ""}
                </pre>
              </details>
            </div>

            <div style={{ backgroundColor: draft?.pageBg || "#f6f2f3", fontFamily: previewBodyFont }}>
              <div className="flex items-center justify-between border-b border-[#e8d8da] bg-white/80 px-6 py-4">
                <p className="text-3xl font-semibold" style={{ color: draft?.accentColor || "#c77a7a", fontFamily: previewHeadingFont }}>
                  ✿ {draft?.businessName || "Studio"}
                </p>
                <div className="hidden items-center gap-6 text-base text-slate-700 2xl:flex">
                  {(draft?.navItems || ["О нас", "Услуги", "Отзывы", "Запись"]).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>

              <div className="mx-auto max-w-[980px] px-6 py-8">
                <div className="mb-2 flex justify-center">
                  <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {draft?.styleLabel || "Generated"}
                  </span>
                </div>
                <div className="mt-8 space-y-6">
                  {(draft?.pageDsl?.length || draft?.layoutSpec?.length) ? (
                    <div className="rounded-xl border border-slate-200 bg-white/75 px-3 py-2 text-xs text-slate-500">
                      Blocks: {((draft?.pageDsl && draft.pageDsl.length ? draft.pageDsl : draft?.layoutSpec) || []).map((block: any, index: number) => `#${index + 1}:${block.id}`).join(" · ")}
                    </div>
                  ) : null}
                  {((draft?.pageDsl && draft.pageDsl.length ? draft.pageDsl : draft?.layoutSpec) || []).map((block: any) => {
                    if (block.type === "hero") {
                      return (
                        <section key={block.id} className={block.variant === "split" ? "grid gap-4 md:grid-cols-2" : "text-center"}>
                          <div>
                            <p className="text-xs uppercase tracking-[0.35em]" style={{ color: draft?.accentColor || "#c77a7a" }}>
                              {draft?.aboutTitle || "О нас"}
                            </p>
                            <h3
                              className={`mt-3 text-4xl leading-tight text-slate-800 md:text-5xl ${draft?.headlineStyle === "serif" ? "font-serif" : "font-semibold"} ${block.variant === "centered" ? "text-center" : ""}`}
                              style={{ fontFamily: previewHeadingFont }}
                            >
                              {block.title}
                            </h3>
                            <p className={`mt-4 text-lg leading-[1.55] text-slate-600 ${block.variant === "centered" ? "mx-auto max-w-[820px] text-center" : "max-w-[520px]"}`}>
                              {block.subtitle}
                            </p>
                            <div className={`mt-4 flex flex-wrap gap-2 ${block.variant === "centered" ? "justify-center" : ""}`}>
                              <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: draft?.accentColor || "#c77a7a" }}>
                                {block.primaryCta}
                              </button>
                              <button type="button" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                                {block.secondaryCta}
                              </button>
                            </div>
                          </div>
                          {block.variant === "split" ? (
                            <div
                              className="border bg-white/80"
                              style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, padding: previewSectionPaddingValue, borderColor: previewCardBorder }}
                            >
                              <p className="text-sm text-slate-700">Индивидуальная компоновка: AI выбрал split hero под ваш запрос и стиль.</p>
                            </div>
                          ) : null}
                        </section>
                      );
                    }
                    if (block.type === "about") {
                      return (
                        <section
                          key={block.id}
                          className="border bg-white/80 text-slate-700"
                          style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, padding: previewSectionPaddingValue, borderColor: previewCardBorder }}
                        >
                          <p className="text-xs uppercase tracking-[0.24em]" style={{ color: draft?.accentColor || "#c77a7a" }}>{block.title}</p>
                          <p className="mt-2 text-base leading-7">{block.body}</p>
                        </section>
                      );
                    }
                    if (block.type === "services") {
                      return (
                        <section key={block.id}>
                          <p className="mb-3 text-center text-xs uppercase tracking-[0.24em]" style={{ color: draft?.accentColor || "#c77a7a" }}>Прайс</p>
                          <div className={block.variant === "rows" ? "space-y-2" : "grid gap-3 lg:grid-cols-2"}>
                            {(block.items || []).slice(0, 6).map((service: any, index: number) => (
                              <div
                                key={`${service.title}-${index}`}
                                className="border bg-white/90 px-4 py-3"
                                style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, borderColor: previewCardBorder }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-2xl">{service.emoji}</p>
                                    <p className="mt-1 text-xl font-semibold leading-snug text-slate-800" style={{ fontFamily: previewHeadingFont }}>{service.title}</p>
                                    <p className="mt-1 text-sm text-slate-500">{service.duration}</p>
                                  </div>
                                  <p className="pt-2 text-2xl font-semibold" style={{ color: draft?.accentColor || "#c77a7a" }}>
                                    {service.price}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    }
                    if (block.type === "team") {
                      return (
                        <section key={block.id}>
                          <p className="mb-3 text-center text-xs uppercase tracking-[0.24em]" style={{ color: draft?.accentColor || "#c77a7a" }}>Команда</p>
                          <div className={block.variant === "list" ? "space-y-2" : "grid gap-3 md:grid-cols-3"}>
                            {(block.items || []).map((member: any, index: number) => (
                              <div
                                key={`${member.name}-${index}`}
                                className="border bg-white/90 p-4 text-center"
                                style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, borderColor: previewCardBorder }}
                              >
                                <p className="text-lg font-semibold text-slate-800" style={{ fontFamily: previewHeadingFont }}>{member.name}</p>
                                <p className="mt-1 text-sm text-slate-500">{member.role}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    }
                    if (block.type === "reviews") {
                      return (
                        <section key={block.id}>
                          <p className="mb-3 text-center text-xs uppercase tracking-[0.24em]" style={{ color: draft?.accentColor || "#c77a7a" }}>Отзывы</p>
                          <div className={block.variant === "quotes" ? "space-y-2" : "grid gap-3 md:grid-cols-2"}>
                            {(block.items || []).map((review: any, index: number) => (
                              <div
                                key={`${review.author}-${index}`}
                                className="border bg-white/90 p-4"
                                style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, borderColor: previewCardBorder }}
                              >
                                <p className="text-sm leading-6 text-slate-700">“{review.text}”</p>
                                <p className="mt-2 text-xs font-semibold text-slate-500">{review.author}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    }
                    if (block.type === "faq") {
                      return (
                        <section key={block.id}>
                          <p className="mb-3 text-center text-xs uppercase tracking-[0.24em]" style={{ color: draft?.accentColor || "#c77a7a" }}>FAQ</p>
                          <div className="space-y-2">
                            {(block.items || []).map((item: any, index: number) => (
                              <div
                                key={`${item.q}-${index}`}
                                className="border bg-white/90 p-3"
                                style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: Math.max(10, previewRadiusValue - 4), borderColor: previewCardBorder }}
                              >
                                <p className="text-sm font-semibold text-slate-800" style={{ fontFamily: previewHeadingFont }}>{item.q}</p>
                                <p className="mt-1 text-sm text-slate-600">{item.a}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    }
                    if (block.type === "booking") {
                      return (
                        <section
                          key={block.id}
                          className="border bg-white/90 text-center"
                          style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, padding: previewSectionPaddingValue, borderColor: previewCardBorder }}
                        >
                          <p className="text-lg font-semibold text-slate-800" style={{ fontFamily: previewHeadingFont }}>Онлайн-запись</p>
                          <p className="mt-1 text-sm text-slate-600">Форма записи с выбором услуги, даты и времени.</p>
                          <button type="button" className="mt-3 rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: draft?.accentColor || "#c77a7a" }}>
                            {block.primaryCta || draft?.primaryCta || "Записаться"}
                          </button>
                        </section>
                      );
                    }
                    if (block.type === "contacts") {
                      return (
                        <section
                          key={block.id}
                          className="border bg-white/90 text-center"
                          style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, padding: previewSectionPaddingValue, borderColor: previewCardBorder }}
                        >
                          <p className="text-lg font-semibold text-slate-800" style={{ fontFamily: previewHeadingFont }}>Контакты</p>
                          <p className="mt-1 text-sm text-slate-600">{block.line}</p>
                        </section>
                      );
                    }
                    if (block.type === "stats") {
                      return (
                        <section key={block.id}>
                          <div className={block.variant === "inline" ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-3"}>
                            {(Array.isArray(block.items) ? block.items : []).map((item: any, index: number) => (
                              <div key={`${index}-${item.label || "stat"}`} className="border bg-white/90 p-3 text-center" style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, borderColor: previewCardBorder }}>
                                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500">{String(item.label || "Метрика")}</p>
                                <p className="mt-1 text-xl font-semibold text-slate-800" style={{ fontFamily: previewHeadingFont }}>{String(item.value || "—")}</p>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    }
                    if (block.type === "cta") {
                      return (
                        <section key={block.id} className="border bg-white/90 text-center" style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, padding: previewSectionPaddingValue, borderColor: previewCardBorder }}>
                          <p className="text-2xl font-semibold text-slate-800" style={{ fontFamily: previewHeadingFont }}>{block.title || "Готовы начать?"}</p>
                          <p className="mt-2 text-sm text-slate-600">{block.subtitle || "Оставьте заявку и получите ответ в ближайшее время."}</p>
                          <div className="mt-3 flex flex-wrap justify-center gap-2">
                            <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: draft?.accentColor || "#c77a7a" }}>
                              {block.primaryCta || draft?.primaryCta || "Записаться"}
                            </button>
                            <button type="button" className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                              {block.secondaryCta || draft?.secondaryCta || "Подробнее"}
                            </button>
                          </div>
                        </section>
                      );
                    }
                    if (block.type === "text") {
                      return (
                        <section key={block.id} className="border bg-white/90" style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, padding: previewSectionPaddingValue, borderColor: previewCardBorder }}>
                          <p className="text-xs uppercase tracking-[0.24em]" style={{ color: draft?.accentColor || "#c77a7a" }}>{block.title || "Блок"}</p>
                          <p className="mt-2 text-base leading-7 text-slate-700">{block.body || ""}</p>
                        </section>
                      );
                    }
                    return (
                      <section
                        key={block.id}
                        className="border bg-white/90 text-center"
                        style={{ backgroundColor: draft?.surfaceBg || "#fffafb", borderRadius: previewRadiusValue, padding: previewSectionPaddingValue, borderColor: previewCardBorder }}
                      >
                        <p className="text-lg font-semibold text-slate-800" style={{ fontFamily: previewHeadingFont }}>Галерея</p>
                        <p className="mt-1 text-sm text-slate-600">Блок галереи работ готов к наполнению фото.</p>
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleMockPayment}
          disabled={paymentStatus === "loading" || paymentStatus === "success" || !draft}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {paymentStatus === "loading" ? "Оплата..." : paymentStatus === "success" ? "Оплачено" : "Оплатить 3 500 ₽"}
        </button>
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!canPublish}
          className="rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-200/70 disabled:opacity-50"
        >
          {publishStatus === "loading" ? "Публикуем..." : "Опубликовать"}
        </button>
      </div>
      {publishPath ? (
        <button
          type="button"
          onClick={() => onNavigate(publishPath)}
          className="mt-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
        >
          Открыть опубликованный сайт
        </button>
      ) : null}
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
            <p className="mt-2 text-xs text-slate-400">
              DSL: <code>/regenerate premium dark</code> · <code>/style-like base44 light workspace</code> · <code>/rewrite-block #2 title: Новый заголовок</code> · <code>/move-block #4 before #2</code> · <code>/add-section team</code> · <code>/remove-section faq</code> · <code>/rewrite-hero Новый оффер</code> · <code>/undo</code> · <code>/revert 2</code>
            </p>
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
