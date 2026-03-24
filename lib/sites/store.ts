declare const process: { env: Record<string, string | undefined> };

export type PublishedSitePayload = {
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
  socialLinks?: {
    telegram?: string;
    whatsapp?: string;
    instagram?: string;
  };
  theme?: {
    fontHeading?: string;
    fontBody?: string;
    density?: "airy" | "balanced" | "compact";
    radius?: "soft" | "rounded" | "sharp";
    contrast?: "soft" | "medium" | "high";
  };
  layoutSpec?: Array<{
    id?: string;
    type?: string;
    variant?: string;
    [key: string]: unknown;
  }>;
  pageDsl?: Array<{
    id?: string;
    type?: string;
    variant?: string;
    [key: string]: unknown;
  }>;
  pageCode?: string;
};

export type PublishedSiteDoc = {
  slug: string;
  createdAt: string;
  updatedAt: string;
  payload: PublishedSitePayload;
};

const KV_API_URL = String(process.env.KV_REST_API_URL || "").trim();
const KV_TOKEN = String(process.env.KV_REST_API_TOKEN || "")
  .replace(/[\r\n]+/g, "")
  .trim();
const SITE_KEY_PREFIX = "clientsflow:site:";

function hasValidKvConfig() {
  if (!KV_API_URL || !KV_TOKEN) return false;
  try {
    const parsed = new URL(KV_API_URL);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function memoryStore(): Map<string, string> {
  const root = globalThis as unknown as { __clientsflowSitesStore?: Map<string, string> };
  if (!root.__clientsflowSitesStore) root.__clientsflowSitesStore = new Map<string, string>();
  return root.__clientsflowSitesStore;
}

async function kvGet(key: string): Promise<string | null> {
  if (!hasValidKvConfig()) {
    return memoryStore().get(key) ?? null;
  }
  try {
    const response = await fetch(`${KV_API_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    if (!response.ok) return memoryStore().get(key) ?? null;
    const data = (await response.json()) as { result?: string | null };
    return typeof data.result === "string" ? data.result : memoryStore().get(key) ?? null;
  } catch {
    return memoryStore().get(key) ?? null;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  if (!hasValidKvConfig()) {
    memoryStore().set(key, value);
    return;
  }
  try {
    await fetch(`${KV_API_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
  } catch {
    memoryStore().set(key, value);
  }
}

function slugBase(raw: string): string {
  return (raw || "site")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "site";
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function createPublishedSite(payload: PublishedSitePayload): Promise<PublishedSiteDoc> {
  const now = new Date().toISOString();
  const base = slugBase(payload.businessName);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = `${base}-${randomSuffix()}`;
    const key = `${SITE_KEY_PREFIX}${slug}`;
    const exists = await kvGet(key);
    if (exists) continue;
    const doc: PublishedSiteDoc = { slug, createdAt: now, updatedAt: now, payload };
    await kvSet(key, JSON.stringify(doc));
    return doc;
  }

  throw new Error("Не удалось создать уникальный slug");
}

export async function getPublishedSite(slug: string): Promise<PublishedSiteDoc | null> {
  const key = `${SITE_KEY_PREFIX}${slug}`;
  const raw = await kvGet(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PublishedSiteDoc;
    if (!parsed || typeof parsed !== "object" || typeof parsed.slug !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}
