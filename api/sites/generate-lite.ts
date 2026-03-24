type AgentProfile = {
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  style: string;
  styleReference: string;
  mustHave: string[];
};

function parseJson(raw: string): any | null {
  if (!raw || typeof raw !== "string") return null;
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    // try fenced or inline json extraction
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

function compactError(input: unknown) {
  return String(input || "unknown_error")
    .replace(/\s+/g, " ")
    .slice(0, 260);
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

  const debugId = `lite-${Math.random().toString(36).slice(2, 10)}`;
  let stage = "init";

  try {
    stage = "read_body";
    const sessionId = String(req.body?.sessionId || "").trim() || `session-${Math.random().toString(36).slice(2, 10)}`;
    const round = Math.max(1, Number(req.body?.round || 1));
    const guidance = String(req.body?.guidance || "").trim();
    const profileRaw = req.body?.profile || {};
    const profile: AgentProfile = {
      businessName: String(profileRaw.businessName || ""),
      niche: String(profileRaw.niche || ""),
      city: String(profileRaw.city || ""),
      goal: String(profileRaw.goal || ""),
      style: String(profileRaw.style || ""),
      styleReference: String(profileRaw.styleReference || ""),
      mustHave: Array.isArray(profileRaw.mustHave) ? profileRaw.mustHave.map((item: unknown) => String(item)) : []
    };

    stage = "validate_env";
    const apiKey = String(process.env.OPENROUTER_API_KEY || "")
      .replace(/[\r\n\s\u200B-\u200D\uFEFF]+/g, "")
      .trim();
    if (!apiKey) {
      res.status(503).json({
        error: "OPENROUTER_API_KEY is not set",
        debug: { id: debugId, stage, code: "OPENROUTER_API_KEY_MISSING" }
      });
      return;
    }

    const model = String(process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash").trim();
    const prompt = [
      "Сгенерируй JSON черновик сайта на русском.",
      `Бизнес: ${profile.businessName || "без названия"}`,
      `Ниша: ${profile.niche || "service"}`,
      `Город: ${profile.city || "не указан"}`,
      `Цель: ${profile.goal || "заявки"}`,
      `Стиль: ${profile.style || "современный"}`,
      `Референс: ${profile.styleReference || "-"}`,
      `Важно: ${profile.mustHave.join(", ") || "о нас, услуги, отзывы, запись"}`,
      `Запрос: ${guidance || "-"}`,
      "Верни ТОЛЬКО JSON объект. Обязательно включи поля heroTitle, heroSubtitle, services[], aboutBody, faq[], pageCode(полный HTML)."
    ].join("\n");

    stage = "openrouter_fetch";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
                "Ты senior web designer + frontend developer. Верни только JSON без markdown. Поле pageCode обязательно и содержит полный HTML+CSS."
            },
            { role: "user", content: prompt }
          ]
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    stage = "openrouter_read";
    const data = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      res.status(502).json({
        error: "OpenRouter request failed",
        debug: {
          id: debugId,
          stage,
          status: response.status,
          code: "OPENROUTER_HTTP_ERROR",
          details: compactError(data?.error?.message || data?.error || "unknown_openrouter_error")
        }
      });
      return;
    }

    stage = "parse_model_output";
    const content = data?.choices?.[0]?.message?.content;
    const reply =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n")
          : "";
    const draft = parseJson(reply);
    if (!draft || typeof draft !== "object") {
      res.status(502).json({
        error: "Model returned non-JSON draft",
        debug: {
          id: debugId,
          stage,
          code: "INVALID_MODEL_JSON",
          snippet: compactError(reply)
        }
      });
      return;
    }

    stage = "ok";
    res.status(200).json({
      specVersion: "lite-v1",
      debug: { id: debugId },
      sessionId,
      round,
      engine: "openrouter",
      draft,
      profile,
      stages: [{ id: "openrouter", ms: 1, source: "openrouter" }],
      candidates: [{ id: "ai-main", engine: "openrouter", score: 100, label: "AI Main" }],
      selectedCandidateId: "ai-main",
      totalMs: 1,
      history: []
    });
  } catch (error: any) {
    res.status(500).json({
      error: "Generate lite failed",
      debug: {
        id: debugId,
        stage,
        code: "UNCAUGHT_EXCEPTION",
        message: compactError(error?.message || "unknown")
      }
    });
  }
}

