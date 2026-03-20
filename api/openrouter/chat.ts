const SYSTEM_PROMPT =
  "Ты консультант ClientsFlow для B2B бизнеса. Пиши только по-русски. " +
  "Всегда отвечай как живой специалист, а не как технология. " +
  "Запрещено использовать слова: AI, ИИ, нейросеть, искусственный интеллект, бот, ассистент. " +
  "Запрещено использовать markdown и служебное оформление: *, **, #, -, ---, [ ], ( ). " +
  "Формат: 2-4 коротких предложения, максимум 420 символов. " +
  "Стиль: спокойно, профессионально, конкретно, без хайпа. " +
  "Фокус: лиды, запись, квалификация, follow-up, конверсия, аналитика. " +
  "В конце при уместности предложи один следующий шаг.";

function formatHumanReply(text: string) {
  const noMarkdown = text
    .replace(/[*#`_~]/g, "")
    .replace(/\[(.*?)\]/g, "$1")
    .replace(/[()]/g, "")
    .replace(/---+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const noTechWords = noMarkdown
    .replace(/\bAI\b/gi, "специалист")
    .replace(/\bИИ\b/gi, "специалист")
    .replace(/нейросеть/gi, "система")
    .replace(/искусственный интеллект/gi, "система")
    .replace(/чат-бот/gi, "сервис")
    .replace(/\bбот\b/gi, "сервис")
    .replace(/ассистент/gi, "специалист");

  const sentences = noTechWords
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);

  const compact = sentences.join(" ").slice(0, 420).trim();
  return compact || "Понял задачу. Можем настроить сценарий под ваши входящие и показать это в личном кабинете.";
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", mode: "mock" });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY is not set", mode: "mock" });
    return;
  }

  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-pro";
    const referer = process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "ClientsFlow MVP"
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      res.status(response.status).json({ error: data?.error || "OpenRouter error", mode: "mock" });
      return;
    }

    const content = data?.choices?.[0]?.message?.content;
    const reply =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n").trim()
          : "";

    res.status(200).json({ reply: formatHumanReply(reply), mode: "openrouter", model });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "OpenRouter handler error", mode: "mock" });
  }
}
