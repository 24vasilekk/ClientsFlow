declare const process: { env: Record<string, string | undefined> };

import { INTENT_CLASSIFIER_PROMPT, SALES_SYSTEM_PROMPT } from "../../lib/openrouter/chatPrompts.js";
import {
  compact,
  extractCodeBlock,
  inferFallbackBrief,
  looksLikeReactComponent,
  looksLowQualityComponent,
  parseJsonFromText,
  sanitizeBrief
} from "../../lib/sites/websiteBuilderHelpers.js";
import {
  briefExtractionPrompt,
  codeGenerationPromptWithOptions,
  improveCodePrompt,
  getWebsitePromptPack
} from "../../lib/sites/websiteBuilderPrompts.js";
import type { WebsiteBrief } from "../../lib/sites/websiteBuilderTypes";
import { isValidCodePayloadShape, isValidWebsiteBriefShape } from "../../lib/sites/websiteBuilderValidation.js";

type ApiMessage = { role: "user" | "assistant" | "system"; content: unknown };

function extractUserText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find((item: any) => item?.type === "text" && typeof item?.text === "string");
    return textPart?.text || "";
  }
  return "";
}

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
  const main = (sentences.join(" ").slice(0, 220).trim() || "Понял задачу и вижу, как усилить обработку входящих.").trim();
  return `${main}\nСледующий шаг: ${pickNextStep(`${context} ${noTechWords}`)}`;
}

async function openRouterRequest(input: {
  apiKey: string;
  referer: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": input.referer,
        "X-Title": "ClientsFlow Chat Orchestrator"
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
        messages: input.messages
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      throw new Error(`openrouter_http_${response.status}:${compact(data?.error?.message || data?.error || "unknown_error")}`);
    }
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((item: any) => item?.text || "").join("\n").trim()
        : "";
  } finally {
    clearTimeout(timeout);
  }
}

async function openRouterWithRetry(input: {
  apiKey: string;
  referer: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  retries: number;
}) {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= Math.max(1, input.retries + 1); attempt += 1) {
    try {
      const text = await openRouterRequest(input);
      return { text, attempts: attempt };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt > input.retries) break;
    }
  }
  throw lastError || new Error("openrouter_retry_failed");
}

function parseIntent(raw: string): { intent: "chat" | "website_generation"; confidence: number; reason: string } {
  const parsed = parseJsonFromText(raw);
  if (parsed && typeof parsed === "object") {
    const intent = (parsed as any).intent === "website_generation" ? "website_generation" : "chat";
    const confidence = Number((parsed as any).confidence || 0.5);
    const reason = String((parsed as any).reason || "");
    return { intent, confidence: Number.isFinite(confidence) ? confidence : 0.5, reason };
  }
  return { intent: "chat", confidence: 0.4, reason: "classifier_parse_failed" };
}

function quickWebsiteHeuristic(text: string) {
  const t = text.toLowerCase();
  return (
    t.includes("сайт") ||
    t.includes("лендинг") ||
    t.includes("landing") ||
    t.includes("app.jsx") ||
    (t.includes("react") && t.includes("tailwind"))
  );
}

function parseComponentCode(raw: string) {
  const parsed = parseJsonFromText(raw);
  const candidate =
    isValidCodePayloadShape(parsed) && typeof (parsed as any).componentCode === "string"
      ? String((parsed as any).componentCode).trim()
      : extractCodeBlock(raw);
  return looksLikeReactComponent(candidate) ? candidate : "";
}

function deriveTitle(brief: WebsiteBrief) {
  return `${brief.brandName} — ${brief.primaryGoal}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", mode: "mock" });
    return;
  }

  const apiKey = String(process.env.OPENROUTER_API_KEY || "").trim();
  if (!apiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY is not set", mode: "mock" });
    return;
  }

  const startedAt = Date.now();
  const referer = process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";
  const modelDefault = process.env.OPENROUTER_MODEL || "openai/gpt-4.1";
  const modelIntent = process.env.OPENROUTER_MODEL_INTENT || modelDefault;
  const modelBrief = process.env.OPENROUTER_MODEL_SITES_BRIEF || process.env.OPENROUTER_MODEL_SITES || modelDefault;
  const modelCode = process.env.OPENROUTER_MODEL_SITES_CODE || process.env.OPENROUTER_MODEL_SITES || modelDefault;
  const modelPolish = process.env.OPENROUTER_MODEL_SITES_POLISH || process.env.OPENROUTER_MODEL_SITES || modelDefault;
  const modelChat = process.env.OPENROUTER_MODEL_CHAT || modelDefault;

  try {
    const body = req.body || {};
    const messages = (Array.isArray(body?.messages) ? body.messages : []) as ApiMessage[];
    const lastUserMessage = [...messages].reverse().find((item) => item?.role === "user");
    const userText = extractUserText(lastUserMessage?.content);
    const promptPackVersion = String(body.promptPack || "A").toUpperCase() === "B" ? "B" : "A";
    const promptPack = getWebsitePromptPack(promptPackVersion);
    const websiteAction = String(body.websiteAction || "").toLowerCase();
    const currentCode = String(body.currentCode || "").trim();
    const currentBriefRaw = body.currentBrief;

    const classifierInput = [{ role: "system" as const, content: INTENT_CLASSIFIER_PROMPT }, { role: "user" as const, content: userText || "" }];
    const classifier = await openRouterWithRetry({
      apiKey,
      referer,
      model: modelIntent,
      messages: classifierInput,
      temperature: 0.1,
      maxTokens: 120,
      timeoutMs: 9000,
      retries: 1
    });
    const intentResult = parseIntent(classifier.text);
    const forceWebsiteAction = ["regenerate", "premium", "light", "simplify"].includes(websiteAction);
    const isWebsite = forceWebsiteAction || intentResult.intent === "website_generation" || quickWebsiteHeuristic(userText);

    if (isWebsite) {
      const fallbackBrief = inferFallbackBrief({
        guidance: userText,
        businessName: "",
        niche: "",
        city: "",
        goal: "",
        style: "",
        mustHave: []
      });

      let briefRaw = await openRouterWithRetry({
        apiKey,
        referer,
        model: modelBrief,
        messages: [
          { role: "system", content: promptPack.systemBrief },
          {
            role: "user",
            content: briefExtractionPrompt({
              guidance: userText,
              businessName: "",
              niche: "",
              city: "",
              goal: "",
              style: "",
              styleReference: "",
              mustHave: []
            }, { promptPack: promptPackVersion })
          }
        ],
        temperature: 0.2,
        maxTokens: 900,
        timeoutMs: 12000,
        retries: 1
      });
      let briefParsed = parseJsonFromText(briefRaw.text);
      if (currentBriefRaw && typeof currentBriefRaw === "object") {
        const maybeCurrentBrief = sanitizeBrief(currentBriefRaw, fallbackBrief);
        if (isValidWebsiteBriefShape(maybeCurrentBrief)) {
          briefParsed = maybeCurrentBrief;
        }
      }
      if (!isValidWebsiteBriefShape(briefParsed)) {
        const strictBrief = await openRouterWithRetry({
          apiKey,
          referer,
          model: modelBrief,
          messages: [
            { role: "system", content: promptPack.systemBrief },
            {
              role: "user",
              content:
                "Верни строго валидный JSON по схеме, без пропусков полей и без markdown. " +
                briefExtractionPrompt({
                  guidance: userText,
                  businessName: "",
                  niche: "",
                  city: "",
                  goal: "",
                  style: "",
                  styleReference: "",
                  mustHave: []
                }, { promptPack: promptPackVersion })
            }
          ],
          temperature: 0.1,
          maxTokens: 900,
          timeoutMs: 12000,
          retries: 0
        });
        briefParsed = parseJsonFromText(strictBrief.text);
      }
      if (!isValidWebsiteBriefShape(briefParsed)) {
        throw new Error("BRIEF_SCHEMA_VALIDATION_FAILED");
      }
      const brief = sanitizeBrief(briefParsed, fallbackBrief);

      const actionInstruction =
        websiteAction === "regenerate"
          ? "Сгенерируй новый альтернативный вариант того же сайта с другой композицией и иерархией, сохранив бизнес-контекст."
          : "";
      const codeRaw = await openRouterWithRetry({
        apiKey,
        referer,
        model: modelCode,
        messages: [
          { role: "system", content: promptPack.systemGeneration },
          { role: "user", content: codeGenerationPromptWithOptions(brief, { promptPack: promptPackVersion, extraInstruction: actionInstruction }) }
        ],
        temperature: 0.85,
        maxTokens: 6200,
        timeoutMs: 26000,
        retries: 1
      });
      let codeParsed = parseJsonFromText(codeRaw.text);
      let code = parseComponentCode(codeRaw.text);
      if (!isValidCodePayloadShape(codeParsed)) {
        const strictCode = await openRouterWithRetry({
          apiKey,
          referer,
          model: modelCode,
          messages: [
            { role: "system", content: promptPack.systemGeneration },
            {
              role: "user",
              content:
                'Верни строго JSON формата {"componentCode":"..."} без markdown и без лишних полей. ' +
                codeGenerationPromptWithOptions(brief, { promptPack: promptPackVersion, extraInstruction: actionInstruction })
            }
          ],
          temperature: 0.8,
          maxTokens: 6200,
          timeoutMs: 22000,
          retries: 0
        });
        codeParsed = parseJsonFromText(strictCode.text);
        if (!code) code = parseComponentCode(strictCode.text);
      }
      if (!code && !isValidCodePayloadShape(codeParsed)) {
        throw new Error("CODE_SCHEMA_VALIDATION_FAILED");
      }
      if (!code) {
        code = parseComponentCode(
          JSON.stringify({
            componentCode: String((codeParsed as any).componentCode || "")
          })
        );
      }
      if (!code) throw new Error("website_component_code_missing");

      const needsActionImprove = ["premium", "light", "simplify"].includes(websiteAction) && currentCode.length > 0;
      if (needsActionImprove) {
        const actionMap: Record<string, string> = {
          premium: "Сделай версию ощутимо премиальнее: более дорогая композиция, сильный hero, выразительные CTA.",
          light: "Сделай светлую версию: чистая светлая палитра, высокий контраст, современный clean-luxury вид.",
          simplify: "Сделай более простую и лаконичную версию: меньше визуального шума, понятная структура, быстрый путь к CTA."
        };
        const improveRaw = await openRouterWithRetry({
          apiKey,
          referer,
          model: modelPolish,
          messages: [
            { role: "system", content: promptPack.systemPolish },
            {
              role: "user",
              content: improveCodePrompt(
                { currentCode, brief, instruction: actionMap[websiteAction] || "" },
                { promptPack: promptPackVersion }
              )
            }
          ],
          temperature: 0.8,
          maxTokens: 6200,
          timeoutMs: 22000,
          retries: 1
        });
        const improved = parseComponentCode(improveRaw.text);
        if (improved) code = improved;
      } else if (looksLowQualityComponent(code)) {
        const improveRaw = await openRouterWithRetry({
          apiKey,
          referer,
          model: modelPolish,
          messages: [
            { role: "system", content: promptPack.systemPolish },
            { role: "user", content: improveCodePrompt({ currentCode: code, brief }, { promptPack: promptPackVersion }) }
          ],
          temperature: 0.85,
          maxTokens: 6200,
          timeoutMs: 22000,
          retries: 0
        });
        const improved = parseComponentCode(improveRaw.text);
        if (improved) code = improved;
      }

      res.status(200).json({
        mode: "website",
        brief,
        code,
        title: deriveTitle(brief),
        generationMeta: {
          intent: intentResult,
          model: modelCode,
          promptPack: promptPackVersion,
          action: websiteAction || "generate",
          attempts: {
            classify: classifier.attempts,
            brief: briefRaw.attempts,
            code: codeRaw.attempts
          },
          totalMs: Date.now() - startedAt,
          canRepair: true,
          nextAction: "use /api/sites/generate mode=fix with current code and render error"
        }
      });
      return;
    }

    const chat = await openRouterWithRetry({
      apiKey,
      referer,
      model: modelChat,
      messages: [{ role: "system", content: SALES_SYSTEM_PROMPT }, ...messages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: extractUserText(m.content) }))],
      temperature: 0.25,
      maxTokens: 120,
      timeoutMs: 9000,
      retries: 1
    });

    res.status(200).json({
      reply: formatSalesReply(chat.text, userText),
      mode: "openrouter",
      model: modelChat,
      generationMeta: {
        intent: intentResult,
        totalMs: Date.now() - startedAt
      }
    });
  } catch (error: any) {
    const isTimeout = error?.name === "AbortError";
    res.status(500).json({ error: isTimeout ? "OpenRouter timeout" : error?.message || "OpenRouter handler error", mode: "mock" });
  }
}
