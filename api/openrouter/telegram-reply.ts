declare const process: { env: Record<string, string | undefined> };

const SYSTEM_PROMPT =
  "Ты отвечаешь клиенту в Telegram от лица сервисного бизнеса. " +
  "Пиши по-русски, как живой менеджер, кратко и вежливо. " +
  "Цель: уточнить задачу, мягко квалифицировать и предложить следующий шаг к записи. " +
  "Стиль: без markdown, без звездочек, без скобок, без канцелярита. " +
  "Запрещено упоминать AI/ИИ/бота/модель/нейросеть/алгоритм/автоматизацию. " +
  "Всегда пиши 1 короткий ответ + 1 конкретный следующий шаг.";

function normalizeReply(text: string): string {
  return text
    .replace(/[*#`_~]/g, "")
    .replace(/[()]/g, "")
    .replace(/\bAI\b/gi, "специалист")
    .replace(/\bИИ\b/gi, "специалист")
    .replace(/нейросеть|искусственный интеллект|бот|модель|алгоритм/gi, "система")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 360);
}

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
    "Формат: максимум 2 предложения, до 320 символов.",
    "Второе предложение должно начинаться с: Следующий шаг:",
    "Сообщение клиента:",
    userText
  ].join("\n");

  try {
    const model = process.env.OPENROUTER_MODEL_TELEGRAM || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
    const referer = process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": referer,
          "X-Title": "ClientsFlow Telegram Reply"
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 120,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ]
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

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

    const normalized = normalizeReply(reply);
    res.status(200).json({
      reply:
        normalized ||
        "Понял ваш запрос. Следующий шаг: напишите, какая услуга интересует и на какое время вам удобно."
    });
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    res.status(500).json({ error: isTimeout ? "OpenRouter timeout" : error?.message || "OpenRouter telegram reply error" });
  }
}
