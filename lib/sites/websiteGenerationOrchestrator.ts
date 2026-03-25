import {
  buildWebsiteBrief,
  enrichWebsitePrompt,
  extractCodeBlock,
  looksLikeReactComponent,
  looksLowQualityComponent,
  parseJsonFromText,
  sanitizeBrief
} from "./websiteBuilderHelpers";
import { isValidCodePayloadShape, isValidWebsiteBriefShape } from "./websiteBuilderValidation";
import { briefExtractionPrompt, codeGenerationPromptWithOptions, improveCodePrompt } from "./websiteBuilderPrompts";
import type { WebsiteBrief, WebsiteGenerationFlowResult, WebsiteGenerationModels, WebsiteGenerationProfile } from "./websiteBuilderTypes";

type CompletionInput = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  timeoutMs: number;
  retries: number;
};

type OrchestrationDeps = {
  complete: (input: CompletionInput) => Promise<string>;
  models: WebsiteGenerationModels;
  promptPackVersion: string;
  promptPack: {
    systemBrief: string;
    systemGeneration: string;
    systemPolish: string;
  };
};

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
  return looksLikeReactComponent(candidate) ? candidate : "";
}

export async function runWebsiteGenerationFlow(
  input: {
    userPrompt: string;
    profile: WebsiteGenerationProfile;
  },
  deps: OrchestrationDeps
): Promise<WebsiteGenerationFlowResult> {
  const enrichment = enrichWebsitePrompt(input.userPrompt, input.profile);
  const normalizedGuidance = enrichment.normalizedPrompt;
  const fallbackBrief = enrichment.brief || buildWebsiteBrief(normalizedGuidance, input.profile);

  // Step 1: brief extraction
  let briefRaw = await deps.complete({
    model: deps.models.brief,
    systemPrompt: deps.promptPack.systemBrief,
    userPrompt: briefExtractionPrompt(
      {
        guidance: normalizedGuidance,
        businessName: input.profile.businessName,
        niche: input.profile.niche,
        city: input.profile.city,
        goal: input.profile.goal,
        style: input.profile.style,
        styleReference: input.profile.styleReference,
        mustHave: input.profile.mustHave
      },
      { promptPack: deps.promptPackVersion }
    ),
    temperature: 0.2,
    timeoutMs: 18000,
    retries: 1
  });
  let briefParsed = parseJsonFromText(briefRaw);
  let usedFallbackBrief = false;
  if (!isValidWebsiteBriefShape(briefParsed)) {
    const strictBriefText = await deps.complete({
      model: deps.models.brief,
      systemPrompt: deps.promptPack.systemBrief,
      userPrompt:
        "Верни строго валидный JSON по схеме без пропусков полей и без markdown. " +
        briefExtractionPrompt(
          {
            guidance: normalizedGuidance,
            businessName: input.profile.businessName,
            niche: input.profile.niche,
            city: input.profile.city,
            goal: input.profile.goal,
            style: input.profile.style,
            styleReference: input.profile.styleReference,
            mustHave: input.profile.mustHave
          },
          { promptPack: deps.promptPackVersion }
        ),
      temperature: 0.1,
      timeoutMs: 18000,
      retries: 0
    });
    briefParsed = parseJsonFromText(strictBriefText);
  }
  if (!isValidWebsiteBriefShape(briefParsed)) usedFallbackBrief = true;
  const brief = sanitizeBrief(isValidWebsiteBriefShape(briefParsed) ? briefParsed : fallbackBrief, fallbackBrief);

  // Step 2: App.jsx generation
  const codeText = await deps.complete({
    model: deps.models.code,
    systemPrompt: deps.promptPack.systemGeneration,
    userPrompt: codeGenerationPromptWithOptions(brief, { promptPack: deps.promptPackVersion }),
    temperature: 0.85,
    timeoutMs: 26000,
    retries: 2
  });
  let parsedCodeRaw = parseJsonFromText(codeText);
  let componentCode = parseComponentCodeFromModel(codeText);
  if (!componentCode && !isValidCodePayloadShape(parsedCodeRaw)) {
    const strictCodeText = await deps.complete({
      model: deps.models.code,
      systemPrompt: deps.promptPack.systemGeneration,
      userPrompt:
        'Верни строго JSON формата {"componentCode":"..."} без markdown и без лишних полей. ' +
        codeGenerationPromptWithOptions(brief, { promptPack: deps.promptPackVersion }),
      temperature: 0.8,
      timeoutMs: 24000,
      retries: 0
    });
    parsedCodeRaw = parseJsonFromText(strictCodeText);
    componentCode = parseComponentCodeFromModel(strictCodeText);
  }
  if (!componentCode) {
    componentCode = parseComponentCodeFromModel(
      JSON.stringify({
        componentCode: String((parsedCodeRaw as any)?.componentCode || "")
      })
    );
  }
  if (!componentCode) {
    // Final non-template fallback: ask model to return plain App.jsx code (no JSON wrapper).
    const plainCodeText = await deps.complete({
      model: deps.models.code,
      systemPrompt: deps.promptPack.systemGeneration,
      userPrompt:
        "Верни только содержимое App.jsx без JSON, markdown и комментариев вокруг. " +
        codeGenerationPromptWithOptions(brief, { promptPack: deps.promptPackVersion }),
      temperature: 0.75,
      timeoutMs: 26000,
      retries: 1
    });
    componentCode = parseComponentCodeFromModel(plainCodeText);
  }
  if (!componentCode) {
    throw new Error("CODE_SCHEMA_VALIDATION_FAILED");
  }

  let usedPolish = false;
  if (looksLowQualityComponent(componentCode)) {
    const improveText = await deps.complete({
      model: deps.models.polish,
      systemPrompt: deps.promptPack.systemPolish,
      userPrompt: improveCodePrompt({ currentCode: componentCode, brief }, { promptPack: deps.promptPackVersion }),
      temperature: 0.85,
      timeoutMs: 22000,
      retries: 0
    });
    const improved = parseComponentCodeFromModel(improveText);
    if (improved) {
      componentCode = improved;
      usedPolish = true;
    }
  }

  return {
    brief,
    componentCode,
    meta: {
      usedFallbackBrief,
      usedFallbackCode: false,
      usedPolish,
      normalizedGuidance
    }
  };
}
