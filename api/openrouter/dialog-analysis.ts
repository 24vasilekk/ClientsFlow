declare const process: { env: Record<string, string | undefined> };
import { authErrorPayload, requireRequestContext } from "../_auth/session";

type InputTimelineItem = {
  role?: string;
  text?: string;
  time?: string;
};

type InputConversation = {
  client?: string;
  status?: string;
  summary?: string;
  intent?: string;
  timeline?: InputTimelineItem[];
};

type AnalysisResult = {
  lostAtStage: "новый" | "заинтересован" | "спросил цену" | "думает" | "записан" | "потерян";
  reason: string;
  improvedReply: string;
  confidence: number;
  lostAtMessageIndex?: number;
  lostAtMessageText?: string;
};

function parseJsonFromText(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function clampConfidence(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.62;
  return Math.max(0.1, Math.min(0.99, num));
}

function heuristicAnalysis(conversation: InputConversation): AnalysisResult {
  const timeline = Array.isArray(conversation.timeline) ? conversation.timeline : [];
  const inbound = timeline.filter((item) => item.role === "client").map((item) => String(item.text || ""));
  const outbound = timeline.filter((item) => item.role !== "client").map((item) => String(item.text || ""));
  const fullText = `${conversation.summary || ""}\n${inbound.join("\n")}\n${outbound.join("\n")}`.toLowerCase();
  const lastClientIndex = [...timeline]
    .map((item, index) => ({ item, index }))
    .reverse()
    .find((entry) => entry.item.role === "client")?.index;
  const priceClientIndex = timeline.findIndex(
    (item) => item.role === "client" && /(цен|стоим|сколько|прайс)/i.test(String(item.text || ""))
  );
  const pauseClientIndex = timeline.findIndex(
    (item) => item.role === "client" && /(подума|позже|потом|сравню|я вам напишу|не сейчас)/i.test(String(item.text || ""))
  );

  const askedPrice = /(цен|стоим|сколько|прайс)/i.test(fullText);
  const thinkingCue = /(подума|позже|потом|сравню|я вам напишу|не сейчас)/i.test(fullText);
  const noResponseAfterOffer =
    outbound.length > 0 &&
    inbound.length > 0 &&
    /слот|запис|время|когда/i.test(outbound[outbound.length - 1] || "") &&
    !/да|подтверж|ок|подходит/i.test(inbound[inbound.length - 1] || "");

  let lostAtStage: AnalysisResult["lostAtStage"] = "новый";
  let reason = "Лид не получил достаточной конкретики по следующему шагу.";
  let improvedReply =
    "Понимаю, что решение требует времени. Следующий шаг: подскажите удобный день, и я зафиксирую 2 варианта слота без обязательств.";
  let confidence = 0.62;
  let lostAtMessageIndex = typeof lastClientIndex === "number" ? lastClientIndex : undefined;
  let lostAtMessageText =
    typeof lastClientIndex === "number" ? String(timeline[lastClientIndex]?.text || "").slice(0, 220) : undefined;

  if (askedPrice) {
    lostAtStage = "спросил цену";
    reason = "После вопроса о цене не был дан понятный диапазон + ценность + мягкий переход к записи.";
    improvedReply =
      "Стоимость обычно в диапазоне 3 500–5 500 ₽, зависит от задачи. Следующий шаг: предложить вам 2 ближайших слота для точного расчета?";
    confidence = 0.78;
    if (priceClientIndex >= 0) {
      lostAtMessageIndex = priceClientIndex;
      lostAtMessageText = String(timeline[priceClientIndex]?.text || "").slice(0, 220);
    }
  } else if (thinkingCue || noResponseAfterOffer) {
    lostAtStage = "думает";
    reason = "Клиент ушел в паузу без зафиксированного дедлайна и без мягкого follow-up.";
    improvedReply =
      "Понимаю, что нужно время сравнить. Следующий шаг: закрепить за вами 2 окна на сегодня до 20:00, чтобы вы спокойно выбрали?";
    confidence = 0.72;
    if (pauseClientIndex >= 0) {
      lostAtMessageIndex = pauseClientIndex;
      lostAtMessageText = String(timeline[pauseClientIndex]?.text || "").slice(0, 220);
    }
  } else if (outbound.length > 0) {
    lostAtStage = "заинтересован";
    reason = "Диалог был, но не хватило квалификации и явного CTA к следующему действию.";
    improvedReply =
      "Чтобы предложить лучший вариант, уточню 2 детали и сразу дам точный план. Следующий шаг: какая услуга нужна и когда вам удобно?";
    confidence = 0.67;
  }

  return { lostAtStage, reason, improvedReply, confidence, lostAtMessageIndex, lostAtMessageText };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const traceId = String(req.headers?.["x-trace-id"] || req.body?.traceId || `trace_dialog_analysis_${Date.now().toString(36)}`);
  try {
    await requireRequestContext(req, "api/openrouter/dialog-analysis");
  } catch (error: any) {
    const failure = authErrorPayload(error, traceId);
    res.status(failure.status).json(failure.body);
    return;
  }

  const conversation = (req.body?.conversation || {}) as InputConversation;
  const fallback = heuristicAnalysis(conversation);
  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    res.status(200).json({ ...fallback, mode: "fallback" });
    return;
  }

  try {
    const model = process.env.OPENROUTER_MODEL_CHAT || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
    const referer = process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";
    const prompt = [
      "Проанализируй диалог потери лида и верни строго JSON без markdown.",
      "Схема:",
      '{"lostAtStage":"новый|заинтересован|спросил цену|думает|записан|потерян","reason":"...","improvedReply":"...","confidence":0.0,"lostAtMessageIndex":0,"lostAtMessageText":"..."}',
      "Требования:",
      "- reason: 1-2 предложения, конкретная причина потери",
      "- improvedReply: 1 короткий ответ в стиле менеджера + строка 'Следующий шаг:'",
      "- язык только русский",
      "Данные диалога:",
      JSON.stringify(conversation, null, 2)
    ].join("\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "ClientsFlow Dialog Analysis"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Ты senior sales QA analyst. Анализируешь потерю лида, формулируешь причину и улучшенный ответ. Возвращай только JSON."
          },
          { role: "user", content: prompt }
        ]
      })
    });
    const data = await response.json().catch(() => ({} as any));
    const content = data?.choices?.[0]?.message?.content;
    const raw =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n").trim()
          : "";
    const parsed = parseJsonFromText(raw);
    if (!response.ok || !parsed) {
      res.status(200).json({ ...fallback, mode: "fallback" });
      return;
    }

    const safe: AnalysisResult = {
      lostAtStage:
        parsed.lostAtStage === "новый" ||
        parsed.lostAtStage === "заинтересован" ||
        parsed.lostAtStage === "спросил цену" ||
        parsed.lostAtStage === "думает" ||
        parsed.lostAtStage === "записан" ||
        parsed.lostAtStage === "потерян"
          ? parsed.lostAtStage
          : fallback.lostAtStage,
      reason: typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : fallback.reason,
      improvedReply:
        typeof parsed.improvedReply === "string" && parsed.improvedReply.trim() ? parsed.improvedReply.trim() : fallback.improvedReply,
      confidence: clampConfidence(parsed.confidence),
      lostAtMessageIndex:
        typeof parsed.lostAtMessageIndex === "number" && Number.isInteger(parsed.lostAtMessageIndex) && parsed.lostAtMessageIndex >= 0
          ? parsed.lostAtMessageIndex
          : fallback.lostAtMessageIndex,
      lostAtMessageText:
        typeof parsed.lostAtMessageText === "string" && parsed.lostAtMessageText.trim()
          ? parsed.lostAtMessageText.trim().slice(0, 220)
          : fallback.lostAtMessageText
    };

    res.status(200).json({ ...safe, mode: "openrouter", model });
  } catch {
    res.status(200).json({ ...fallback, mode: "fallback" });
  }
}
