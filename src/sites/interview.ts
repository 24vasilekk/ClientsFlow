export type InterviewQuestion = {
  id: string;
  label: string;
  placeholder: string;
  helper?: string;
  required?: boolean;
};

const baseQuestions: InterviewQuestion[] = [
  {
    id: "business_name",
    label: "Как называется ваш бизнес?",
    placeholder: "Например: Studio Nova",
    helper: "Название будет использоваться в хедере и оффере.",
    required: true
  },
  {
    id: "niche",
    label: "В какой нише вы работаете?",
    placeholder: "Например: салон красоты / клиника / автосервис",
    helper: "От ниши зависят вопросы и структура сайта.",
    required: true
  },
  {
    id: "city",
    label: "В каком городе или районе вы работаете?",
    placeholder: "Например: Москва, Хамовники",
    required: true
  },
  {
    id: "main_offer",
    label: "Какая услуга или направление для вас приоритетно?",
    placeholder: "Например: окрашивание и уход премиум-класса",
    required: true
  },
  {
    id: "target_audience",
    label: "Кто ваш основной клиент?",
    placeholder: "Опишите целевую аудиторию в 1-2 предложениях",
    required: true
  },
  {
    id: "goal",
    label: "Какая главная цель сайта?",
    placeholder: "Например: больше записей на первичную услугу",
    required: true
  },
  {
    id: "site_like_reference",
    label: "На что должен быть похож ваш сайт?",
    placeholder: "Опишите стиль, структуру или примеры, которые вам близки",
    helper: "Свободный текст: это влияет на визуальную подачу и ритм секций.",
    required: true
  },
  {
    id: "tone",
    label: "Какой тон коммуникации нужен?",
    placeholder: "Например: спокойный, премиальный, профессиональный",
    required: true
  },
  {
    id: "price_range",
    label: "Какой диапазон цен или средний чек?",
    placeholder: "Например: от 3 500 до 7 000 ₽"
  },
  {
    id: "key_advantages",
    label: "Почему клиент выбирает вас?",
    placeholder: "3-5 сильных отличий",
    required: true
  },
  {
    id: "cta_preference",
    label: "Какое целевое действие в приоритете?",
    placeholder: "Записаться / оставить заявку / позвонить",
    required: true
  },
  {
    id: "brand_keywords",
    label: "Какие 3-6 ассоциаций должен вызывать бренд?",
    placeholder: "Например: надежность, аккуратность, скорость, комфорт",
    required: true
  },
  {
    id: "content_depth",
    label: "Сколько деталей вы хотите на сайте?",
    placeholder: "Минималистично / сбалансированно / подробно",
    required: true
  }
];

const nicheBank: Array<{ keywords: string[]; questions: InterviewQuestion[] }> = [
  {
    keywords: ["салон", "барбер", "beauty", "ногт", "бьюти"],
    questions: [
      { id: "beauty_services_focus", label: "Какие процедуры нужно показать в первом экране?", placeholder: "Топ 3 услуги" },
      { id: "beauty_master_trust", label: "Что важно подчеркнуть про мастеров и качество?", placeholder: "Сертификаты, опыт, материалы" },
      { id: "beauty_booking_rules", label: "Есть ли правила записи/переноса?", placeholder: "Например, предоплата, окно отмены" },
      { id: "beauty_before_after", label: "Нужен ли акцент на фото работ (до/после)?", placeholder: "Да/Нет + комментарий" },
      { id: "beauty_atmosphere", label: "Какую атмосферу нужно передать визуально?", placeholder: "Уют, премиум, fashion, clean beauty" },
      { id: "beauty_offer_pack", label: "Какие пакеты услуг продвигать в первую очередь?", placeholder: "Например: окрашивание + уход + укладка" }
    ]
  },
  {
    keywords: ["клиник", "мед", "стомат", "dental"],
    questions: [
      { id: "medical_license", label: "Какие лицензии/документы нужно показать?", placeholder: "Перечислите важные доверительные элементы" },
      { id: "medical_doctors", label: "Как представить врачей или специалистов?", placeholder: "Опыт, специализация, стаж" },
      { id: "medical_safety", label: "Что важно сказать про безопасность и стандарты?", placeholder: "Стерильность, протоколы" },
      { id: "medical_primary_cta", label: "Что первично: консультация или запись к специалисту?", placeholder: "Укажите желаемый маршрут клиента" },
      { id: "medical_cases", label: "Нужен ли блок кейсов и клинических результатов?", placeholder: "Да/Нет + какие форматы" },
      { id: "medical_insurance", label: "Есть ли работа со страховками/программами?", placeholder: "Опишите, если нужно показывать на сайте" }
    ]
  },
  {
    keywords: ["авто", "ремонт", "сервис", "cleaning"],
    questions: [
      { id: "service_speed", label: "Какие сроки/скорость важно показать?", placeholder: "Например: диагностика за 30 минут" },
      { id: "service_geography", label: "Какая зона обслуживания?", placeholder: "Районы/города, выезд или только точка" },
      { id: "service_guarantee", label: "Есть ли гарантия на работы?", placeholder: "Опишите формат гарантии" },
      { id: "service_request_flow", label: "Что клиент должен отправить в заявке?", placeholder: "Фото, марка, тип проблемы и т.д." },
      { id: "service_emergency", label: "Нужен ли сценарий срочных обращений?", placeholder: "Как обрабатывать срочные заявки" },
      { id: "service_pricing", label: "Показывать фикс-прайс или расчет после диагностики?", placeholder: "Опишите вашу логику" }
    ]
  }
];

const genericExtra: InterviewQuestion[] = [
  { id: "social_proof", label: "Какие цифры доверия можно показать?", placeholder: "Клиенты, рейтинг, годы работы" },
  { id: "faq_top", label: "Какие 3 частых вопроса задают перед обращением?", placeholder: "Список через запятую" },
  { id: "contact_channels", label: "Какие каналы связи должны быть на виду?", placeholder: "Telegram, WhatsApp, Instagram, телефон" },
  { id: "forbidden_words", label: "Есть ли слова/формулировки, которых нужно избегать?", placeholder: "Например: дешево, мгновенно и т.д." },
  { id: "proof_assets", label: "Какие доверительные элементы обязательно показать?", placeholder: "Отзывы, кейсы, сертификаты, партнеры" },
  { id: "lead_filter", label: "Какие лиды для вас приоритетны?", placeholder: "Опишите целевой запрос/чек/тип клиента" }
];

export function buildInterviewQuestions(niche: string): InterviewQuestion[] {
  const normalized = niche.toLowerCase();
  const matched = nicheBank.find((bucket) => bucket.keywords.some((keyword) => normalized.includes(keyword)));
  const dynamic = matched ? matched.questions : genericExtra;
  return [...baseQuestions, ...dynamic];
}

export function buildStructuredBrief(input: {
  niche: string;
  answers: Record<string, string>;
  referencesCount: number;
  logoLoaded: boolean;
  photosCount: number;
}): {
  businessBrief: string;
  offerBrief: string;
  styleBrief: string;
  contentBrief: string;
  sectionPlan: string;
  visualConstraints: string;
} {
  const { niche, answers, referencesCount, logoLoaded, photosCount } = input;
  const businessName = answers.business_name || "Бизнес клиента";
  const city = answers.city || "локальный рынок";
  const offer = answers.main_offer || "ключевая услуга";
  const audience = answers.target_audience || "основная целевая аудитория";
  const goal = answers.goal || "рост входящих заявок";
  const tone = answers.tone || "премиальный деловой тон";
  const cta = answers.cta_preference || "оставить заявку";
  const trust = answers.social_proof || answers.key_advantages || "экспертность и стабильный сервис";
  const faq = answers.faq_top || "цены, сроки, формат записи";
  const similarity = answers.site_like_reference || "современный premium лендинг с чистой структурой";
  const brandKeywords = answers.brand_keywords || "надежность, качество, скорость";
  const detailMode = answers.content_depth || "сбалансированная подача";
  const forbiddenWords = answers.forbidden_words || "агрессивные и кликбейтные формулировки";
  const channels = answers.contact_channels || "Telegram, WhatsApp, Instagram";

  const businessBrief =
    `${businessName} работает в нише «${niche || "сервисный бизнес"}» в городе ${city}. ` +
    `Приоритетное направление: ${offer}. Целевая аудитория: ${audience}. ` +
    `Ключевая цель сайта: ${goal}. Рекомендованный тон: ${tone}.`;

  const offerBrief =
    `Главный оффер: ${offer}. Основное целевое действие: «${cta}». ` +
    `Сайт должен в первую очередь конвертировать посетителя в лид без лишних шагов. ` +
    `Ключевые маркеры ценности: ${trust}.`;

  const styleBrief =
    `Референсы: ${referencesCount} шт. Логотип: ${logoLoaded ? "загружен" : "не загружен"}, фото: ${photosCount}/10. ` +
    `Ориентир по стилю: ${similarity}. Стилистика — premium SaaS без визуального шума, читаемые блоки и явный CTA. ` +
    `Ассоциации бренда: ${brandKeywords}. Детализация: ${detailMode}.`;

  const contentBrief =
    `Тон: ${tone}. Тексты короткие и предметные, без абстрактных обещаний. ` +
    `Обязательная бизнес-лексика: лиды, запись, скорость ответа, результат. ` +
    `В FAQ раскрыть: ${faq}. На видимые контакты вынести: ${channels}.`;

  const sectionPlan =
    `Hero с оффером и CTA -> Услуги/прайс -> Соцдоказательства -> FAQ -> Контакты и быстрые каналы связи -> Финальный CTA. ` +
    `Если есть фото, добавить отдельную галерею без перегруза.`;

  const visualConstraints =
    `Избегать визуального шума, тяжёлых градиентов и “кричащих” эффектов. ` +
    `Соблюдать высокий контраст читаемости, много воздуха, единые радиусы и мягкие тени. ` +
    `Не использовать формулировки: ${forbiddenWords}.`;

  return { businessBrief, offerBrief, styleBrief, contentBrief, sectionPlan, visualConstraints };
}
