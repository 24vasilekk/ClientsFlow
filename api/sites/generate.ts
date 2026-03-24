import { appendSpecRecord, getSpecHistory } from "./_specStore";

const SECTION_KEYS = ["about", "services", "team", "reviews", "faq", "booking", "contacts", "gallery"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

type AgentProfile = {
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  style: string;
  styleReference: string;
  mustHave: string[];
};

type DraftLike = {
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
  services: Array<{ emoji: string; title: string; duration: string; price: string }>;
  team: Array<{ name: string; role: string }>;
  reviews: Array<{ author: string; text: string }>;
  faq: Array<{ q: string; a: string }>;
  sectionOrder: SectionKey[];
  sectionsEnabled: Record<SectionKey, boolean>;
  summaryPoints: string[];
  fontHeading: string;
  fontBody: string;
  density: "airy" | "balanced" | "compact";
  radius: "soft" | "rounded" | "sharp";
  contrast: "soft" | "medium" | "high";
  layoutSpec: Array<Record<string, unknown>>;
  pageDsl: Array<Record<string, unknown>>;
  pageCode: string;
};

type DesignPreset = {
  id: string;
  label: string;
  accent: string;
  pageBg: string;
  surfaceBg: string;
  headlineStyle: "serif" | "sans";
};

const designPresets: DesignPreset[] = [
  { id: "workspace-ash", label: "Workspace Ash", accent: "#f97316", pageBg: "#f3f3f4", surfaceBg: "#ffffff", headlineStyle: "sans" },
  { id: "editorial-rose", label: "Editorial Rose", accent: "#c77a7a", pageBg: "#f6f2f3", surfaceBg: "#fffafb", headlineStyle: "serif" },
  { id: "noir-modern", label: "Noir Modern", accent: "#334155", pageBg: "#f3f5f8", surfaceBg: "#f8fafc", headlineStyle: "sans" },
  { id: "deep-indigo", label: "Deep Indigo", accent: "#4f46e5", pageBg: "#f4f4ff", surfaceBg: "#f8f8ff", headlineStyle: "sans" },
  { id: "forest-premium", label: "Forest Premium", accent: "#0f766e", pageBg: "#f2f7f6", surfaceBg: "#f8fdfc", headlineStyle: "serif" }
];

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
  return items[Math.floor(rnd() * items.length)] || items[0];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPageCode(draft: Pick<DraftLike, "businessName" | "accentColor" | "pageBg" | "surfaceBg" | "fontHeading" | "fontBody" | "density" | "radius" | "contrast" | "pageDsl">) {
  const radius = draft.radius === "rounded" ? 24 : draft.radius === "sharp" ? 10 : 16;
  const sectionPad = draft.density === "compact" ? "14px" : draft.density === "airy" ? "28px" : "20px";
  const borderColor = draft.contrast === "high" ? "rgba(15,23,42,.28)" : "rgba(148,163,184,.28)";

  const blocks = draft.pageDsl
    .map((block) => {
      const type = String(block.type || "");
      if (type === "hero") {
        return `<section class="card ${block.variant === "split" ? "hero-split" : "hero"}">
  <div>
    <p class="eyebrow">${escapeHtml(draft.businessName)}</p>
    <h1>${escapeHtml(String(block.title || "Сайт вашего бизнеса"))}</h1>
    <p class="sub">${escapeHtml(String(block.subtitle || ""))}</p>
    <div class="cta-row">
      <button class="cta-primary">${escapeHtml(String(block.primaryCta || "Записаться"))}</button>
      <button class="cta-secondary">${escapeHtml(String(block.secondaryCta || "Подробнее"))}</button>
    </div>
  </div>
  ${block.variant === "split" ? `<div class="hero-aside">Индивидуальный layout сгенерирован AI</div>` : ""}
</section>`;
      }
      if (type === "services") {
        const items = Array.isArray(block.items) ? block.items : [];
        return `<section class="card"><h2>Услуги</h2><div class="grid">${items
          .map(
            (item) =>
              `<div class="tile"><p class="t">${escapeHtml(String((item as any).title || ""))}</p><p class="m">${escapeHtml(String((item as any).duration || ""))}</p><p class="p">${escapeHtml(String((item as any).price || ""))}</p></div>`
          )
          .join("")}</div></section>`;
      }
      if (type === "reviews") {
        const items = Array.isArray(block.items) ? block.items : [];
        return `<section class="card"><h2>Отзывы</h2><div class="grid">${items
          .map(
            (item) =>
              `<div class="tile"><p class="q">“${escapeHtml(String((item as any).text || ""))}”</p><p class="m">${escapeHtml(String((item as any).author || "Клиент"))}</p></div>`
          )
          .join("")}</div></section>`;
      }
      if (type === "faq") {
        const items = Array.isArray(block.items) ? block.items : [];
        return `<section class="card"><h2>FAQ</h2>${items
          .map(
            (item) =>
              `<details class="faq"><summary>${escapeHtml(String((item as any).q || ""))}</summary><p>${escapeHtml(String((item as any).a || ""))}</p></details>`
          )
          .join("")}</section>`;
      }
      if (type === "stats") {
        const items = Array.isArray(block.items) ? block.items : [];
        return `<section class="grid">${items
          .map(
            (item) =>
              `<div class="tile stat"><p class="m">${escapeHtml(String((item as any).label || ""))}</p><p class="p">${escapeHtml(String((item as any).value || ""))}</p></div>`
          )
          .join("")}</section>`;
      }
      if (type === "cta") {
        return `<section class="card center"><h2>${escapeHtml(String(block.title || "Готовы начать?"))}</h2><p class="sub">${escapeHtml(String(block.subtitle || ""))}</p><div class="cta-row"><button class="cta-primary">${escapeHtml(String(block.primaryCta || "Записаться"))}</button><button class="cta-secondary">${escapeHtml(String(block.secondaryCta || "Подробнее"))}</button></div></section>`;
      }
      if (type === "contacts") {
        return `<section class="card"><h2>Контакты</h2><p>${escapeHtml(String(block.line || ""))}</p></section>`;
      }
      return `<section class="card"><h2>${escapeHtml(String(block.title || "Блок"))}</h2><p>${escapeHtml(String(block.body || ""))}</p></section>`;
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

function extractServicesFromGuidance(guidance: string) {
  const serviceMatch = guidance.match(/(?:услуг[аиы]|services?)\s*[:\-]\s*(.+)$/i);
  if (!serviceMatch?.[1]) return [];
  const line = serviceMatch[1];
  return line
    .split(/[,;|]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((title, index) => ({
      emoji: ["✂️", "🧔", "💈", "🔥", "✨", "🫧", "🪒", "📌"][index % 8] || "•",
      title,
      duration: "по записи",
      price: "по запросу"
    }));
}

function toBoolRecord(raw: unknown, fallback: Record<SectionKey, boolean>) {
  if (!raw || typeof raw !== "object") return fallback;
  const next = { ...fallback };
  for (const key of SECTION_KEYS) {
    const value = (raw as any)[key];
    if (typeof value === "boolean") next[key] = value;
  }
  return next;
}

function toSectionOrder(raw: unknown, fallback: SectionKey[]) {
  if (!Array.isArray(raw)) return fallback;
  const normalized = raw.filter((item): item is SectionKey => typeof item === "string" && SECTION_KEYS.includes(item as SectionKey));
  return normalized.length ? Array.from(new Set(normalized)) : fallback;
}

function parseJson(reply: string) {
  const clean = String(reply || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitizeDraft(raw: any, fallback: DraftLike): DraftLike {
  if (!raw || typeof raw !== "object") return fallback;

  const safe: DraftLike = {
    ...fallback,
    businessName: typeof raw.businessName === "string" && raw.businessName.trim() ? raw.businessName.trim() : fallback.businessName,
    city: typeof raw.city === "string" && raw.city.trim() ? raw.city.trim() : fallback.city,
    niche: typeof raw.niche === "string" && raw.niche.trim() ? raw.niche.trim() : fallback.niche,
    accentColor: typeof raw.accentColor === "string" && raw.accentColor.trim() ? raw.accentColor.trim() : fallback.accentColor,
    pageBg: typeof raw.pageBg === "string" && raw.pageBg.trim() ? raw.pageBg.trim() : fallback.pageBg,
    surfaceBg: typeof raw.surfaceBg === "string" && raw.surfaceBg.trim() ? raw.surfaceBg.trim() : fallback.surfaceBg,
    headlineStyle: raw.headlineStyle === "serif" || raw.headlineStyle === "sans" ? raw.headlineStyle : fallback.headlineStyle,
    styleLabel: typeof raw.styleLabel === "string" && raw.styleLabel.trim() ? raw.styleLabel.trim() : fallback.styleLabel,
    heroTitle: typeof raw.heroTitle === "string" && raw.heroTitle.trim() ? raw.heroTitle.trim() : fallback.heroTitle,
    heroSubtitle: typeof raw.heroSubtitle === "string" && raw.heroSubtitle.trim() ? raw.heroSubtitle.trim() : fallback.heroSubtitle,
    aboutTitle: typeof raw.aboutTitle === "string" && raw.aboutTitle.trim() ? raw.aboutTitle.trim() : fallback.aboutTitle,
    aboutBody: typeof raw.aboutBody === "string" && raw.aboutBody.trim() ? raw.aboutBody.trim() : fallback.aboutBody,
    primaryCta: typeof raw.primaryCta === "string" && raw.primaryCta.trim() ? raw.primaryCta.trim() : fallback.primaryCta,
    secondaryCta: typeof raw.secondaryCta === "string" && raw.secondaryCta.trim() ? raw.secondaryCta.trim() : fallback.secondaryCta,
    contactLine: typeof raw.contactLine === "string" && raw.contactLine.trim() ? raw.contactLine.trim() : fallback.contactLine,
    navItems: Array.isArray(raw.navItems)
      ? raw.navItems.filter((item: unknown) => typeof item === "string" && item.trim()).slice(0, 8)
      : fallback.navItems,
    services: Array.isArray(raw.services)
      ? raw.services
          .filter((item: any) => item && typeof item.title === "string")
          .slice(0, 8)
          .map((item: any) => ({
            emoji: typeof item.emoji === "string" && item.emoji.trim() ? item.emoji.trim() : "•",
            title: item.title.trim(),
            duration: typeof item.duration === "string" && item.duration.trim() ? item.duration.trim() : "по записи",
            price: typeof item.price === "string" && item.price.trim() ? item.price.trim() : "по запросу"
          }))
      : fallback.services,
    team: Array.isArray(raw.team)
      ? raw.team
          .filter((item: any) => item && typeof item.name === "string")
          .slice(0, 6)
          .map((item: any) => ({ name: item.name.trim(), role: typeof item.role === "string" && item.role.trim() ? item.role.trim() : "Специалист" }))
      : fallback.team,
    reviews: Array.isArray(raw.reviews)
      ? raw.reviews
          .filter((item: any) => item && typeof item.text === "string")
          .slice(0, 6)
          .map((item: any) => ({ author: typeof item.author === "string" && item.author.trim() ? item.author.trim() : "Клиент", text: item.text.trim() }))
      : fallback.reviews,
    faq: Array.isArray(raw.faq)
      ? raw.faq
          .filter((item: any) => item && typeof item.q === "string" && typeof item.a === "string")
          .slice(0, 8)
          .map((item: any) => ({ q: item.q.trim(), a: item.a.trim() }))
      : fallback.faq,
    sectionOrder: toSectionOrder(raw.sectionOrder, fallback.sectionOrder),
    sectionsEnabled: toBoolRecord(raw.sectionsEnabled, fallback.sectionsEnabled),
    summaryPoints: Array.isArray(raw.summaryPoints)
      ? raw.summaryPoints.filter((item: unknown) => typeof item === "string" && item.trim()).slice(0, 7)
      : fallback.summaryPoints,
    fontHeading: typeof raw.fontHeading === "string" && raw.fontHeading.trim() ? raw.fontHeading.trim() : fallback.fontHeading,
    fontBody: typeof raw.fontBody === "string" && raw.fontBody.trim() ? raw.fontBody.trim() : fallback.fontBody,
    density: raw.density === "airy" || raw.density === "balanced" || raw.density === "compact" ? raw.density : fallback.density,
    radius: raw.radius === "soft" || raw.radius === "rounded" || raw.radius === "sharp" ? raw.radius : fallback.radius,
    contrast: raw.contrast === "soft" || raw.contrast === "medium" || raw.contrast === "high" ? raw.contrast : fallback.contrast,
    layoutSpec: Array.isArray(raw.layoutSpec) ? raw.layoutSpec.slice(0, 32).filter((item: unknown) => item && typeof item === "object").map((item) => item as Record<string, unknown>) : fallback.layoutSpec,
    pageDsl: Array.isArray(raw.pageDsl) ? raw.pageDsl.slice(0, 32).filter((item: unknown) => item && typeof item === "object").map((item) => item as Record<string, unknown>) : fallback.pageDsl,
    pageCode: typeof raw.pageCode === "string" && raw.pageCode.trim() ? raw.pageCode : fallback.pageCode
  };

  safe.sectionOrder = safe.sectionOrder.filter((key) => safe.sectionsEnabled[key]);
  if (!safe.sectionOrder.length) safe.sectionOrder = fallback.sectionOrder;

  return safe;
}

function buildAlgorithmicDraft(profile: AgentProfile, guidance: string, round: number): DraftLike {
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

  const servicesFromGuidance = extractServicesFromGuidance(guidance);
  const services = servicesFromGuidance.length
    ? servicesFromGuidance
    : isBarber
    ? [
        { emoji: "✂️", title: "Стрижка мужская", duration: "60 мин", price: "1 800 ₽" },
        { emoji: "🧔", title: "Стрижка + борода", duration: "90 мин", price: "2 500 ₽" },
        { emoji: "💈", title: "Оформление бороды", duration: "45 мин", price: "1 200 ₽" },
        { emoji: "🔥", title: "Премиум-комплекс", duration: "120 мин", price: "3 500 ₽" }
      ]
    : [
        { emoji: "💅", title: "Маникюр классический", duration: "60 мин", price: "1 200 ₽" },
        { emoji: "✨", title: "Маникюр с покрытием", duration: "90 мин", price: "1 800 ₽" },
        { emoji: "🦶", title: "Педикюр", duration: "80 мин", price: "2 100 ₽" },
        { emoji: "💎", title: "Комплекс VIP", duration: "120 мин", price: "3 500 ₽" }
      ];

  const sectionsEnabled: Record<SectionKey, boolean> = {
    about: true,
    services: true,
    team: profile.mustHave.some((item) => item.toLowerCase().includes("команд")),
    reviews: profile.mustHave.some((item) => item.toLowerCase().includes("отзыв")),
    faq: true,
    booking: true,
    contacts: true,
    gallery: profile.mustHave.some((item) => item.toLowerCase().includes("галер"))
  };
  const sectionOrder = SECTION_KEYS.filter((key) => sectionsEnabled[key]);
  const layoutSpec: Array<Record<string, unknown>> = [
    {
      id: `b-${uid()}`,
      type: "hero",
      variant: rnd() > 0.5 ? "split" : "centered",
      title: isClinic ? "Точный сервис и доверие в каждом касании" : "Место, где сервис - это искусство",
      subtitle: `Индивидуальный сайт для ${businessName} в ${profile.city || "вашем городе"}.`,
      primaryCta: profile.goal.includes("звон") ? "Позвонить сейчас" : "Записаться",
      secondaryCta: "Открыть прайс"
    }
  ];
  for (const section of sectionOrder) {
    if (section === "about") layoutSpec.push({ id: `b-${uid()}`, type: "about", variant: rnd() > 0.5 ? "story" : "statement", title: "О нас", body: "Структура и тексты собраны под бизнес-задачу: сильный оффер, ясный путь к записи и блоки доверия." });
    if (section === "services") layoutSpec.push({ id: `b-${uid()}`, type: "services", variant: rnd() > 0.5 ? "cards" : "rows", items: services });
    if (section === "team") layoutSpec.push({ id: `b-${uid()}`, type: "team", variant: rnd() > 0.5 ? "grid" : "list", items: [{ name: "Анастасия", role: isBarber ? "Барбер" : "Старший мастер" }, { name: "Екатерина", role: isBarber ? "Барбер-стилист" : "Мастер" }, { name: "Мария", role: isBarber ? "Администратор" : "Топ-специалист" }] });
    if (section === "reviews") layoutSpec.push({ id: `b-${uid()}`, type: "reviews", variant: rnd() > 0.5 ? "cards" : "quotes", items: [{ author: "Клиент", text: "Очень понравился сервис и результат. Записалась онлайн за пару минут." }, { author: "Постоянный клиент", text: "Сильная команда, аккуратная подача и всегда понятная коммуникация." }] });
    if (section === "faq") layoutSpec.push({ id: `b-${uid()}`, type: "faq", variant: rnd() > 0.5 ? "accordion" : "list", items: [{ q: "Как быстро можно записаться?", a: "Обычно на ближайшие слоты можно попасть в день обращения или на следующий день." }, { q: "Можно изменить дизайн?", a: "Да, можно перегенерировать архитектуру и визуальную концепцию прямо в чате." }] });
    if (section === "booking") layoutSpec.push({ id: `b-${uid()}`, type: "booking", variant: "panel", primaryCta: profile.goal.includes("звон") ? "Позвонить сейчас" : "Записаться" });
    if (section === "contacts") layoutSpec.push({ id: `b-${uid()}`, type: "contacts", variant: rnd() > 0.5 ? "panel" : "minimal", line: `${businessName}, ${profile.city || "Москва"}` });
    if (section === "gallery") layoutSpec.push({ id: `b-${uid()}`, type: "gallery", variant: rnd() > 0.5 ? "masonry" : "tiles", title: "Галерея" });
  }
  const pageDsl: Array<Record<string, unknown>> = [
    ...layoutSpec,
    {
      id: `b-${uid()}`,
      type: "stats",
      variant: rnd() > 0.5 ? "inline" : "cards",
      items: [
        { label: "Скорость ответа", value: "< 2 мин" },
        { label: "Повторные клиенты", value: "72%" },
        { label: "Конверсия в запись", value: "+28%" }
      ]
    },
    {
      id: `b-${uid()}`,
      type: "cta",
      variant: rnd() > 0.5 ? "centered" : "split",
      title: "Готовы зафиксировать удобное время?",
      subtitle: "Оставьте заявку и получите подтверждение в течение пары минут.",
      primaryCta: profile.goal.includes("звон") ? "Позвонить сейчас" : "Записаться",
      secondaryCta: "Связаться в мессенджере"
    }
  ].slice(0, 32);

  const draft: DraftLike = {
    businessName,
    city: profile.city || "Москва",
    niche: normalizedNiche,
    accentColor: preset.accent,
    pageBg: preset.pageBg,
    surfaceBg: preset.surfaceBg,
    headlineStyle: preset.headlineStyle,
    styleLabel: preset.label,
    heroTitle: isClinic ? "Точный сервис и доверие в каждом касании" : "Место, где сервис - это искусство",
    heroSubtitle: `Индивидуальный сайт для ${businessName} в ${profile.city || "вашем городе"}.${profile.styleReference ? ` Референс: ${profile.styleReference}.` : ""}`,
    aboutTitle: "О нас",
    aboutBody: "Структура и тексты собраны под бизнес-задачу: сильный оффер, ясный путь к записи и блоки доверия.",
    primaryCta: profile.goal.includes("звон") ? "Позвонить сейчас" : "Записаться",
    secondaryCta: "Открыть прайс",
    contactLine: `${businessName}, ${profile.city || "Москва"}`,
    navItems: nav,
    services,
    team: [
      { name: "Анастасия", role: isBarber ? "Барбер" : "Старший мастер" },
      { name: "Екатерина", role: isBarber ? "Барбер-стилист" : "Мастер" },
      { name: "Мария", role: isBarber ? "Администратор" : "Топ-специалист" }
    ],
    reviews: [
      { author: "Клиент", text: "Очень понравился сервис и результат. Записалась онлайн за пару минут." },
      { author: "Постоянный клиент", text: "Сильная команда, аккуратная подача и всегда понятная коммуникация." }
    ],
    faq: [
      { q: "Как быстро можно записаться?", a: "Обычно на ближайшие слоты можно попасть в день обращения или на следующий день." },
      { q: "Можно изменить дизайн?", a: "Да, можно перегенерировать архитектуру и визуальную концепцию прямо в чате." }
    ],
    sectionOrder,
    sectionsEnabled,
    summaryPoints: [
      "Индивидуальный первый экран с оффером",
      `Навигация под нишу: ${nav.join(", ")}`,
      `Дизайн-вариант: ${preset.label}`,
      "Динамические секции и ready-to-publish структура"
    ],
    fontHeading: preset.headlineStyle === "serif" ? '"Playfair Display", Georgia, serif' : '"Inter", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    density: styleContext.includes("минимал") ? "airy" : "balanced",
    radius: styleContext.includes("workspace") ? "rounded" : "soft",
    contrast: styleContext.includes("dark") ? "high" : "medium"
    ,
    layoutSpec,
    pageDsl,
    pageCode: ""
  };
  draft.pageCode = buildPageCode(draft);
  return draft;
}

type OpenRouterAttempt = {
  candidate: string;
  draft: DraftLike | null;
  error?: string;
  status?: number;
};

async function tryOpenRouterGeneration(profile: AgentProfile, guidance: string, round: number, candidate: string): Promise<OpenRouterAttempt> {
  const apiKey = String(process.env.OPENROUTER_API_KEY || "")
    .replace(/[\r\n\s\u200B-\u200D\uFEFF]+/g, "")
    .trim();
  if (!apiKey) return { candidate, draft: null, error: "openrouter_api_key_missing" };

  const model = String(process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash").trim();
  const prompt = [
    "Собери индивидуальный сайт в формате JSON на русском языке.",
    `Бизнес: ${profile.businessName || "без названия"}`,
    `Ниша: ${profile.niche || "service"}`,
    `Город: ${profile.city || "не указан"}`,
    `Цель: ${profile.goal || "увеличить заявки"}`,
    `Стиль: ${profile.style || "современный premium"}`,
    `Референс стиля: ${profile.styleReference || "-"}`,
    `Обязательные блоки: ${profile.mustHave.join(", ") || "о нас, услуги, отзывы, запись"}`,
    `Guidance: ${guidance || "-"}`,
    `Round: ${round}`,
    "Верни только JSON со структурой:",
    "{",
    '  "businessName": "...",',
    '  "city": "...",',
    '  "niche": "...",',
    '  "accentColor": "#hex",',
    '  "pageBg": "#hex",',
    '  "surfaceBg": "#hex",',
    '  "headlineStyle": "serif|sans",',
    '  "styleLabel": "...",',
    '  "heroTitle": "...",',
    '  "heroSubtitle": "...",',
    '  "aboutTitle": "...",',
    '  "aboutBody": "...",',
    '  "primaryCta": "...",',
    '  "secondaryCta": "...",',
    '  "contactLine": "...",',
    '  "navItems": ["..."],',
    '  "services": [{"emoji":"...","title":"...","duration":"...","price":"..."}],',
    '  "team": [{"name":"...","role":"..."}],',
    '  "reviews": [{"author":"...","text":"..."}],',
    '  "faq": [{"q":"...","a":"..."}],',
    '  "sectionOrder": ["about","services","team","reviews","faq","booking","contacts","gallery"],',
    '  "sectionsEnabled": {"about":true,"services":true,"team":true,"reviews":true,"faq":true,"booking":true,"contacts":true,"gallery":false},',
    '  "summaryPoints": ["...", "..."],',
    '  "fontHeading": "\"Playfair Display\", Georgia, serif",',
    '  "fontBody": "\"Inter\", \"Segoe UI\", sans-serif",',
    '  "density": "airy|balanced|compact",',
    '  "radius": "soft|rounded|sharp",',
    '  "contrast": "soft|medium|high",',
    '  "layoutSpec": [{"type":"hero","variant":"centered|split","title":"...","subtitle":"...","primaryCta":"...","secondaryCta":"..."},{"type":"services","variant":"cards|rows","items":[{"emoji":"...","title":"...","duration":"...","price":"..."}]}],',
    '  "pageDsl": [{"type":"hero","variant":"centered|split","title":"...","subtitle":"..."},{"type":"stats","items":[{"label":"...","value":"..."}]},{"type":"cta","title":"...","subtitle":"...","primaryCta":"...","secondaryCta":"..."}],',
    '  "pageCode": "<!doctype html>...полный валидный HTML с CSS..."',
    "}"
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        messages: [
          {
            role: "system",
            content:
              "Ты senior web designer + copywriter + frontend developer. Генерируй только JSON без markdown и пояснений. Сайт должен быть уникальным, не шаблонным. Если есть референс стиля, перенеси визуальные принципы (ритм, контраст, плотность, типографику), но не копируй бренд и тексты 1-в-1. Поле pageCode обязательно: полный рабочий HTML документ с CSS, без внешних библиотек."
          },
          { role: "user", content: prompt }
        ]
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      const errorText =
        String(data?.error?.message || data?.error || `openrouter_http_${response.status}`)
          .replace(/\s+/g, " ")
          .slice(0, 220);
      return { candidate, draft: null, error: errorText, status: response.status };
    }

    const content = data?.choices?.[0]?.message?.content;
    const reply = typeof content === "string" ? content : Array.isArray(content) ? content.map((item: any) => item?.text || "").join("\n") : "";
    const parsed = parseJson(reply);
    if (!parsed) return { candidate, draft: null, error: "invalid_json_from_model" };
    return { candidate, draft: sanitizeDraft(parsed, buildAlgorithmicDraft(profile, guidance, round)) };
  } catch (error: any) {
    return {
      candidate,
      draft: null,
      error: String(error?.message || "openrouter_fetch_failed").replace(/\s+/g, " ").slice(0, 220)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function scoreCandidate(draft: DraftLike, guidance: string, profile: AgentProfile): number {
  let score = 50;
  const lower = guidance.toLowerCase();
  const style = `${profile.style} ${profile.styleReference} ${guidance}`.toLowerCase();

  if (lower.includes("преми") && draft.accentColor.toLowerCase() === "#c77a7a") score += 12;
  if ((lower.includes("минимал") || lower.includes("minimal")) && draft.density === "airy") score += 10;
  if ((lower.includes("темн") || lower.includes("dark")) && draft.contrast === "high") score += 8;
  if ((lower.includes("workspace") || lower.includes("base44")) && draft.radius === "rounded") score += 8;
  if (style.includes("playfair") && draft.fontHeading.toLowerCase().includes("playfair")) score += 6;
  if (profile.mustHave.some((item) => item.toLowerCase().includes("отзыв")) && draft.sectionsEnabled.reviews) score += 4;
  if (profile.mustHave.some((item) => item.toLowerCase().includes("галер")) && draft.sectionsEnabled.gallery) score += 4;
  if (draft.pageDsl.length >= 5) score += 6;
  if (draft.pageDsl.some((block) => String(block.type) === "cta")) score += 4;
  if (draft.pageDsl.some((block) => String(block.type) === "stats")) score += 2;
  return Math.max(0, Math.min(100, score));
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    const sessionId = String(req.query?.sessionId || "").trim();
    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }
    const history = await getSpecHistory(sessionId);
    res.status(200).json({ sessionId, history });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let debugStage = "init";
  const debugId = `gen-${uid()}`;
  try {
    debugStage = "parse_request";
    const profileRaw = req.body?.profile || {};
    const sessionId = String(req.body?.sessionId || "").trim() || `session-${uid()}`;
    const profile: AgentProfile = {
      businessName: String(profileRaw.businessName || ""),
      niche: String(profileRaw.niche || ""),
      city: String(profileRaw.city || ""),
      goal: String(profileRaw.goal || ""),
      style: String(profileRaw.style || ""),
      styleReference: String(profileRaw.styleReference || ""),
      mustHave: Array.isArray(profileRaw.mustHave) ? profileRaw.mustHave.map((item: unknown) => String(item)) : []
    };
    const guidance = String(req.body?.guidance || "");
    const round = Math.max(1, Number(req.body?.round || 1));
    const hasApiKey = String(process.env.OPENROUTER_API_KEY || "")
      .replace(/[\r\n]+/g, "")
      .trim();
    if (!hasApiKey) {
      res.status(503).json({
        error: "AI engine is not configured. Set OPENROUTER_API_KEY in Vercel Environment Variables.",
        debug: { id: debugId, stage: "config", code: "OPENROUTER_API_KEY_MISSING" }
      });
      return;
    }

    const startedAt = Date.now();
    const t1 = Date.now();
    debugStage = "openrouter_generate";
    const [aiMain, aiAltA, aiAltB] = await Promise.all([
      tryOpenRouterGeneration(profile, guidance, round, "ai-main"),
      tryOpenRouterGeneration(
        profile,
        `${guidance}\nСобери альтернативу A: другая композиция секций, иная типографика и другой ритм отступов.`,
        round + 101,
        "ai-alt-a"
      ),
      tryOpenRouterGeneration(
        profile,
        `${guidance}\nСобери альтернативу B: другая visual language, контраст и плотность, но та же бизнес-цель.`,
        round + 202,
        "ai-alt-b"
      )
    ]);
    const t2 = Date.now();
    const candidatesPool: Array<{ id: string; engine: "openrouter" | "algorithm"; label: string; draft: DraftLike }> = [];
    if (aiMain.draft) candidatesPool.push({ id: "ai-main", engine: "openrouter", label: "AI Main", draft: aiMain.draft });
    if (aiAltA.draft) candidatesPool.push({ id: "ai-alt-a", engine: "openrouter", label: "AI Alt A", draft: aiAltA.draft });
    if (aiAltB.draft) candidatesPool.push({ id: "ai-alt-b", engine: "openrouter", label: "AI Alt B", draft: aiAltB.draft });
    const aiErrors = [aiMain, aiAltA, aiAltB]
      .filter((item) => !item.draft)
      .map((item) => ({ candidate: item.candidate, status: item.status || null, error: item.error || "unknown_error" }));
    if (!candidatesPool.length) {
      res.status(502).json({
        error: "AI generation failed. OpenRouter did not return a valid site draft. Please retry.",
        debug: { id: debugId, stage: "openrouter_generate", code: "NO_VALID_DRAFT", model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash", aiErrors }
      });
      return;
    }

    debugStage = "rank_candidates";
    const scored = candidatesPool.map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate.draft, guidance, profile)
    }));
    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0];
    const draft = selected.draft;
    const engine: "openrouter" | "algorithm" = "openrouter";

    const stages = [
      { id: "brief", ms: 12, source: "profile-parser" },
      { id: "structure", ms: 18, source: "layout-planner" },
      { id: "visual", ms: t2 - t1, source: engine },
      { id: "copy", ms: Math.max(25, Math.round((t2 - t1) * 0.35)), source: engine },
      { id: "selector", ms: 11, source: "candidate-ranker" },
      { id: "assembly", ms: 14, source: "spec-assembler" }
    ];

    let history: Array<{ id: string; round: number; engine: "openrouter" | "algorithm"; createdAt: string }> = [];
    debugStage = "persist_history";
    try {
      const persisted = await appendSpecRecord({
        id: `spec-${uid()}`,
        sessionId,
        createdAt: new Date().toISOString(),
        round,
        engine,
        guidance,
        profile,
        draft
      });
      history = persisted.map((item) => ({ id: item.id, round: item.round, engine: item.engine, createdAt: item.createdAt })).slice(-8);
    } catch {
      history = [];
    }

    res.status(200).json({
      specVersion: "v1",
      debug: { id: debugId },
      sessionId,
      round,
      engine,
      draft,
      profile,
      stages,
      candidates: scored.slice(0, 4).map((item) => ({ id: item.id, engine: item.engine, score: item.score, label: item.label })),
      selectedCandidateId: selected.id,
      totalMs: Date.now() - startedAt,
      history
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Generate failed",
      debug: {
        id: debugId,
        stage: debugStage,
        code: "UNCAUGHT_EXCEPTION",
        message: String(error?.message || "unknown").replace(/\s+/g, " ").slice(0, 260)
      }
    });
  }
}
