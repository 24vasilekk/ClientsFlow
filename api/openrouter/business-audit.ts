const SYSTEM_PROMPT =
  "Ты senior growth-аналитик и операционный консультант для сервисных бизнесов. " +
  "Пиши по-русски, структурно и конкретно. " +
  "Верни только JSON без markdown. " +
  "Фокус: лиды, воронка, ответ в мессенджерах, запись, потери выручки, повторные касания.";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY is not set" });
    return;
  }

  try {
    const payload = req.body ?? {};
    const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
    const referer = process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";

    const userPrompt = [
      "Проанализируй бизнес-контекст и дай практический план улучшений.",
      "Верни JSON строго по схеме:",
      "{\"summary\":\"\",\"whatWorks\":[\"\",\"\",\"\"],\"risks\":[\"\",\"\",\"\"],\"quickWins\":[\"\",\"\",\"\"],\"automationPlan\":[\"\",\"\",\"\"],\"telegramPlan\":[\"\",\"\",\"\"],\"kpis\":[\"\",\"\",\"\"],\"firstWeekPlan\":[\"\",\"\",\"\"],\"estimatedImpact\":\"\"}",
      "Контекст:",
      JSON.stringify(payload, null, 2)
    ].join("\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "ClientsFlow Business Audit"
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data?.error || "OpenRouter error" });
      return;
    }

    const content = data?.choices?.[0]?.message?.content;
    const reply =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n").trim()
          : "";

    res.status(200).json({ reply, mode: "openrouter", model });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "OpenRouter handler error" });
  }
}
