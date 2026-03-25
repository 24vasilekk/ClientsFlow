import type { WebsiteBrief } from "./websiteBuilderTypes";

export type WebsitePromptPackVersion = "A" | "B";

type WebsitePromptPack = {
  version: WebsitePromptPackVersion;
  label: string;
  systemGeneration: string;
  systemBrief: string;
  systemPolish: string;
  designConstraints: string;
  antiGenericRules: string;
  contentRules: string;
};

const DESIGN_CONSTRAINTS_BASE = [
  "Делай визуал уровня современного коммерческого лендинга, а не учебного макета.",
  "Сильный hero: крупный контрастный заголовок, ясный оффер, заметный primary CTA.",
  "Премиальная композиция: иерархия, ритм отступов, продуманные карточки, аккуратные границы/фоновые слои.",
  "Типографика: выразительные заголовки, читабельный body, правильные размеры на mobile/desktop.",
  "Сетка: адаптивные колонки и уверенные блоки, без пустых широких зон.",
  "CTA должны быть заметными, с явной бизнес-целью (запись/заявка/консультация).",
  "Дизайн должен выглядеть цельно и коммерчески, без случайных цветов и без 'default tailwind demo' вида."
].join("\n");

const DESIGN_CONSTRAINTS_PACK_A = [
  "Визуальный язык pack A: контрастный editorial premium, dark-led или dual-tone палитра, сильные акценты.",
  "Фокус на смелом hero и эффектных карточках с плотным коммерческим контентом."
].join("\n");

const DESIGN_CONSTRAINTS_PACK_B = [
  "Визуальный язык pack B: современный clean-luxury, светлая/нейтральная база с премиальными акцентами.",
  "Фокус на изящной типографике, аккуратной сетке и визуальной дисциплине enterprise-уровня."
].join("\n");

const ANTI_GENERIC_RULES_BASE = [
  "Запрещены заглушки: Studio Name, Company Name, Business Name, Lorem Ipsum, placeholder text.",
  "Запрещен примитивный шаблон: простой белый фон + черная шапка + 2-3 пустых секции.",
  "Не делай однотипные карточки без смысловой иерархии и контентной плотности.",
  "Не возвращай короткий обрубок лендинга; нужен полноценный конверсионный сценарий."
].join("\n");

const CONTENT_RULES_BASE = [
  "Тексты должны быть реалистичными коммерческими, под конкретную нишу и город из brief.",
  "Для локального бизнеса используй город в оффере, CTA и контактном блоке.",
  "Добавляй секции, повышающие конверсию: преимущества, услуги/пакеты, отзывы, FAQ, запись, контакты.",
  "Используй массивы данных + map() для повторяющихся блоков (services/testimonials/faq/metrics).",
  "У каждой секции должна быть функция в воронке: доверие, аргументация, действие."
].join("\n");

const PROMPT_PACKS: Record<WebsitePromptPackVersion, WebsitePromptPack> = {
  A: {
    version: "A",
    label: "Editorial Premium",
    systemGeneration: [
      "You are a principal frontend designer-engineer for high-conversion premium landing pages.",
      "Return only valid JSON payloads requested by user prompts.",
      "No markdown fences, no explanations, no prose outside JSON.",
      "Generated React code must be visually strong, non-generic, commercially convincing."
    ].join("\n"),
    systemBrief: [
      "You are a strict information extraction engine.",
      "Return only JSON matching requested schema.",
      "Infer missing fields from context while preserving business plausibility."
    ].join("\n"),
    systemPolish: [
      "You are a senior creative frontend polish specialist.",
      "Make landing pages feel premium, editorial, and conversion-focused while preserving business context.",
      "Return only JSON with componentCode."
    ].join("\n"),
    designConstraints: `${DESIGN_CONSTRAINTS_BASE}\n${DESIGN_CONSTRAINTS_PACK_A}`,
    antiGenericRules: ANTI_GENERIC_RULES_BASE,
    contentRules: CONTENT_RULES_BASE
  },
  B: {
    version: "B",
    label: "Clean Luxury",
    systemGeneration: [
      "You are a principal frontend designer-engineer for modern commercial websites.",
      "Return only valid JSON payloads requested by user prompts.",
      "No markdown fences, no explanations.",
      "Output should look like a polished agency-grade commercial landing page."
    ].join("\n"),
    systemBrief: [
      "You are a strict information extraction engine.",
      "Return only JSON matching requested schema.",
      "When missing fields, infer sensible defaults from business context."
    ].join("\n"),
    systemPolish: [
      "You are a senior visual polish expert for commercial landing pages.",
      "Upgrade hierarchy, composition, spacing and CTA clarity with clean-luxury direction.",
      "Return only JSON with componentCode."
    ].join("\n"),
    designConstraints: `${DESIGN_CONSTRAINTS_BASE}\n${DESIGN_CONSTRAINTS_PACK_B}`,
    antiGenericRules: ANTI_GENERIC_RULES_BASE,
    contentRules: CONTENT_RULES_BASE
  }
};

export function getWebsitePromptPack(version?: string): WebsitePromptPack {
  return version === "B" ? PROMPT_PACKS.B : PROMPT_PACKS.A;
}

export const WEBSITE_PROMPTS = getWebsitePromptPack("A");

export function briefExtractionPrompt(input: {
  guidance: string;
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  style: string;
  styleReference: string;
  mustHave: string[];
}, options?: { promptPack?: string }) {
  const pack = getWebsitePromptPack(options?.promptPack);
  return [
    "Извлеки структурированный brief для генерации коммерческого сайта высокого уровня.",
    "Верни только JSON, без пояснений и markdown.",
    "Если данных не хватает — дострой логично из контекста, избегай null без причины.",
    "Ориентируйся на коммерческую задачу: конверсия, доверие, запись/заявка, локальная релевантность.",
    `Prompt pack: ${pack.version} (${pack.label})`,
    'Схема JSON: {"businessType":string,"city":string,"brandName":string,"targetAudience":string,"styleKeywords":string[],"tone":string,"primaryGoal":string,"primaryCTA":string,"sections":string[],"colorDirection":string,"visualDirection":string,"contentHints":string[],"needsContactForm":boolean,"needsPricing":boolean,"needsTestimonials":boolean,"needsMap":boolean}',
    `Запрос пользователя: ${input.guidance || "-"}`,
    `Подсказки профиля: businessName=${input.businessName || "-"}; niche=${input.niche || "-"}; city=${input.city || "-"}; goal=${input.goal || "-"}; style=${input.style || "-"}; styleReference=${input.styleReference || "-"}`,
    `mustHave: ${(input.mustHave || []).join(", ") || "-"}`
  ].join("\n");
}

export function codeGenerationPrompt(brief: WebsiteBrief) {
  return codeGenerationPromptWithOptions(brief, {});
}

export function codeGenerationPromptWithOptions(brief: WebsiteBrief, options: { promptPack?: string; extraInstruction?: string }) {
  const pack = getWebsitePromptPack(options.promptPack);
  return [
    "На основе brief сгенерируй один самодостаточный React-компонент для preview-сайта.",
    "Верни строго JSON: {\"componentCode\":\"...\"}.",
    "Только содержимое App.jsx, без markdown и комментариев вокруг.",
    "Требования: React JSX, Tailwind CSS, без внешних API и без импортов сторонних библиотек.",
    "Компонент должен рендериться в одном файле.",
    "Код ориентир: 250+ строк содержимого, включая реальные секции и контент.",
    "Добавь выразительную визуальную систему (фоновые слои, акценты, глубина карточек), но без внешних библиотек.",
    "Явно используй многошаговую конверсионную структуру: hero -> value -> social proof -> action.",
    `Prompt pack: ${pack.version} (${pack.label})`,
    "Design constraints:\n" + pack.designConstraints,
    "Anti-generic rules:\n" + pack.antiGenericRules,
    "Content rules:\n" + pack.contentRules,
    options.extraInstruction ? `Доп. инструкция: ${options.extraInstruction}` : "",
    `BRIEF_JSON: ${JSON.stringify(brief)}`
  ]
    .filter(Boolean)
    .join("\n");
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

export function improveCodePrompt(input: { currentCode: string; brief: WebsiteBrief; instruction?: string }, options?: { promptPack?: string }) {
  const pack = getWebsitePromptPack(options?.promptPack);
  return [
    "Улучши React+Tailwind landing page до уровня современного коммерческого сайта.",
    "Сделай дизайн дороже и выразительнее, усили hero, визуальную иерархию и CTA.",
    "Сохрани тему бизнеса и адаптивность.",
    "Ограничение: один файл App.jsx, без внешних библиотек.",
    "При полировке не ломай контентную логику и секции, а усиливай композицию, типографику и конверсию.",
    `Prompt pack: ${pack.version} (${pack.label})`,
    "Design constraints:\n" + pack.designConstraints,
    "Anti-generic rules:\n" + pack.antiGenericRules,
    "Content rules:\n" + pack.contentRules,
    input.instruction ? `Доп. задача: ${input.instruction}` : "",
    "Верни строго JSON: {\"componentCode\":\"...\"}.",
    `BRIEF_JSON: ${JSON.stringify(input.brief)}`,
    `Текущий код:\n${input.currentCode || ""}`
  ]
    .filter(Boolean)
    .join("\n");
}
