declare const process: { env: Record<string, string | undefined> };

import {
  compact,
  extractCodeBlock,
  inferFallbackBrief,
  looksLikeReactComponent,
  looksLowQualityComponent,
  parseJsonFromText,
  sanitizeBrief
} from "../../lib/sites/websiteBuilderHelpers";
import { isValidCodePayloadShape, isValidWebsiteBriefShape } from "../../lib/sites/websiteBuilderValidation";
import {
  briefExtractionPrompt,
  codeGenerationPromptWithOptions,
  fixCodePrompt,
  improveCodePrompt,
  getWebsitePromptPack
} from "../../lib/sites/websiteBuilderPrompts";
import { WebsiteBrief, WebsiteBuilderMode, WebsiteBuilderRequest } from "../../lib/sites/websiteBuilderTypes";

type AgentProfile = {
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  style: string;
  styleReference: string;
  mustHave: string[];
};

export const config = { maxDuration: 60 };

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
  const candidate =
    isValidCodePayloadShape(parsed) && typeof (parsed as any).componentCode === "string"
      ? String((parsed as any).componentCode).trim()
      : extractCodeBlock(raw);
  if (!looksLikeReactComponent(candidate)) return "";
  return candidate;
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
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
    const data = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      throw new Error(`openrouter_http_${response.status}:${compact(data?.error?.message || data?.error || "unknown_error")}`);
    }
    const content = data?.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n")
          : "";
    return text;
  } finally {
    clearTimeout(timeout);
  }
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
    const body = (req.body || {}) as WebsiteBuilderRequest;
    const sessionId = String(body.sessionId || "").trim() || `session-${Math.random().toString(36).slice(2, 10)}`;
    const round = Math.max(1, Number(body.round || 1));
    const mode: WebsiteBuilderMode = body.mode === "fix" || body.mode === "improve" ? body.mode : "generate";
    const promptPackVersion = String((req.body || {}).promptPack || "A").toUpperCase() === "B" ? "B" : "A";
    const promptPack = getWebsitePromptPack(promptPackVersion);
    const guidance = String(body.guidance || "").trim();
    const currentComponentCode = String(body.currentComponentCode || "").trim();
    const errorText = String(body.errorText || "").trim();
    const profile = normalizeProfile(body.profile);

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
        error: "OPENROUTER_API_KEY is not configured",
        sessionId,
        round,
        engine: "openrouter",
        history: []
      });
      return;
    }

    const fallbackBrief = inferFallbackBrief({
      guidance,
      businessName: profile.businessName,
      niche: profile.niche,
      city: profile.city,
      goal: profile.goal,
      style: profile.style,
      mustHave: profile.mustHave
    });

    if (mode === "fix") {
      stage = "fix_request";
      const text = await openRouterCompletion({
        apiKey,
        model: modelFix,
        systemPrompt: promptPack.systemGeneration,
        userPrompt: fixCodePrompt({ currentCode: currentComponentCode, errorText }),
        timeoutMs: 22000,
        temperature: 0.3
      });
      const fixedCode = parseComponentCodeFromModel(text);
      if (!fixedCode) throw new Error("FIX_COMPONENT_CODE_MISSING");
      res.status(200).json(successPayload({ sessionId, round, brief: fallbackBrief, componentCode: fixedCode, startedAt, debugId, stage: "fix_ok" }));
      return;
    }

    if (mode === "improve") {
      stage = "improve_request";
      const text = await openRouterCompletion({
        apiKey,
        model: modelPolish,
        systemPrompt: promptPack.systemPolish,
        userPrompt: improveCodePrompt({ currentCode: currentComponentCode, brief: fallbackBrief }, { promptPack: promptPackVersion }),
        timeoutMs: 26000,
        temperature: 0.8
      });
      const improvedCode = parseComponentCodeFromModel(text);
      if (!improvedCode) throw new Error("IMPROVE_COMPONENT_CODE_MISSING");
      res.status(200).json(successPayload({ sessionId, round, brief: fallbackBrief, componentCode: improvedCode, startedAt, debugId, stage: "improve_ok" }));
      return;
    }

    stage = "brief_request";
    const requestBrief = async () =>
      openRouterCompletion({
        apiKey,
        model: modelBrief,
        systemPrompt: promptPack.systemBrief,
        userPrompt: briefExtractionPrompt({
          guidance,
          businessName: profile.businessName,
          niche: profile.niche,
          city: profile.city,
          goal: profile.goal,
          style: profile.style,
          styleReference: profile.styleReference,
          mustHave: profile.mustHave
        }, { promptPack: promptPackVersion }),
        timeoutMs: 18000,
        temperature: 0.2
      });
    const briefText = await requestBrief();
    let briefRaw = parseJsonFromText(briefText);
    if (!isValidWebsiteBriefShape(briefRaw)) {
      const strictBriefText = await openRouterCompletion({
        apiKey,
        model: modelBrief,
        systemPrompt: promptPack.systemBrief,
        userPrompt:
          "Верни строго валидный JSON по схеме без пропусков полей и без markdown. " +
          briefExtractionPrompt({
            guidance,
            businessName: profile.businessName,
            niche: profile.niche,
            city: profile.city,
            goal: profile.goal,
            style: profile.style,
            styleReference: profile.styleReference,
            mustHave: profile.mustHave
          }, { promptPack: promptPackVersion }),
        timeoutMs: 18000,
        temperature: 0.1
      });
      briefRaw = parseJsonFromText(strictBriefText);
    }
    if (!isValidWebsiteBriefShape(briefRaw)) {
      throw new Error("BRIEF_SCHEMA_VALIDATION_FAILED");
    }
    const brief = sanitizeBrief(briefRaw, fallbackBrief);

    stage = "code_request";
    const requestCode = async (prompt: string, temperature = 0.85) =>
      openRouterCompletion({
        apiKey,
        model: modelCode,
        systemPrompt: promptPack.systemGeneration,
        userPrompt: prompt,
        timeoutMs: 26000,
        temperature
      });
    const codeText = await requestCode(codeGenerationPromptWithOptions(brief, { promptPack: promptPackVersion }), 0.85);
    let parsedCodeRaw = parseJsonFromText(codeText);
    if (!isValidCodePayloadShape(parsedCodeRaw)) {
      const strictCodeText = await requestCode(
        'Верни строго JSON формата {"componentCode":"..."} без markdown и без лишних полей. ' +
          codeGenerationPromptWithOptions(brief, { promptPack: promptPackVersion }),
        0.8
      );
      parsedCodeRaw = parseJsonFromText(strictCodeText);
      if (!isValidCodePayloadShape(parsedCodeRaw)) {
        throw new Error("CODE_SCHEMA_VALIDATION_FAILED");
      }
    }
    let componentCode = parseComponentCodeFromModel(
      JSON.stringify({
        componentCode: String((parsedCodeRaw as any).componentCode || "")
      })
    );
    if (!componentCode) throw new Error("COMPONENT_CODE_MISSING");

    if (looksLowQualityComponent(componentCode)) {
      stage = "quality_improve_request";
      const improveText = await openRouterCompletion({
        apiKey,
        model: modelPolish,
        systemPrompt: promptPack.systemPolish,
        userPrompt: improveCodePrompt({ currentCode: componentCode, brief }, { promptPack: promptPackVersion }),
        timeoutMs: 22000,
        temperature: 0.85
      });
      const improved = parseComponentCodeFromModel(improveText);
      if (improved) componentCode = improved;
    }

    res.status(200).json(successPayload({ sessionId, round, brief, componentCode, startedAt, debugId, stage: "ok" }));
  } catch (error: any) {
    res.status(500).json({
      specVersion: "v2-website-builder",
      debug: {
        id: debugId,
        stage,
        code: "UNCAUGHT_EXCEPTION",
        message: compact(error?.message || "unknown")
      },
      error: compact(error?.message || "unknown"),
      sessionId: `session-${Math.random().toString(36).slice(2, 10)}`,
      round: 1,
      engine: "openrouter",
      history: []
    });
  }
}
