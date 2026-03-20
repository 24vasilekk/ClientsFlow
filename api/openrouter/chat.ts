const SYSTEM_PROMPT =
  "Ты консультант ClientsFlow для B2B бизнеса. Пиши только по-русски. " +
  "Всегда отвечай как живой специалист, а не как технология. " +
  "Запрещено использовать слова: AI, ИИ, нейросеть, искусственный интеллект, бот, ассистент. " +
  "Запрещено использовать markdown и служебное оформление: *, **, #, -, ---, [ ], ( ). " +
  "Формат строго: 1 короткий ответ и отдельная строка с префиксом Следующий шаг:. " +
  "Ответ до 220 символов, без списков и без длинных пояснений. " +
  "Стиль: спокойно, профессионально, конкретно, без хайпа. " +
  "Фокус: лиды, запись, квалификация, follow-up, конверсия, аналитика. " +
  "Следующий шаг должен быть чётким действием.";

function pickNextStep(context: string) {
  const text = context.toLowerCase();
  if (text.includes("голос") || text.includes("аудио")) return "Отправьте голосовое, и я дам готовый вариант ответа клиенту.";
  if (text.includes("фото") || text.includes("изображ") || text.includes("картин")) return "Загрузите фото запроса, и я предложу корректный сценарий ответа.";
  if (text.includes("цена") || text.includes("стоим") || text.includes("дорог")) return "Напишите: Покажи ответ на вопрос о цене.";
  if (text.includes("аналит") || text.includes("ворон") || text.includes("конверс") || text.includes("выруч")) return "Перейдите в личный кабинет и откройте раздел аналитики.";
  if (text.includes("запис") || text.includes("брон") || text.includes("слот") || text.includes("календар")) return "Напишите: Нужен сценарий доведения до записи.";
  if (text.includes("директ") || text.includes("лид") || text.includes("входящ") || text.includes("клиент")) return "Напишите сферу бизнеса, и я предложу стартовый сценарий первого ответа.";
  return "Опишите задачу в одном предложении, и я предложу рабочий сценарий.";
}

function extractUserText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find((item: any) => item?.type === "text" && typeof item?.text === "string");
    return textPart?.text || "";
  }
  return "";
}

function formatSalesReply(text: string, context = "") {
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

  const withoutStep = noTechWords.replace(/следующий шаг\s*:\s*.*/gi, "").trim();
  const sentences = withoutStep
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  const compact = sentences.join(" ").slice(0, 220).trim();
  const main = compact || "Понял задачу и вижу, как усилить обработку входящих.";
  return `${main}\nСледующий шаг: ${pickNextStep(`${context} ${noTechWords}`)}`;
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
    const lastUserMessage = [...messages].reverse().find((item: any) => item?.role === "user");
    const userContext = extractUserText(lastUserMessage?.content);
    const reply =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n").trim()
          : "";

    res.status(200).json({ reply: formatSalesReply(reply, userContext), mode: "openrouter", model });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "OpenRouter handler error", mode: "mock" });
  }
}
