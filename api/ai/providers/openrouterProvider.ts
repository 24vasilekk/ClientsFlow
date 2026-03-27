declare const process: { env: Record<string, string | undefined> };

import type { AiDecisionInput, AiDecisionProvider, AiDecisionResult, AiDecisionOutput } from "../types.js";

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

type OpenRouterJson = {
  replyText?: unknown;
  confidence?: unknown;
  nextAction?: unknown;
  qualificationUpdate?: {
    stage?: unknown;
    reason?: unknown;
  } | null;
  followUpSuggestion?: {
    shouldSchedule?: unknown;
    triggerType?: unknown;
    delayHours?: unknown;
    reason?: unknown;
  } | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeReply(text: unknown): string {
  return String(text || "")
    .replace(/[*#`_~]/g, "")
    .replace(/[()]/g, "")
    .replace(/\bAI\b/gi, "специалист")
    .replace(/\bИИ\b/gi, "специалист")
    .replace(/нейросеть|искусственный интеллект|бот|модель|алгоритм/gi, "система")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 420);
}

function clampConfidence(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.56;
  return Math.max(0.1, Math.min(0.99, num));
}

function asNextAction(value: unknown): AiDecisionOutput["nextAction"] {
  const raw = String(value || "").toLowerCase();
  if (raw === "reply" || raw === "ask_clarification" || raw === "escalate_manager" || raw === "book" || raw === "wait" || raw === "noop") {
    return raw;
  }
  return "reply";
}

function asQualification(update: OpenRouterJson["qualificationUpdate"]): AiDecisionOutput["qualificationUpdate"] {
  if (!update || typeof update !== "object") return null;
  const rawStage = String(update.stage || "").toLowerCase();
  const stage =
    rawStage === "new" ||
    rawStage === "interested" ||
    rawStage === "asked_price" ||
    rawStage === "thinking" ||
    rawStage === "booked" ||
    rawStage === "lost"
      ? rawStage
      : "interested";
  const reason = String(update.reason || "").trim() || "Автообновление этапа после AI-решения.";
  return { stage, reason };
}

function asFollowUp(update: OpenRouterJson["followUpSuggestion"]): AiDecisionOutput["followUpSuggestion"] {
  if (!update || typeof update !== "object") return null;
  const shouldSchedule = Boolean(update.shouldSchedule);
  const triggerRaw = String(update.triggerType || "").toLowerCase();
  const triggerType =
    triggerRaw === "no_response_timeout" || triggerRaw === "price_ghost" || triggerRaw === "not_booked_stalled"
      ? triggerRaw
      : undefined;
  const delayNum = Number(update.delayHours);
  const delayHours = Number.isFinite(delayNum) && delayNum > 0 ? Math.min(72, Math.max(1, Math.round(delayNum))) : undefined;
  const reason = String(update.reason || "").trim() || undefined;
  return { shouldSchedule, triggerType, delayHours, reason };
}

function buildSystemPrompt(): string {
  return [
    "Ты sales orchestration engine для сервисного бизнеса.",
    "Верни СТРОГО JSON без markdown и без комментариев.",
    "Не упоминай AI/ИИ/бота/модель.",
    "Ключи JSON:",
    '{"replyText":"...","confidence":0.0,"nextAction":"reply|ask_clarification|escalate_manager|book|wait|noop","qualificationUpdate":{"stage":"new|interested|asked_price|thinking|booked|lost","reason":"..."} | null,"followUpSuggestion":{"shouldSchedule":true,"triggerType":"no_response_timeout|price_ghost|not_booked_stalled","delayHours":1,"reason":"..."} | null}',
    "replyText: максимум 2 предложения, второе начинается с 'Следующий шаг:'",
    "confidence: 0..1",
    "qualificationUpdate: обновляй этап только если есть уверенный сигнал",
    "followUpSuggestion: предлагай только когда это уместно"
  ].join("\n");
}

function buildUserPrompt(input: AiDecisionInput): string {
  const history = input.conversationHistory.slice(-20).map((item) => ({ role: item.role, text: item.text, at: item.at || null }));
  return [
    `traceId: ${input.traceId}`,
    `channel: ${input.channel}`,
    `leadStage: ${input.leadStage}`,
    "businessProfile:",
    input.businessProfile || "не указан",
    "lastUserMessage:",
    input.lastUserMessage,
    "conversationHistory:",
    JSON.stringify(history)
  ].join("\n");
}

async function requestOpenRouter(args: {
  apiKey: string;
  referer: string;
  model: string;
  timeoutMs: number;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ raw: string; httpStatus: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": args.referer,
        "X-Title": "CFlow AI Decision Pipeline"
      },
      body: JSON.stringify({
        model: args.model,
        temperature: 0.2,
        max_tokens: 280,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: args.systemPrompt },
          { role: "user", content: args.userPrompt }
        ]
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({} as any));
    const content = data?.choices?.[0]?.message?.content;
    const raw =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n").trim()
          : "";

    if (!response.ok) {
      const details = String(data?.error?.message || data?.error || "unknown_openrouter_error");
      throw new Error(`openrouter_http_${response.status}:${details}`);
    }
    return { raw, httpStatus: response.status };
  } finally {
    clearTimeout(timer);
  }
}

export function createOpenRouterProvider(): AiDecisionProvider {
  return {
    name: "openrouter",
    async decide(input: AiDecisionInput): Promise<AiDecisionResult> {
      const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
      if (!apiKey) throw new Error("missing_openrouter_key");

      const referer = process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";
      const model = process.env.OPENROUTER_MODEL_DECISION || process.env.OPENROUTER_MODEL_CHAT || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
      const timeoutMs = Number(process.env.AI_DECISION_TIMEOUT_MS || 9000);
      const retries = Number(process.env.AI_DECISION_RETRIES || 2);
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(input);

      let rawOutput = "";
      let attempts = 0;
      const startedAt = Date.now();
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= Math.max(1, retries + 1); attempt += 1) {
        attempts = attempt;
        try {
          const result = await requestOpenRouter({ apiKey, referer, model, timeoutMs, systemPrompt, userPrompt });
          rawOutput = result.raw;
          const parsed = parseJsonObject(rawOutput) as OpenRouterJson | null;
          if (!parsed) {
            throw new Error("openrouter_invalid_json");
          }

          const decision: AiDecisionOutput = {
            replyText: normalizeReply(parsed.replyText),
            confidence: clampConfidence(parsed.confidence),
            nextAction: asNextAction(parsed.nextAction),
            qualificationUpdate: asQualification(parsed.qualificationUpdate),
            followUpSuggestion: asFollowUp(parsed.followUpSuggestion),
            provider: "openrouter",
            model,
            attempts,
            latencyMs: Date.now() - startedAt
          };

          return {
            decision,
            promptMetadata: {
              version: "decision_v1",
              model,
              provider: "openrouter",
              tokensHint: {
                historyChars: input.conversationHistory.map((item) => item.text).join("\n").length,
                inputChars: input.lastUserMessage.length
              }
            },
            rawOutput
          };
        } catch (error: any) {
          const message = String(error?.message || "openrouter_request_failed");
          lastError = error instanceof Error ? error : new Error(message);
          const isTimeout = error?.name === "AbortError";
          const statusMatch = /openrouter_http_(\d+):/.exec(message);
          const statusCode = statusMatch ? Number(statusMatch[1]) : 0;
          const retryable = isTimeout || RETRYABLE_STATUS.has(statusCode) || /network|fetch/i.test(message);
          if (!retryable || attempt >= retries + 1) {
            break;
          }
          await sleep(220 * 2 ** (attempt - 1));
        }
      }

      throw lastError || new Error("openrouter_decision_failed");
    }
  };
}
