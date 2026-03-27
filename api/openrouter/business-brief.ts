declare const process: { env: Record<string, string | undefined> };
import { authErrorPayload, requireRequestContext } from "../_auth/session";

const SYSTEM_PROMPT =
  "Ты продуктовый аналитик внедрения ClientsFlow для сервисных бизнесов. " +
  "Сгенерируй ОДИН следующий вопрос для брифа бизнеса. " +
  "Вопрос должен быть коротким, конкретным, без markdown и без списков. " +
  "Учитывай уже полученные ответы, не повторяйся и углубляй понимание бизнеса. " +
  "Не упоминай AI, модель, нейросеть, бота. " +
  "Верни только чистый текст вопроса.";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const traceId = String(req.headers?.["x-trace-id"] || req.body?.traceId || `trace_business_brief_${Date.now().toString(36)}`);
  try {
    await requireRequestContext(req, "api/openrouter/business-brief");
  } catch (error: any) {
    const failure = authErrorPayload(error, traceId);
    res.status(failure.status).json(failure.body);
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const serviceName = String(req.body?.serviceName || "Подключенный сервис");
  const targetCount = Math.max(10, Number(req.body?.targetCount || 10));
  const endpoint = String(req.body?.endpoint || "");
  const answers = Array.isArray(req.body?.answers)
    ? req.body.answers
        .filter((item: any) => item && typeof item.question === "string" && typeof item.answer === "string")
        .map((item: any) => ({ question: String(item.question), answer: String(item.answer) }))
    : [];

  if (answers.length >= targetCount) {
    res.status(200).json({ done: true, question: "" });
    return;
  }

  const fallbackQuestions = [
    "Какую услугу вы продаете чаще всего и с каким средним чеком?",
    "Кто ваш основной клиент и с каким запросом он приходит?",
    "Через какие каналы вам пишут чаще всего?",
    "Какой ответ клиент должен получить в первые 30 секунд?",
    "Какие вопросы о цене задают чаще всего?",
    "Как вы определяете, что клиент готов к записи?",
    "Какие возражения чаще всего мешают сделке?",
    "Что нужно уточнить до передачи в запись?",
    "Когда отправлять повторное сообщение, если клиент пропал?",
    "Какая ключевая цель на месяц: лиды, конверсия или средний чек?"
  ];

  if (!apiKey) {
    res.status(200).json({ question: fallbackQuestions[answers.length] || fallbackQuestions[fallbackQuestions.length - 1], mode: "fallback" });
    return;
  }

  const onboarding = req.body?.onboarding ? JSON.stringify(req.body.onboarding) : "";
  const knownAnswers = answers.length
    ? answers.map((item: { question: string; answer: string }, i: number) => `${i + 1}. ${item.question} => ${item.answer}`).join("\n")
    : "Пока ответов нет.";
  const prompt = [
    `Сервис: ${serviceName}`,
    endpoint ? `Endpoint: ${endpoint}` : "",
    onboarding ? `Onboarding: ${onboarding}` : "",
    `Нужно задать вопрос №${answers.length + 1} из минимум ${targetCount}.`,
    "Уже собранные ответы:",
    knownAnswers
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
    const referer = process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": referer,
          "X-Title": "ClientsFlow Business Brief"
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          max_tokens: 90,
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
      res.status(200).json({ question: fallbackQuestions[answers.length] || fallbackQuestions[fallbackQuestions.length - 1], mode: "fallback" });
      return;
    }
    const content = data?.choices?.[0]?.message?.content;
    const questionRaw =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join(" ").trim()
          : "";
    const question = questionRaw
      .replace(/[*#`_~]/g, "")
      .replace(/[()[\]]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 260);

    res.status(200).json({
      question: question || fallbackQuestions[answers.length] || fallbackQuestions[fallbackQuestions.length - 1],
      mode: "openrouter"
    });
  } catch {
    res.status(200).json({ question: fallbackQuestions[answers.length] || fallbackQuestions[fallbackQuestions.length - 1], mode: "fallback" });
  }
}
