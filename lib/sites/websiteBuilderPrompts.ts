import { WebsiteBrief } from "./websiteBuilderTypes";

export function briefExtractionPrompt(input: {
  guidance: string;
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  style: string;
  styleReference: string;
  mustHave: string[];
}) {
  return [
    "Извлеки структурированный brief для генерации коммерческого сайта.",
    "Верни только JSON, без пояснений и markdown.",
    "Если данных не хватает — логично дострой из контекста, но избегай null.",
    'Схема JSON: {"businessType":string,"city":string,"brandName":string,"targetAudience":string,"styleKeywords":string[],"tone":string,"primaryGoal":string,"primaryCTA":string,"sections":string[],"colorDirection":string,"visualDirection":string,"contentHints":string[],"needsContactForm":boolean,"needsPricing":boolean,"needsTestimonials":boolean,"needsMap":boolean}',
    `Запрос пользователя: ${input.guidance || "-"}`,
    `Подсказки профиля: businessName=${input.businessName || "-"}; niche=${input.niche || "-"}; city=${input.city || "-"}; goal=${input.goal || "-"}; style=${input.style || "-"}; styleReference=${input.styleReference || "-"}`,
    `mustHave: ${(input.mustHave || []).join(", ") || "-"}`
  ].join("\n");
}

export function codeGenerationPrompt(brief: WebsiteBrief) {
  return [
    "На основе brief сгенерируй один самодостаточный React-компонент для preview-сайта.",
    "Верни строго JSON: {\"componentCode\":\"...\"}.",
    "Только содержимое App.jsx, без markdown и комментариев вокруг.",
    "Требования: React JSX, Tailwind CSS, без внешних API и без импортов сторонних библиотек.",
    "Компонент должен рендериться в одном файле.",
    "Дизайн: современный коммерческий landing page, сильный hero, premium-композиция, крупные CTA, хорошая типографика, адаптив.",
    "Избегай шаблонности и учебного вида.",
    "Контент должен быть реалистичным под нишу и город.",
    `BRIEF_JSON: ${JSON.stringify(brief)}`
  ].join("\n");
}

export function fixCodePrompt(input: { currentCode: string; errorText: string }) {
  return [
    "Ты исправляешь React/Tailwind код сайта.",
    "Исправь ошибку сборки/рендера, сохрани дизайн и структуру максимально близко.",
    "Измени только то, что нужно для исправления.",
    "Верни строго JSON: {\"componentCode\":\"...\"}.",
    "Никаких пояснений вокруг кода.",
    `Ошибка: ${input.errorText || "-"}`,
    `Текущий код:\n${input.currentCode || ""}`
  ].join("\n");
}

export function improveCodePrompt(input: { currentCode: string; brief: WebsiteBrief }) {
  return [
    "Улучши React+Tailwind landing page до уровня современного коммерческого сайта.",
    "Сделай дизайн дороже и выразительнее, усили hero, визуальную иерархию и CTA.",
    "Сохрани тему бизнеса и адаптивность.",
    "Ограничение: один файл App.jsx, без внешних библиотек.",
    "Верни строго JSON: {\"componentCode\":\"...\"}.",
    `BRIEF_JSON: ${JSON.stringify(input.brief)}`,
    `Текущий код:\n${input.currentCode || ""}`
  ].join("\n");
}
