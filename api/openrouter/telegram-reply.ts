const SYSTEM_PROMPT =
  "Ты отвечаешь клиенту в Telegram от лица сервисного бизнеса. " +
  "Пиши по-русски, как живой менеджер, кратко и вежливо. " +
  "Цель: уточнить задачу, мягко квалифицировать и предложить следующий шаг к записи. " +
  "Никаких упоминаний AI/бота/модели.";

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

  const userText = String(req.body?.text || "").trim();
  const businessName = String(req.body?.businessName || "ClientsFlow");
  const businessContext = String(req.body?.businessContext || "").trim();
  if (!userText) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const prompt = [
    `Бизнес: ${businessName}.`,
    businessContext ? `Контекст бизнеса: ${businessContext}.` : "",
    "Сформируй ответ клиенту в Telegram.",
    "Формат: 1-3 коротких предложения, до 320 символов.",
    "Сообщение клиента:",
    userText
  ].join("\n");

  try {
    const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
    const referer = process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "ClientsFlow Telegram Reply"
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
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

    res.status(200).json({ reply: reply.trim() });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "OpenRouter telegram reply error" });
  }
}
