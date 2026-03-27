declare const process: { env: Record<string, string | undefined> };
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";

const SYSTEM_PROMPT =
  "Ты product strategist для сервисного бизнеса. " +
  "Сформируй краткий профиль бизнеса для внутреннего использования в ответах клиентам. " +
  "Пиши по-русски, 200-400 слов, без markdown и без списков.";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const traceId = String(req.headers?.["x-trace-id"] || req.body?.traceId || `trace_business_summary_${Date.now().toString(36)}`);
  try {
    await requireRequestContext(req, "api/openrouter/business-summary");
  } catch (error: any) {
    const failure = authErrorPayload(error, traceId);
    res.status(failure.status).json(failure.body);
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const businessName = String(req.body?.businessName || "Подключенный бизнес");
  const channels = Array.isArray(req.body?.channels) ? req.body.channels.join(", ") : "";
  const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

  const fallback = `${businessName} работает с входящими обращениями через ${channels || "основные каналы связи"}. Основной фокус — быстрое и точное ведение клиента от первого контакта до целевого действия: записи, консультации или покупки. Для этого в коммуникации используются короткие и понятные ответы, уточняющие вопросы по задаче клиента и следующий конкретный шаг без лишней переписки. Важной частью процесса остается корректная квалификация запроса: нужно заранее определить приоритет обращения, выявить намерение клиента и собрать минимально достаточные детали для предложения релевантного решения. Если кейс выходит за рамки типового сценария, диалог должен оперативно передаваться менеджеру без потери контекста. Цель работы системы — сократить время первого ответа, снизить число потерянных лидов и повысить конверсию в запись или продажу за счет стабильного качества коммуникации и единых стандартов обработки входящих.`;

  if (!apiKey) {
    res.status(200).json({ summary: fallback, mode: "fallback" });
    return;
  }

  const prompt = [
    `Бизнес: ${businessName}`,
    `Каналы: ${channels}`,
    "Ответы владельца на вопросы о бизнесе:",
    answers.map((item: any, i: number) => `${i + 1}. ${String(item?.question || "")}: ${String(item?.answer || "")}`).join("\n")
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
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
          "X-Title": "ClientsFlow Business Summary"
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 420,
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
      res.status(200).json({ summary: fallback, mode: "fallback" });
      return;
    }

    const content = data?.choices?.[0]?.message?.content;
    const summary =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join(" ").trim()
          : "";

    res.status(200).json({
      summary: summary.replace(/[*#`_~]/g, "").replace(/\s{2,}/g, " ").trim() || fallback,
      mode: "openrouter"
    });
  } catch {
    res.status(200).json({ summary: fallback, mode: "fallback" });
  }
}
