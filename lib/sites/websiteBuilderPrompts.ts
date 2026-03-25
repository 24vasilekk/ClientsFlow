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

const SYSTEM_WEBSITE_GENERATOR_CORE = [
  "You are a senior AI website generator focused on business landing pages.",
  "Your task is to create visually strong, conversion-oriented frontend websites for real businesses.",
  "Output must be production-minded preview code quality, not demo-template quality.",
  "Default stack: React + Tailwind.",
  "Return one self-contained App.jsx.",
  "No backend.",
  "No unnecessary external libraries.",
  "Design direction: premium, modern, commercially credible.",
  "Mandatory conversion structure: hero, clear CTA, relevant business sections, trust signals, social proof/reviews, contact block.",
  "Avoid weak output: generic banners, empty white cards, tutorial-like layout, weak typography, shallow hierarchy.",
  "If user input is sparse, infer realistic business context and complete missing details intelligently.",
  "For local businesses, use city context in hero/offer/CTA/contacts copy.",
  "Local market adaptation: for Russian-speaking requests, use Russia-local copy style, practical direct wording, and local trust cues.",
  "Return only required payload format. No markdown fences, no extra explanations."
].join("\n");

const SYSTEM_BRIEF_EXTRACTION_CORE = [
  "You are a strict brief extraction engine for website generation.",
  "Return only JSON matching requested schema exactly.",
  "Fill missing fields with business-plausible defaults from context.",
  "Never return null fields unless explicitly impossible.",
  "Keep the brief conversion-oriented and commercially usable."
].join("\n");

const SYSTEM_REPAIR_CORE = [
  "You are a React+Tailwind repair specialist for single-file preview apps.",
  "Goal: fix build/runtime issues with minimal required changes.",
  "Preserve design and structure as much as possible.",
  "Return only requested payload format."
].join("\n");

const SYSTEM_POLISH_CORE = [
  "You are a senior landing-page design polish specialist.",
  "Upgrade visual hierarchy, typography, spacing, CTA clarity and premium feel.",
  "Keep business context and responsiveness intact.",
  "Return only requested payload format."
].join("\n");

const DESIGN_CONSTRAINTS_BASE = [
  "Делай визуал уровня современного коммерческого лендинга, а не учебного макета.",
  "Сильный hero: крупный контрастный заголовок, ясный оффер, заметный primary CTA.",
  "Hero должен быть визуально доминирующим блоком первого экрана: headline, подзаголовок с выгодой, заметная CTA-группа.",
  "Премиальная композиция: иерархия, ритм отступов, продуманные карточки, аккуратные границы/фоновые слои.",
  "Визуальная иерархия обязательна: крупные заголовки, вторичные подзаголовки, акцентные элементы, читаемая градация контента.",
  "Контраст обязателен: фон/текст/CTA должны визуально различаться и вести пользователя по воронке.",
  "Типографика: выразительные заголовки, читабельный body, правильные размеры на mobile/desktop.",
  "Используй крупные блоки и уверенный spacing: секции не должны выглядеть мелкими или сжатыми.",
  "Сетка: адаптивные колонки и уверенные блоки, без пустых широких зон.",
  "Карточки должны быть аккуратными и премиальными: ясная структура, отступы, визуальная глубина, не плоские и не случайные.",
  "CTA должны быть заметными, с явной бизнес-целью (запись/заявка/консультация).",
  "Добавляй продуманные акценты (контрастные кнопки, выделение ключевых выгод, визуальные ритмы между секциями).",
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
  "Запрещены скучные белые блоки без композиции и контрастных акцентов.",
  "Запрещены шаблонные учебные секции без коммерческой функции и визуальной иерархии.",
  "Не делай однотипные карточки без смысловой иерархии и контентной плотности.",
  "Не возвращай короткий обрубок лендинга; нужен полноценный конверсионный сценарий."
].join("\n");

const CONTENT_RULES_BASE = [
  "Тексты должны быть реалистичными коммерческими, под конкретную нишу и город из brief.",
  "Для локального бизнеса используй город в оффере, CTA и контактном блоке.",
  "Добавляй секции, повышающие конверсию: преимущества, услуги/пакеты, отзывы, FAQ, запись, контакты.",
  "Hero-контент должен быть конкретным: сильный заголовок + понятный оффер + четкий первый шаг для клиента.",
  "Используй массивы данных + map() для повторяющихся блоков (services/testimonials/faq/metrics).",
  "Усиливай коммерческую читаемость: короткие понятные формулировки, ясные выгоды, видимые CTA в ключевых точках.",
  "У каждой секции должна быть функция в воронке: доверие, аргументация, действие."
].join("\n");

const CONTENT_RULES_RU_MARKET = [
  "Адаптируй сайт под рынок России: локальные формулировки, понятный практичный тон, без западного маркетингового пафоса.",
  "Явно используй город в формулировках: например «в {city}», «по городу {city}», «работаем по {city}».",
  "Добавляй типичные для РФ конверсионные блоки/формулировки: «Работаем ежедневно», «Гарантия», «Оставьте заявку», «Перезвоним за 5 минут».",
  "Контакты: телефон в формате РФ (+7 ...), акцент на звонок и заявку.",
  "CTA по умолчанию для РФ: «Записаться», «Оставить заявку», «Позвонить».",
  "Копирайт должен быть прямым и понятным: конкретная польза, сроки, условия, без абстрактного промо-языка."
].join("\n");

const PROMPT_PACKS: Record<WebsitePromptPackVersion, WebsitePromptPack> = {
  A: {
    version: "A",
    label: "Editorial Premium",
    systemGeneration: `${SYSTEM_WEBSITE_GENERATOR_CORE}\nPack style: editorial premium with bold contrast and strong composition.`,
    systemBrief: SYSTEM_BRIEF_EXTRACTION_CORE,
    systemPolish: `${SYSTEM_POLISH_CORE}\nPack style: editorial premium.`,
    designConstraints: `${DESIGN_CONSTRAINTS_BASE}\n${DESIGN_CONSTRAINTS_PACK_A}`,
    antiGenericRules: ANTI_GENERIC_RULES_BASE,
    contentRules: `${CONTENT_RULES_BASE}\n${CONTENT_RULES_RU_MARKET}`
  },
  B: {
    version: "B",
    label: "Clean Luxury",
    systemGeneration: `${SYSTEM_WEBSITE_GENERATOR_CORE}\nPack style: clean-luxury with disciplined composition and modern commercial feel.`,
    systemBrief: SYSTEM_BRIEF_EXTRACTION_CORE,
    systemPolish: `${SYSTEM_POLISH_CORE}\nPack style: clean-luxury.`,
    designConstraints: `${DESIGN_CONSTRAINTS_BASE}\n${DESIGN_CONSTRAINTS_PACK_B}`,
    antiGenericRules: ANTI_GENERIC_RULES_BASE,
    contentRules: `${CONTENT_RULES_BASE}\n${CONTENT_RULES_RU_MARKET}`
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
    "Извлеки структурированный brief для генерации сильного коммерческого landing page.",
    "Верни только JSON, без пояснений и markdown.",
    "Если данных не хватает — дострой логично из контекста, избегай null без причины.",
    "Ориентируйся на коммерческую задачу: конверсия, доверие, запись/заявка, локальная релевантность, сильный hero+CTA.",
    "Рынок РФ: формулировки прямые и практичные, добавить локальные ожидания (гарантия, быстрый обратный звонок, ежедневный режим).",
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
    "Обязательные блоки: hero, сильный CTA, релевантные бизнес-секции, trust signals, social proof/reviews, contact block.",
    "Избегай примитивного вида: скучных баннеров, пустых белых карточек, учебного макета, слабой типографики.",
    "Явно используй многошаговую конверсионную структуру: hero -> value -> social proof -> action.",
    "РФ-локализация: город в ключевых формулировках, телефон в формате +7, CTA типа «Записаться / Оставить заявку / Позвонить».",
    "Для локального бизнеса добавляй блоки «Работаем ежедневно», «Гарантия», «Перезвоним за 5 минут».",
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
    SYSTEM_REPAIR_CORE,
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
    SYSTEM_POLISH_CORE,
    "Улучши React+Tailwind landing page до уровня современного коммерческого сайта.",
    "Сделай дизайн дороже и выразительнее, усили hero, визуальную иерархию и CTA.",
    "Сохрани тему бизнеса и адаптивность.",
    "Ограничение: один файл App.jsx, без внешних библиотек.",
    "При полировке не ломай контентную логику и секции, а усиливай композицию, типографику и конверсию.",
    "Сохрани и усили РФ-локализацию: прямой коммерческий тон, город в тексте, телефон +7, понятные CTA и доверительные блоки.",
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

export const WEBSITE_PROMPT_TEMPLATES = {
  system: {
    generatorCore: SYSTEM_WEBSITE_GENERATOR_CORE,
    briefCore: SYSTEM_BRIEF_EXTRACTION_CORE,
    repairCore: SYSTEM_REPAIR_CORE,
    polishCore: SYSTEM_POLISH_CORE
  },
  briefExtractionPrompt,
  codeGenerationPromptWithOptions,
  fixCodePrompt,
  improveCodePrompt
};
