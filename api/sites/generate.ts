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
  pageCode: string;
};

export const config = { maxDuration: 60 };

function compact(input: unknown) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
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

function fallbackDraft(profile: AgentProfile, guidance: string): DraftLike {
  const businessName = profile.businessName || "Studio Name";
  const city = profile.city || "Москва";
  const niche = profile.niche || "сервис";
  const accent = "#0ea5e9";
  const pageBg = "#eff8ff";
  const surfaceBg = "#ffffff";
  const services = [
    { emoji: "✨", title: "Базовая услуга", duration: "60 мин", price: "от 2 000 ₽" },
    { emoji: "⚡", title: "Расширенная услуга", duration: "90 мин", price: "от 3 500 ₽" }
  ];
  const pageDsl = [
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
    styleLabel: "AI Generated",
    heroTitle: `${businessName}: сайт, который приводит клиентов`,
    heroSubtitle: `Персональный дизайн под ${niche} в ${city}`,
    aboutTitle: "О проекте",
    aboutBody: `${businessName} — индивидуальный сайт под задачу бизнеса.`,
    primaryCta: "Записаться",
    secondaryCta: "Подробнее",
    contactLine: `${businessName}, ${city}`,
    navItems: ["О нас", "Услуги", "Отзывы", "Контакты"],
    services,
    team: [{ name: "Команда", role: "Специалисты" }],
    reviews: [{ author: "Клиент", text: "Отличный сервис и результат." }],
    faq: [{ q: "Можно изменить дизайн?", a: "Да, просто напишите в чат, что изменить." }],
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
    summaryPoints: ["Индивидуальный первый экран", "Секции под нишу", "Готово к публикации"],
    fontHeading: '"Inter", "Segoe UI", sans-serif',
    fontBody: '"Inter", "Segoe UI", sans-serif',
    density: "balanced",
    radius: "rounded",
    contrast: "medium",
    layoutSpec: [],
    pageDsl,
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
    const model = String(process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash").trim();
    const base = fallbackDraft(profile, guidance);
    const finishWithFallback = (code: string, message: string) => {
      const safeDraft: DraftLike = { ...base, styleLabel: `${base.styleLabel} · Fallback` };
      res.status(200).json({
        specVersion: "v1-lite",
        debug: { id: debugId, stage: "fallback", code, message, elapsedMs: Date.now() - startedAt },
        sessionId,
        round,
        engine: "openrouter",
        draft: safeDraft,
        profile,
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

    const prompt = [
      "Сгенерируй JSON сайта на русском языке.",
      `Бизнес: ${base.businessName}`,
      `Ниша: ${base.niche}`,
      `Город: ${base.city}`,
      `Цель: ${profile.goal || "заявки"}`,
      `Стиль: ${profile.style || "современный"}`,
      `Референс: ${profile.styleReference || "-"}`,
      `Запрос: ${guidance || "-"}`,
      "Верни только JSON. Обязательные поля: heroTitle, heroSubtitle, aboutBody, services[], faq[], pageDsl[], pageCode."
    ].join("\n");

    const requestOpenRouter = async (timeoutMs: number) => {
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
            temperature: 0.45,
            messages: [
              {
                role: "system",
                content:
                  "Ты senior web designer + frontend developer. Верни только JSON без markdown и пояснений. pageCode должен быть полноценным HTML+CSS документом."
              },
              { role: "user", content: prompt }
            ]
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
    };

    stage = "openrouter_request";
    if (Date.now() - startedAt > 4500) {
      finishWithFallback("EARLY_TIMEOUT_GUARD", "Function time budget exceeded before OpenRouter call");
      return;
    }
    let response: Response | null = null;
    try {
      response = await requestOpenRouter(3500);
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
    const parsed = parseJson(text);
    if (!parsed || typeof parsed !== "object") {
      finishWithFallback("INVALID_MODEL_JSON", compact(text));
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
      profile,
      stages: [{ id: "openrouter", ms: 1, source: "openrouter" }],
      candidates: [{ id: "ai-main", engine: "openrouter", score: 100, label: "AI Main" }],
      selectedCandidateId: "ai-main",
      totalMs: Date.now() - startedAt,
      history: []
    });
  } catch (error: any) {
    const fallback = fallbackDraft(
      { businessName: "", niche: "", city: "", goal: "", style: "", styleReference: "", mustHave: [] },
      ""
    );
    res.status(200).json({
      specVersion: "v1-lite",
      debug: { id: debugId, stage, code: "UNCAUGHT_EXCEPTION", message: compact(error?.message || "unknown") },
      sessionId: `session-${Math.random().toString(36).slice(2, 10)}`,
      round: 1,
      engine: "openrouter",
      draft: fallback,
      profile: { businessName: "", niche: "", city: "", goal: "", style: "", styleReference: "", mustHave: [] },
      stages: [{ id: "fallback", ms: Date.now() - startedAt, source: "local" }],
      candidates: [{ id: "fallback", engine: "openrouter", score: 100, label: "Safe Fallback" }],
      selectedCandidateId: "fallback",
      totalMs: Date.now() - startedAt,
      history: []
    });
  }
}
