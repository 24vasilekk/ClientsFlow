declare const process: { env: Record<string, string | undefined> };

import {
  buildWebsiteBrief,
  compact,
  enrichWebsitePrompt,
  extractCodeBlock,
  looksLikeReactComponent,
  parseJsonFromText
} from "../../lib/sites/websiteBuilderHelpers.js";
import {
  codeGenerationPromptWithOptions,
  fixCodePrompt,
  improveCodePrompt,
  getWebsitePromptPack
} from "../../lib/sites/websiteBuilderPrompts.js";
import { runWebsiteGenerationFlow } from "../../lib/sites/websiteGenerationOrchestrator.js";
import type {
  WebsiteBrief,
  WebsiteBuilderMode,
  WebsiteBuilderRequest,
  WebsiteGenerationModels,
  WebsiteGenerationProfile
} from "../../lib/sites/websiteBuilderTypes";

type AgentProfile = WebsiteGenerationProfile;

export const config = { maxDuration: 60 };

type RouteErrorCode =
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_HTTP_ERROR"
  | "UPSTREAM_NON_JSON_ERROR"
  | "UPSTREAM_BAD_PAYLOAD"
  | "OPENROUTER_API_KEY_MISSING"
  | "BRIEF_SCHEMA_VALIDATION_FAILED"
  | "CODE_SCHEMA_VALIDATION_FAILED"
  | "COMPONENT_CODE_MISSING"
  | "INTERNAL_ERROR";

const ROUTE_ERROR_USER_MESSAGES: Record<RouteErrorCode, string> = {
  UPSTREAM_TIMEOUT: "Сервис генерации временно отвечает слишком долго.",
  UPSTREAM_HTTP_ERROR: "Не удалось сгенерировать сайт с первого раза. Попробуйте ещё раз.",
  UPSTREAM_NON_JSON_ERROR: "Не удалось сгенерировать сайт с первого раза. Попробуйте ещё раз.",
  UPSTREAM_BAD_PAYLOAD: "Не удалось сгенерировать сайт с первого раза. Попробуйте ещё раз.",
  OPENROUTER_API_KEY_MISSING: "Сервис генерации временно недоступен.",
  BRIEF_SCHEMA_VALIDATION_FAILED: "Не удалось сгенерировать сайт с первого раза. Попробуйте ещё раз.",
  CODE_SCHEMA_VALIDATION_FAILED: "Не удалось сгенерировать сайт с первого раза. Попробуйте ещё раз.",
  COMPONENT_CODE_MISSING: "Не получилось собрать preview. Можно попробовать автоисправление.",
  INTERNAL_ERROR: "Не удалось сгенерировать сайт с первого раза. Попробуйте ещё раз."
};

class RouteError extends Error {
  code: RouteErrorCode;
  userMessage: string;
  retryable: boolean;
  details: Record<string, unknown>;

  constructor(input: {
    code: RouteErrorCode;
    message: string;
    userMessage: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.code = input.code;
    this.userMessage = input.userMessage;
    this.retryable = Boolean(input.retryable);
    this.details = input.details || {};
  }
}

function userMessageForRouteError(error: RouteError) {
  return ROUTE_ERROR_USER_MESSAGES[error.code] || error.userMessage || ROUTE_ERROR_USER_MESSAGES.INTERNAL_ERROR;
}

function normalizeProfile(raw: any): AgentProfile {
  return {
    businessName: String(raw?.businessName || "").trim(),
    niche: String(raw?.niche || "").trim(),
    city: String(raw?.city || "").trim(),
    goal: String(raw?.goal || "").trim(),
    style: String(raw?.style || "").trim(),
    styleReference: String(raw?.styleReference || "").trim(),
    mustHave: Array.isArray(raw?.mustHave) ? raw.mustHave.map((x: unknown) => String(x)) : []
  };
}

function parseComponentCodeFromModel(raw: string) {
  const parsed = parseJsonFromText(raw);
  let candidate = "";
  if (parsed && typeof parsed === "object") {
    const p = parsed as Record<string, unknown>;
    const fromJson =
      (typeof p.componentCode === "string" && p.componentCode) ||
      (typeof p.code === "string" && p.code) ||
      (typeof p.appCode === "string" && p.appCode) ||
      (typeof p.jsx === "string" && p.jsx) ||
      (typeof p.appJsx === "string" && p.appJsx) ||
      "";
    candidate = String(fromJson).trim();
  }
  if (!candidate) candidate = extractCodeBlock(raw);
  if (!candidate && looksLikeReactComponent(raw)) candidate = String(raw || "").trim();
  if (!looksLikeReactComponent(candidate)) return "";
  return candidate;
}

async function readRequestBody(req: any): Promise<Record<string, unknown>> {
  if (req?.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  if (typeof req?.body === "string") {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function readResponseSafe(response: Response) {
  const status = response.status;
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text();
  const trimmed = text.trim();
  let json: any = null;
  let parseError = "";
  if (trimmed) {
    try {
      json = JSON.parse(trimmed);
    } catch (error: any) {
      parseError = String(error?.message || "json_parse_failed");
      json = parseJsonFromText(trimmed);
    }
  }
  const looksJson = contentType.includes("application/json") || (trimmed.startsWith("{") && trimmed.endsWith("}"));
  return {
    ok: response.ok,
    status,
    contentType,
    text,
    json,
    looksJson,
    parseError
  };
}

async function openRouterCompletion(input: {
  apiKey: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  timeoutMs: number;
  temperature?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: input.model,
          temperature: typeof input.temperature === "number" ? input.temperature : 0.7,
          max_tokens: 6200,
          messages: [
            {
              role: "system",
              content: input.systemPrompt || "You are a senior React + Tailwind website generator. Return only requested output format."
            },
            { role: "user", content: input.userPrompt }
          ]
        }),
        signal: controller.signal
      });
    } catch (error: any) {
      const isAbort = String(error?.name || "").toLowerCase() === "aborterror";
      throw new RouteError({
        code: isAbort ? "UPSTREAM_TIMEOUT" : "UPSTREAM_HTTP_ERROR",
        message: isAbort ? "openrouter_timeout" : `openrouter_fetch_failed:${compact(error?.message || "unknown")}`,
        userMessage: "Сервис генерации временно недоступен. Попробуйте ещё раз.",
        retryable: true,
        details: { name: String(error?.name || ""), message: String(error?.message || "") }
      });
    }

    const parsed = await readResponseSafe(response);
    if (!parsed.ok) {
      const parsedError = parsed.json?.error?.message || parsed.json?.error || "";
      const isTimeoutLike =
        parsed.status === 504 ||
        String(parsed.text || "").toLowerCase().includes("function_invocation_timeout") ||
        String(parsed.text || "").toLowerCase().includes("gateway timeout");
      const isNonJsonErrorPage =
        !parsed.looksJson &&
        (parsed.contentType.includes("text/plain") || parsed.contentType.includes("text/html"));
      throw new RouteError({
        code: isTimeoutLike ? "UPSTREAM_TIMEOUT" : isNonJsonErrorPage ? "UPSTREAM_NON_JSON_ERROR" : "UPSTREAM_HTTP_ERROR",
        message: `openrouter_http_${parsed.status}:${compact(parsedError || parsed.text || "unknown_error")}`,
        userMessage: isTimeoutLike
          ? "Генерация заняла слишком много времени. Попробуйте ещё раз."
          : "Сервис генерации вернул ошибку. Попробуйте ещё раз.",
        retryable: isTimeoutLike || parsed.status >= 500,
        details: {
          status: parsed.status,
          contentType: parsed.contentType,
          parseError: parsed.parseError,
          snippet: String(parsed.text || "").slice(0, 240)
        }
      });
    }

    const data = parsed.json;
    const content = data?.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n")
          : typeof parsed.text === "string"
            ? parsed.text
            : "";
    if (!String(text || "").trim()) {
      throw new RouteError({
        code: "UPSTREAM_BAD_PAYLOAD",
        message: "openrouter_empty_payload",
        userMessage: "Сервис генерации вернул пустой ответ. Попробуйте ещё раз.",
        retryable: true,
        details: { status: parsed.status, contentType: parsed.contentType, parseError: parsed.parseError }
      });
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function openRouterCompletionWithRetry(input: {
  apiKey: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  timeoutMs: number;
  temperature?: number;
  retries?: number;
}) {
  const retries = Math.max(0, Number(input.retries || 0));
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await openRouterCompletion(input);
    } catch (error: any) {
      lastError = error;
      const retryable = error instanceof RouteError ? error.retryable : false;
      if (!retryable || attempt >= retries) break;
    }
  }
  throw lastError;
}

function successPayload(input: {
  sessionId: string;
  round: number;
  brief: WebsiteBrief;
  componentCode: string;
  startedAt: number;
  debugId: string;
  stage: string;
}) {
  return {
    specVersion: "v2-website-builder",
    debug: { id: input.debugId, stage: input.stage },
    sessionId: input.sessionId,
    round: input.round,
    engine: "openrouter",
    brief: input.brief,
    draft: {
      businessName: input.brief.brandName,
      city: input.brief.city,
      niche: input.brief.businessType,
      styleLabel: input.brief.visualDirection,
      summaryPoints: input.brief.contentHints,
      componentCode: input.componentCode,
      pageCode: ""
    },
    stages: [{ id: "pipeline_v2", ms: Date.now() - input.startedAt, source: "openrouter" }],
    candidates: [{ id: "ai-main", engine: "openrouter", score: 100, label: "AI Main" }],
    selectedCandidateId: "ai-main",
    totalMs: Date.now() - input.startedAt,
    history: []
  };
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    const sessionId = String(req.query?.sessionId || "").trim();
    res.status(200).json({ sessionId, history: [] });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const debugId = `gen-${Math.random().toString(36).slice(2, 10)}`;
  const startedAt = Date.now();
  let stage = "init";

  try {
    const body = (await readRequestBody(req)) as WebsiteBuilderRequest;
    const sessionId = String(body.sessionId || "").trim() || `session-${Math.random().toString(36).slice(2, 10)}`;
    const round = Math.max(1, Number(body.round || 1));
    const mode: WebsiteBuilderMode = body.mode === "fix" || body.mode === "improve" ? body.mode : "generate";
    const promptPackVersion = String((body as any).promptPack || "A").toUpperCase() === "B" ? "B" : "A";
    const promptPack = getWebsitePromptPack(promptPackVersion);
    const profile = normalizeProfile(body.profile);
    const enrichment = enrichWebsitePrompt(String(body.guidance || "").trim(), profile);
    const guidance = enrichment.normalizedPrompt;
    const currentComponentCode = String(body.currentComponentCode || "").trim();
    const errorText = String(body.errorText || "").trim();

    const apiKey = String(process.env.OPENROUTER_API_KEY || "")
      .replace(/[\r\n\s\u200B-\u200D\uFEFF]+/g, "")
      .trim();
    const modelBrief = String(process.env.OPENROUTER_MODEL_SITES_BRIEF || process.env.OPENROUTER_MODEL_SITES || process.env.OPENROUTER_MODEL || "openai/gpt-4.1").trim();
    const modelCode = String(process.env.OPENROUTER_MODEL_SITES_CODE || process.env.OPENROUTER_MODEL_SITES || process.env.OPENROUTER_MODEL || "openai/gpt-4.1").trim();
    const modelPolish = String(process.env.OPENROUTER_MODEL_SITES_POLISH || process.env.OPENROUTER_MODEL_SITES || process.env.OPENROUTER_MODEL || "openai/gpt-4.1").trim();
    const modelFix = String(process.env.OPENROUTER_MODEL_SITES_FIX || process.env.OPENROUTER_MODEL_SITES || process.env.OPENROUTER_MODEL || "openai/gpt-4.1").trim();
    if (!apiKey) {
      res.status(502).json({
        specVersion: "v2-website-builder",
        debug: { id: debugId, stage: "validate_env", code: "OPENROUTER_API_KEY_MISSING" },
        error: ROUTE_ERROR_USER_MESSAGES.OPENROUTER_API_KEY_MISSING,
        errorCode: "OPENROUTER_API_KEY_MISSING",
        retryable: false,
        sessionId,
        round,
        engine: "openrouter",
        history: []
      });
      return;
    }

    const fallbackBrief = enrichment.brief || buildWebsiteBrief(guidance, profile);

    if (mode === "fix") {
      stage = "fix_request";
      const text = await openRouterCompletionWithRetry({
        apiKey,
        model: modelFix,
        systemPrompt: promptPack.systemGeneration,
        userPrompt: fixCodePrompt({ currentCode: currentComponentCode, errorText }),
        timeoutMs: 22000,
        temperature: 0.3,
        retries: 1
      });
      const fixedCode = parseComponentCodeFromModel(text);
      if (!fixedCode) throw new Error("FIX_COMPONENT_CODE_MISSING");
      res.status(200).json(successPayload({ sessionId, round, brief: fallbackBrief, componentCode: fixedCode, startedAt, debugId, stage: "fix_ok" }));
      return;
    }

    if (mode === "improve") {
      stage = "improve_request";
      const text = await openRouterCompletionWithRetry({
        apiKey,
        model: modelPolish,
        systemPrompt: promptPack.systemPolish,
        userPrompt: improveCodePrompt({ currentCode: currentComponentCode, brief: fallbackBrief }, { promptPack: promptPackVersion }),
        timeoutMs: 26000,
        temperature: 0.8,
        retries: 1
      });
      const improvedCode = parseComponentCodeFromModel(text);
      if (!improvedCode) throw new Error("IMPROVE_COMPONENT_CODE_MISSING");
      res.status(200).json(successPayload({ sessionId, round, brief: fallbackBrief, componentCode: improvedCode, startedAt, debugId, stage: "improve_ok" }));
      return;
    }

    stage = "orchestration";
    const models: WebsiteGenerationModels = {
      brief: modelBrief,
      code: modelCode,
      polish: modelPolish
    };
    let result: Awaited<ReturnType<typeof runWebsiteGenerationFlow>> | null = null;
    try {
      result = await runWebsiteGenerationFlow(
        {
          userPrompt: guidance,
          profile
        },
        {
          complete: (input) =>
            openRouterCompletionWithRetry({
              apiKey,
              model: input.model,
              systemPrompt: input.systemPrompt,
              userPrompt: input.userPrompt,
              timeoutMs: input.timeoutMs,
              temperature: input.temperature,
              retries: input.retries
            }),
          models,
          promptPackVersion,
          promptPack
        }
      );
    } catch (flowError: any) {
      console.error("[sites/generate] orchestration_failed_try_code_only", {
        id: debugId,
        stage,
        message: String(flowError?.message || "unknown")
      });
      stage = "code_only_retry";
      // Non-template emergency path: one more direct code generation attempt from enriched brief.
      const emergencyText = await openRouterCompletionWithRetry({
        apiKey,
        model: modelCode,
        systemPrompt: promptPack.systemGeneration,
        userPrompt:
          "Аварийный режим: верни только содержимое App.jsx (React+Tailwind), без markdown/JSON/комментариев вокруг. " +
          codeGenerationPromptWithOptions(fallbackBrief, { promptPack: promptPackVersion }),
        timeoutMs: 28000,
        temperature: 0.8,
        retries: 1
      });
      const emergencyCode = parseComponentCodeFromModel(emergencyText);
      if (!emergencyCode) throw flowError;
      result = {
        brief: fallbackBrief,
        componentCode: emergencyCode,
        meta: {
          usedFallbackBrief: true,
          usedFallbackCode: false,
          usedPolish: false,
          normalizedGuidance: guidance
        }
      };
    }

    res.status(200).json(
      successPayload({
        sessionId,
        round,
        brief: result!.brief,
        componentCode: result!.componentCode,
        startedAt,
        debugId,
        stage: "ok"
      })
    );
  } catch (error: any) {
    const routeError =
      error instanceof RouteError
        ? error
        : new RouteError({
            code: "INTERNAL_ERROR",
            message: compact(error?.message || "unknown"),
            userMessage: "Не удалось сгенерировать сайт. Попробуйте ещё раз.",
            retryable: true,
            details: {}
          });
    // detailed log only in dev/server logs, not leaked to user-facing UI
    console.error("[sites/generate] error", {
      id: debugId,
      stage,
      code: routeError.code,
      message: routeError.message,
      retryable: routeError.retryable,
      details: routeError.details
    });

    res.status(routeError.code === "UPSTREAM_TIMEOUT" ? 504 : 500).json({
      specVersion: "v2-website-builder",
      debug: {
        id: debugId,
        stage,
        code: routeError.code,
        message: routeError.message
      },
      error: userMessageForRouteError(routeError),
      errorCode: routeError.code,
      retryable: routeError.retryable,
      sessionId: String((req?.body as any)?.sessionId || `session-${Math.random().toString(36).slice(2, 10)}`),
      round: Number((req?.body as any)?.round || 1),
      engine: "openrouter",
      history: []
    });
  }
}
