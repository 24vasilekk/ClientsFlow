import type { AiDecisionInput, AiDecisionProvider, AiDecisionResult, AiHistoryItem, AiDecisionOutput } from "../types.js";

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.55;
  return Math.max(0.1, Math.min(0.99, value));
}

function normalizeReply(text: string): string {
  return String(text || "")
    .replace(/[*#`_~]/g, "")
    .replace(/[()]/g, "")
    .replace(/\bAI\b/gi, "специалист")
    .replace(/\bИИ\b/gi, "специалист")
    .replace(/нейросеть|искусственный интеллект|бот|модель|алгоритм/gi, "система")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function hasPriceIntent(text: string): boolean {
  return /(цен|стоим|прайс|сколько)/i.test(String(text || ""));
}

function hasBookingIntent(text: string): boolean {
  return /(запис|брон|время|слот|когда можно|хочу на)/i.test(String(text || ""));
}

function hasThinkingIntent(text: string): boolean {
  return /(подума|позже|потом|сравню|не сейчас|я напишу)/i.test(String(text || ""));
}

function hasEscalationNeed(history: AiHistoryItem[], businessProfile: string): boolean {
  const joined = `${businessProfile}\n${history.map((m) => m.text).join("\n")}`.toLowerCase();
  return /(жалоб|претенз|юрист|договор|возврат|refund|суд|угроз)/i.test(joined);
}

function buildFallbackDecision(input: AiDecisionInput): AiDecisionOutput {
  const text = input.lastUserMessage;
  const lowered = text.toLowerCase();

  let replyText = "Спасибо за обращение. Следующий шаг: подскажите, какая услуга нужна и на какое время вам удобно.";
  let confidence = 0.58;
  let nextAction: AiDecisionOutput["nextAction"] = "ask_clarification";
  let qualificationUpdate: AiDecisionOutput["qualificationUpdate"] = { stage: "interested", reason: "Клиент в диалоге, идет первичная квалификация." };
  let followUpSuggestion: AiDecisionOutput["followUpSuggestion"] = { shouldSchedule: true, triggerType: "no_response_timeout", delayHours: 6, reason: "Если не ответит, нужен деликатный follow-up." };

  if (hasEscalationNeed(input.conversationHistory, input.businessProfile)) {
    replyText = "Спасибо, вижу важный вопрос. Следующий шаг: передаю диалог менеджеру, он подключится в ближайшее время.";
    confidence = 0.72;
    nextAction = "escalate_manager";
    qualificationUpdate = { stage: "thinking", reason: "Нужна ручная обработка менеджером." };
    followUpSuggestion = { shouldSchedule: false, reason: "Ожидается подключение менеджера." };
  } else if (hasPriceIntent(lowered)) {
    replyText = "Стоимость зависит от задачи и обычно в диапазоне, который уточним за 1 минуту. Следующий шаг: предложить 2 ближайших слота и точный расчет?";
    confidence = 0.78;
    nextAction = "reply";
    qualificationUpdate = { stage: "asked_price", reason: "Клиент спросил цену." };
    followUpSuggestion = { shouldSchedule: true, triggerType: "price_ghost", delayHours: 2, reason: "Цена запрошена — высок риск ghosting." };
  } else if (hasBookingIntent(lowered)) {
    replyText = "Отлично, поможем быстро оформить запись. Следующий шаг: напишите удобные день и время, я предложу подходящие окна.";
    confidence = 0.81;
    nextAction = "book";
    qualificationUpdate = { stage: "booked", reason: "Клиент готов к записи." };
    followUpSuggestion = { shouldSchedule: false, reason: "Диалог у целевого действия." };
  } else if (hasThinkingIntent(lowered)) {
    replyText = "Понимаю, что нужно время сравнить варианты. Следующий шаг: закрепить за вами 2 окна без обязательств, чтобы вы спокойно выбрали?";
    confidence = 0.69;
    nextAction = "reply";
    qualificationUpdate = { stage: "thinking", reason: "Клиент взял паузу." };
    followUpSuggestion = { shouldSchedule: true, triggerType: "not_booked_stalled", delayHours: 24, reason: "Клиент ушел думать, нужен отложенный follow-up." };
  }

  return {
    replyText: normalizeReply(replyText).slice(0, 420),
    confidence: clampConfidence(confidence),
    nextAction,
    qualificationUpdate,
    followUpSuggestion,
    provider: "fallback",
    model: "fallback-rules-v1",
    attempts: 1,
    latencyMs: 1
  };
}

export function createFallbackProvider(): AiDecisionProvider {
  return {
    name: "fallback",
    async decide(input: AiDecisionInput): Promise<AiDecisionResult> {
      return {
        decision: buildFallbackDecision(input),
        promptMetadata: {
          version: "decision_v1_fallback",
          model: "fallback-rules-v1",
          provider: "fallback",
          tokensHint: {
            historyChars: input.conversationHistory.map((item) => item.text).join("\n").length,
            inputChars: input.lastUserMessage.length
          }
        }
      };
    }
  };
}
