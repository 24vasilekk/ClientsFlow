declare const process: { env: Record<string, string | undefined> };

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
  sectionOrder: Array<"about" | "services" | "team" | "reviews" | "faq" | "booking" | "contacts" | "gallery">;
  sectionsEnabled: Record<"about" | "services" | "team" | "reviews" | "faq" | "booking" | "contacts" | "gallery", boolean>;
  summaryPoints: string[];
  fontHeading: string;
  fontBody: string;
  density: "airy" | "balanced" | "compact";
  radius: "soft" | "rounded" | "sharp";
  contrast: "soft" | "medium" | "high";
  layoutSpec: Array<Record<string, unknown>>;
  pageDsl: Array<Record<string, unknown>>;
  componentCode: string;
  pageCode: string;
};

function deriveBusinessName(profile: AgentProfile, guidance: string) {
  if (profile.businessName && profile.businessName.trim()) return profile.businessName.trim();
  const niche = String(profile.niche || "").toLowerCase();
  const city = String(profile.city || "").trim();
  const g = String(guidance || "").toLowerCase();
  const isBarber = niche.includes("barber") || niche.includes("барбер") || g.includes("барбершоп");
  const isComputerClub = niche.includes("computer") || niche.includes("кибер") || g.includes("компьютерный клуб");
  if (isBarber && city) return `Барбершоп в ${city}`;
  if (isComputerClub && city) return `Компьютерный клуб в ${city}`;
  if (city) return `Сайт бизнеса в ${city}`;
  if (isBarber) return "Барбершоп";
  if (isComputerClub) return "Компьютерный клуб";
  return "Бизнес";
}

export const config = { maxDuration: 60 };

function compact(input: unknown) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
}

function looksLowQualityPageCode(code: string) {
  const html = String(code || "");
  if (!html.trim()) return true;
  const lower = html.toLowerCase();
  const sectionCount = (lower.match(/<section\b/g) || []).length;
  const hasCssVars = lower.includes(":root") && lower.includes("--accent");
  const hasGradient = lower.includes("gradient(");
  const hasMedia = lower.includes("@media");
  const hasPlaceholder =
    lower.includes("studio name") ||
    lower.includes("секция") ||
    lower.includes("блок") ||
    lower.includes("lorem ipsum");
  if (hasPlaceholder) return true;
  if (html.length < 4200) return true;
  if (sectionCount < 4) return true;
  if (!hasCssVars || !hasGradient || !hasMedia) return true;
  return false;
}

function buildDesignDirection(profile: AgentProfile, guidance: string) {
  const text = `${profile.niche} ${profile.style} ${profile.styleReference} ${guidance}`.toLowerCase();
  if (text.includes("барбер") || text.includes("barber")) {
    return "Мужской editorial: глубокие темные цвета, контрастная типографика, аккуратные акценты латунь/медь, премиальные карточки услуг.";
  }
  if (text.includes("кибер") || text.includes("игров") || text.includes("gaming") || text.includes("computer club")) {
    return "Киберпанк dark: неоновые акценты, glow, сильный hero, блок зон/тарифов/игр, эффектные hover-состояния.";
  }
  if (text.includes("салон") || text.includes("nail") || text.includes("beauty")) {
    return "Beauty premium: мягкие градиенты, утонченная типографика, воздушные отступы, доверительный tone of voice.";
  }
  return "Premium SaaS/editorial: выразительная сетка, контрастные заголовки, продуманные CTA, живой визуальный ритм.";
}

function isEditRequest(guidance: string) {
  const text = guidance.toLowerCase();
  return (
    text.includes("измени") ||
    text.includes("поменяй") ||
    text.includes("перепиши") ||
    text.includes("сделай") ||
    text.includes("добавь") ||
    text.includes("убери") ||
    text.includes("редизайн") ||
    text.includes("шрифт") ||
    text.includes("цвет")
  );
}

function parseJson(raw: string): any | null {
  if (!raw || typeof raw !== "string") return null;
  const text = raw.trim();
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

function extractHtmlDocument(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fencedHtml = text.match(/```html\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  const candidate = fencedHtml?.[1]?.trim() || text;
  if (!candidate) return null;
  const lower = candidate.toLowerCase();
  if (lower.includes("<!doctype html") || (lower.includes("<html") && lower.includes("</html>"))) {
    return candidate;
  }
  return null;
}

function extractCodeBlock(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fenced = text.match(/```(?:tsx|jsx|typescript|javascript|js|ts)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return text;
}

function looksLikeReactComponent(code: string) {
  const text = String(code || "").trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  if (lower.includes("<!doctype html") || lower.includes("<html")) return false;
  const hasJsxLike = /<\s*[A-Za-z][^>]*>/.test(text) || text.includes("className=");
  const hasComponentShape =
    /(?:export\s+default\s+)?function\s+[A-Z][A-Za-z0-9_]*/.test(text) ||
    /const\s+[A-Z][A-Za-z0-9_]*\s*=\s*\(/.test(text) ||
    /const\s+[A-Z][A-Za-z0-9_]*\s*=\s*\{/.test(text) ||
    /return\s*\(/.test(text);
  return hasJsxLike && hasComponentShape;
}

function isComputerClubLike(profile: AgentProfile, guidance: string) {
  const joined = `${profile.niche} ${profile.goal} ${profile.style} ${profile.styleReference} ${guidance}`.toLowerCase();
  return (
    joined.includes("computer club") ||
    joined.includes("gaming") ||
    joined.includes("esport") ||
    joined.includes("кибер") ||
    joined.includes("компьютер") ||
    joined.includes("игров")
  );
}

function fallbackDraft(profile: AgentProfile, guidance: string): DraftLike {
  const isComputerClub = isComputerClubLike(profile, guidance);
  const businessName = profile.businessName || (isComputerClub ? "AirDrop Gaming Club" : "Studio Name");
  const city = profile.city || "Москва";
  const niche = profile.niche || (isComputerClub ? "компьютерный клуб" : "сервис");
  const accent = isComputerClub ? "#16d2ff" : "#0ea5e9";
  const pageBg = isComputerClub ? "#060a1c" : "#eff8ff";
  const surfaceBg = isComputerClub ? "#0d1330" : "#ffffff";
  const services = isComputerClub
    ? [
        { emoji: "🖥️", title: "Standard Zone", duration: "RTX 4060 · 144 Hz", price: "от 120 ₽/час" },
        { emoji: "⚡", title: "PRO Zone", duration: "RTX 4070 Super · 240 Hz", price: "от 220 ₽/час" },
        { emoji: "👑", title: "VIP Solo", duration: "RTX 4080 · private room", price: "от 390 ₽/час" },
        { emoji: "🎮", title: "PlayStation 5", duration: "4K TV · до 4 игроков", price: "от 350 ₽/час" }
      ]
    : [
        { emoji: "✨", title: "Базовая услуга", duration: "60 мин", price: "от 2 000 ₽" },
        { emoji: "⚡", title: "Расширенная услуга", duration: "90 мин", price: "от 3 500 ₽" }
      ];
  const pageDsl = isComputerClub
    ? [
        {
          id: "hero-1",
          type: "hero",
          variant: "centered",
          title: `${businessName}: киберклуб, где важны FPS и атмосфера`,
          subtitle: `Собрали сайт для ${businessName} в ${city}: топ-железо, честные тарифы, онлайн-бронь.`,
          primaryCta: "Забронировать место",
          secondaryCta: "Смотреть зоны"
        },
        {
          id: "stats-1",
          type: "stats",
          variant: "inline",
          items: [
            { label: "Игровых мест", value: "50+" },
            { label: "Игр", value: "2000+" },
            { label: "Режим", value: "24/7" },
            { label: "Железо", value: "RTX 4080" }
          ]
        },
        { id: "services-1", type: "services", variant: "cards", items: services },
        {
          id: "reviews-1",
          type: "reviews",
          variant: "cards",
          items: [
            { author: "Гость клуба", text: "Чистые места, сильное железо, без лагов даже в прайм-тайм." },
            { author: "Постоянный клиент", text: "Удобная бронь и реально адекватные цены." }
          ]
        },
        {
          id: "faq-1",
          type: "faq",
          variant: "accordion",
          items: [
            { q: "Можно забронировать заранее?", a: "Да, бронь доступна через форму на сайте." },
            { q: "Есть ночные пакеты?", a: "Да, действуют фиксированные ночные тарифы." }
          ]
        },
        {
          id: "cta-1",
          type: "cta",
          title: "Готовы занять свое место?",
          subtitle: "Оставьте заявку, и администратор подтвердит бронь.",
          primaryCta: "Забронировать сейчас",
          secondaryCta: "Связаться с админом"
        },
        { id: "contacts-1", type: "contacts", line: `${businessName}, ${city}` }
      ]
    : [
        {
          id: "hero-1",
          type: "hero",
          variant: "centered",
          title: `${businessName}: современный сайт под ${niche}`,
          subtitle: `Собрали персональный сайт для бизнеса в ${city}. Фокус на конверсии и онлайн-записи.`,
          primaryCta: "Записаться",
          secondaryCta: "Смотреть услуги"
        },
        { id: "services-1", type: "services", variant: "cards", items: services },
        {
          id: "cta-1",
          type: "cta",
          title: "Готовы запустить поток клиентов?",
          subtitle: "Оставьте заявку и получите первые лиды уже сегодня.",
          primaryCta: "Оставить заявку",
          secondaryCta: "Получить консультацию"
        }
      ];
  return {
    businessName,
    city,
    niche,
    accentColor: accent,
    pageBg,
    surfaceBg,
    headlineStyle: "sans",
    styleLabel: isComputerClub ? "AI Generated · Cyber Arena" : "AI Generated",
    heroTitle: isComputerClub ? `${businessName}: забронируй место в лучшей зоне` : `${businessName}: сайт, который приводит клиентов`,
    heroSubtitle: isComputerClub ? `Персональный дизайн под ${niche} в ${city}` : `Персональный дизайн под ${niche} в ${city}`,
    aboutTitle: isComputerClub ? "О клубе" : "О проекте",
    aboutBody: isComputerClub
      ? `${businessName} — игровое пространство с современным железом, гибкими тарифами и быстрой бронью онлайн.`
      : `${businessName} — индивидуальный сайт под задачу бизнеса.`,
    primaryCta: isComputerClub ? "Забронировать место" : "Записаться",
    secondaryCta: isComputerClub ? "Выбрать зону" : "Подробнее",
    contactLine: `${businessName}, ${city}`,
    navItems: isComputerClub ? ["Зоны", "Цены", "Игры", "Отзывы", "FAQ", "Запись"] : ["О нас", "Услуги", "Отзывы", "Контакты"],
    services,
    team: isComputerClub
      ? [{ name: "Администратор смены", role: "Подтверждение брони и поддержка гостей" }]
      : [{ name: "Команда", role: "Специалисты" }],
    reviews: isComputerClub
      ? [
          { author: "Игрок", text: "Железо действительно мощное, пинг стабильный." },
          { author: "Команда турнира", text: "Организация и атмосфера на высоком уровне." }
        ]
      : [{ author: "Клиент", text: "Отличный сервис и результат." }],
    faq: isComputerClub
      ? [
          { q: "Можно прийти ночью?", a: "Да, клуб работает 24/7, ночные тарифы доступны." },
          { q: "Как подтвердить бронь?", a: "После заявки администратор свяжется с вами в мессенджере." }
        ]
      : [{ q: "Можно изменить дизайн?", a: "Да, просто напишите в чат, что изменить." }],
    sectionOrder: ["about", "services", "reviews", "faq", "booking", "contacts", "team", "gallery"],
    sectionsEnabled: {
      about: true,
      services: true,
      team: true,
      reviews: true,
      faq: true,
      booking: true,
      contacts: true,
      gallery: false
    },
    summaryPoints: isComputerClub
      ? ["Неоновый dark-first визуал", "Зоны и тарифы под киберклуб", "Готово к бронированию и публикации"]
      : ["Индивидуальный первый экран", "Секции под нишу", "Готово к публикации"],
    fontHeading: '"Inter", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    density: "balanced",
    radius: "rounded",
    contrast: isComputerClub ? "high" : "medium",
    layoutSpec: [],
    pageDsl,
    componentCode: "",
    pageCode: ""
  };
}

function normalizeDraft(raw: any, base: DraftLike): DraftLike {
  if (!raw || typeof raw !== "object") return base;
  const next: DraftLike = { ...base };
  const str = (key: keyof DraftLike) => {
    const value = raw[key as string];
    if (typeof value === "string" && value.trim()) (next as any)[key] = value.trim();
  };
  str("businessName");
  str("city");
  str("niche");
  str("accentColor");
  str("pageBg");
  str("surfaceBg");
  str("styleLabel");
  str("heroTitle");
  str("heroSubtitle");
  str("aboutTitle");
  str("aboutBody");
  str("primaryCta");
  str("secondaryCta");
  str("contactLine");
  str("fontHeading");
  str("fontBody");
  str("componentCode");
  str("pageCode");

  if (raw.headlineStyle === "serif" || raw.headlineStyle === "sans") next.headlineStyle = raw.headlineStyle;
  if (raw.density === "airy" || raw.density === "balanced" || raw.density === "compact") next.density = raw.density;
  if (raw.radius === "soft" || raw.radius === "rounded" || raw.radius === "sharp") next.radius = raw.radius;
  if (raw.contrast === "soft" || raw.contrast === "medium" || raw.contrast === "high") next.contrast = raw.contrast;

  if (Array.isArray(raw.navItems)) next.navItems = raw.navItems.filter((x: unknown) => typeof x === "string").slice(0, 8);
  if (Array.isArray(raw.summaryPoints)) next.summaryPoints = raw.summaryPoints.filter((x: unknown) => typeof x === "string").slice(0, 8);
  if (Array.isArray(raw.services)) {
    next.services = raw.services
      .filter((item: any) => item && typeof item.title === "string")
      .slice(0, 8)
      .map((item: any) => ({
        emoji: typeof item.emoji === "string" ? item.emoji : "•",
        title: item.title,
        duration: typeof item.duration === "string" ? item.duration : "по записи",
        price: typeof item.price === "string" ? item.price : "по запросу"
      }));
  }
  if (Array.isArray(raw.team)) {
    next.team = raw.team
      .filter((item: any) => item && typeof item.name === "string")
      .slice(0, 8)
      .map((item: any) => ({ name: item.name, role: typeof item.role === "string" ? item.role : "Специалист" }));
  }
  if (Array.isArray(raw.reviews)) {
    next.reviews = raw.reviews
      .filter((item: any) => item && typeof item.text === "string")
      .slice(0, 8)
      .map((item: any) => ({ author: typeof item.author === "string" ? item.author : "Клиент", text: item.text }));
  }
  if (Array.isArray(raw.faq)) {
    next.faq = raw.faq
      .filter((item: any) => item && typeof item.q === "string" && typeof item.a === "string")
      .slice(0, 10)
      .map((item: any) => ({ q: item.q, a: item.a }));
  }
  if (Array.isArray(raw.pageDsl)) next.pageDsl = raw.pageDsl.slice(0, 24).filter((x: any) => x && typeof x === "object");
  if (Array.isArray(raw.layoutSpec)) next.layoutSpec = raw.layoutSpec.slice(0, 24).filter((x: any) => x && typeof x === "object");
  return next;
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    const sessionId = String(req.query?.sessionId || "").trim();
    res.status(200).json({ sessionId, history: [] });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const debugId = `gen-${Math.random().toString(36).slice(2, 10)}`;
  let stage = "init";
  const startedAt = Date.now();

  try {
    stage = "parse_request";
    const profileRaw = req.body?.profile || {};
    const sessionId = String(req.body?.sessionId || "").trim() || `session-${Math.random().toString(36).slice(2, 10)}`;
    const round = Math.max(1, Number(req.body?.round || 1));
    const guidance = String(req.body?.guidance || "").trim();
    const currentPageCode = String(req.body?.currentPageCode || "").trim();
    const currentComponentCode = String(req.body?.currentComponentCode || "").trim();
    const profile: AgentProfile = {
      businessName: String(profileRaw.businessName || ""),
      niche: String(profileRaw.niche || ""),
      city: String(profileRaw.city || ""),
      goal: String(profileRaw.goal || ""),
      style: String(profileRaw.style || ""),
      styleReference: String(profileRaw.styleReference || ""),
      mustHave: Array.isArray(profileRaw.mustHave) ? profileRaw.mustHave.map((x: unknown) => String(x)) : []
    };

    stage = "validate_env";
    const apiKey = String(process.env.OPENROUTER_API_KEY || "")
      .replace(/[\r\n\s\u200B-\u200D\uFEFF]+/g, "")
      .trim();
    const model = String(process.env.OPENROUTER_MODEL || process.env.OPENROUTER_MODEL_FAST || "openai/gpt-4o").trim();
    const resolvedProfile: AgentProfile = {
      ...profile,
      businessName: deriveBusinessName(profile, guidance)
    };
    const base = fallbackDraft(resolvedProfile, guidance);
    const finishWithFallback = (code: string, message: string) => {
      res.status(502).json({
        specVersion: "v1-lite",
        debug: { id: debugId, stage: "fallback", code, message, elapsedMs: Date.now() - startedAt },
        error: message,
        sessionId,
        round,
        engine: "openrouter",
        profile: resolvedProfile,
        stages: [{ id: "fallback", ms: Date.now() - startedAt, source: "local" }],
        candidates: [{ id: "fallback", engine: "openrouter", score: 100, label: "Safe Fallback" }],
        selectedCandidateId: "fallback",
        totalMs: Date.now() - startedAt,
        history: []
      });
    };

    if (!apiKey) {
      finishWithFallback("OPENROUTER_API_KEY_MISSING", "OPENROUTER_API_KEY is not configured");
      return;
    }

    const isEdit = isEditRequest(guidance);
    const prompt = [
      "Сгенерируй React+Tailwind код сайта на русском языке.",
      "Верни только код компонента (JSX/TSX), без markdown-блоков ``` и без HTML-документа.",
      "Формат по умолчанию: export default function Site() { return (...) }",
      "Строго запрещено использовать заглушки: Studio Name, Company Name, Business Name, Lorem ipsum.",
      "Нужен не шаблон, а детальный, выразительный лендинг уровня production: hero, преимущества, услуги, мастера/команда, отзывы, FAQ, контакты, форма записи.",
      "Код должен быть достаточно большим и содержательным (ориентир: 250+ строк JSX+JS), с массивами данных и map(), адаптивом и аккуратной типографикой.",
      `Бизнес: ${base.businessName}`,
      `Ниша: ${base.niche}`,
      `Город: ${base.city}`,
      `Цель: ${profile.goal || "заявки"}`,
      `Стиль: ${profile.style || "современный"}`,
      `Референс: ${profile.styleReference || "-"}`,
      `Запрос: ${guidance || "-"}`,
      isEdit && currentComponentCode
        ? `ТЕКУЩИЙ REACT КОМПОНЕНТ (измени его по запросу и верни полную новую версию):\n${currentComponentCode.slice(0, 24000)}`
        : isEdit && currentPageCode
          ? `ТЕКУЩИЙ HTML/CSS КОД (измени его по запросу и верни полную новую версию):\n${currentPageCode.slice(0, 24000)}`
          : "Собери новый код с нуля под запрос.",
      'Формат ответа: JSON {"componentCode":"..."} (обязательно).'
    ].join("\n");

    const requestOpenRouter = async (timeoutMs: number, userPrompt: string = prompt) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            temperature: 0.75,
            max_tokens: 5200,
            messages: [
              {
                role: "system",
                content:
                  "Ты senior frontend developer. Верни только код React-компонента с Tailwind-классами. Нельзя возвращать HTML документ, markdown, пояснения."
              },
              { role: "user", content: userPrompt }
            ]
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    stage = "openrouter_request";
    if (Date.now() - startedAt > 20000) {
      finishWithFallback("EARLY_TIMEOUT_GUARD", "Function time budget exceeded before OpenRouter call");
      return;
    }
    let response: Response | null = null;
    try {
      response = await requestOpenRouter(18000);
    } catch (error: any) {
      finishWithFallback("OPENROUTER_TIMEOUT_FALLBACK", compact(error?.message || "openrouter_request_failed"));
      return;
    }

    stage = "openrouter_read";
    const data = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      finishWithFallback("OPENROUTER_HTTP_ERROR", `status=${response.status}; details=${compact(data?.error?.message || data?.error || "unknown_openrouter_error")}`);
      return;
    }

    stage = "parse_model_json";
    const content = data?.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n")
          : "";
    let parsed = parseJson(text);
    if (!parsed || typeof parsed !== "object") {
      parsed = {};
    }
    if (typeof (parsed as any).componentCode !== "string" || !(parsed as any).componentCode.trim()) {
      const rawComponent = extractCodeBlock(text);
      if (rawComponent && looksLikeReactComponent(rawComponent)) (parsed as any).componentCode = rawComponent;
    } else if (!looksLikeReactComponent((parsed as any).componentCode)) {
      (parsed as any).componentCode = "";
    }
    if (typeof (parsed as any).componentCode !== "string" || !(parsed as any).componentCode.trim()) {
      finishWithFallback("COMPONENT_CODE_MISSING", compact(text));
      return;
    }

    const draft = normalizeDraft(parsed, base);
    res.status(200).json({
      specVersion: "v1-lite",
      debug: { id: debugId, stage: "ok" },
      sessionId,
      round,
      engine: "openrouter",
      draft,
      profile: resolvedProfile,
      stages: [{ id: "openrouter", ms: Date.now() - startedAt, source: "openrouter" }],
      candidates: [{ id: "ai-main", engine: "openrouter", score: 100, label: "AI Main" }],
      selectedCandidateId: "ai-main",
      totalMs: Date.now() - startedAt,
      history: []
    });
  } catch (error: any) {
    res.status(500).json({
      specVersion: "v1-lite",
      debug: { id: debugId, stage, code: "UNCAUGHT_EXCEPTION", message: compact(error?.message || "unknown") },
      error: compact(error?.message || "unknown"),
      sessionId: `session-${Math.random().toString(36).slice(2, 10)}`,
      round: 1,
      engine: "openrouter",
      profile: { businessName: "", niche: "", city: "", goal: "", style: "", styleReference: "", mustHave: [] },
      stages: [{ id: "fallback", ms: Date.now() - startedAt, source: "local" }],
      candidates: [{ id: "fallback", engine: "openrouter", score: 100, label: "Safe Fallback" }],
      selectedCandidateId: "fallback",
      totalMs: Date.now() - startedAt,
      history: []
    });
  }
}
