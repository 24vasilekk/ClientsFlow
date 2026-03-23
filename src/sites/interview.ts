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
  }
];

const nicheBank: Array<{ keywords: string[]; questions: InterviewQuestion[] }> = [
  {
    keywords: ["салон", "барбер", "beauty", "ногт", "бьюти"],
    questions: [
      { id: "beauty_services_focus", label: "Какие процедуры нужно показать в первом экране?", placeholder: "Топ 3 услуги" },
      { id: "beauty_master_trust", label: "Что важно подчеркнуть про мастеров и качество?", placeholder: "Сертификаты, опыт, материалы" },
      { id: "beauty_booking_rules", label: "Есть ли правила записи/переноса?", placeholder: "Например, предоплата, окно отмены" },
      { id: "beauty_before_after", label: "Нужен ли акцент на фото работ (до/после)?", placeholder: "Да/Нет + комментарий" }
    ]
  },
  {
    keywords: ["клиник", "мед", "стомат", "dental"],
    questions: [
      { id: "medical_license", label: "Какие лицензии/документы нужно показать?", placeholder: "Перечислите важные доверительные элементы" },
      { id: "medical_doctors", label: "Как представить врачей или специалистов?", placeholder: "Опыт, специализация, стаж" },
      { id: "medical_safety", label: "Что важно сказать про безопасность и стандарты?", placeholder: "Стерильность, протоколы" },
      { id: "medical_primary_cta", label: "Что первично: консультация или запись к специалисту?", placeholder: "Укажите желаемый маршрут клиента" }
    ]
  },
  {
    keywords: ["авто", "ремонт", "сервис", "cleaning"],
    questions: [
      { id: "service_speed", label: "Какие сроки/скорость важно показать?", placeholder: "Например: диагностика за 30 минут" },
      { id: "service_geography", label: "Какая зона обслуживания?", placeholder: "Районы/города, выезд или только точка" },
      { id: "service_guarantee", label: "Есть ли гарантия на работы?", placeholder: "Опишите формат гарантии" },
      { id: "service_request_flow", label: "Что клиент должен отправить в заявке?", placeholder: "Фото, марка, тип проблемы и т.д." }
    ]
  }
];

const genericExtra: InterviewQuestion[] = [
  { id: "social_proof", label: "Какие цифры доверия можно показать?", placeholder: "Клиенты, рейтинг, годы работы" },
  { id: "faq_top", label: "Какие 3 частых вопроса задают перед обращением?", placeholder: "Список через запятую" },
  { id: "contact_channels", label: "Какие каналы связи должны быть на виду?", placeholder: "Telegram, WhatsApp, Instagram, телефон" },
  { id: "forbidden_words", label: "Есть ли слова/формулировки, которых нужно избегать?", placeholder: "Например: дешево, мгновенно и т.д." }
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
}): { businessBrief: string; styleBrief: string; contentBrief: string } {
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

  const businessBrief =
    `${businessName} работает в нише «${niche || "сервисный бизнес"}» в городе ${city}. ` +
    `Приоритетное направление: ${offer}. Целевая аудитория: ${audience}. ` +
    `Ключевая цель сайта: ${goal}. Рекомендованный тон: ${tone}.`;

  const styleBrief =
    `Референсы: ${referencesCount} шт. Логотип: ${logoLoaded ? "загружен" : "не загружен"}, фото: ${photosCount}/5. ` +
    `Стилистика — современный premium B2B без визуального шума, с акцентом на читаемость оффера и CTA. ` +
    `Приоритет CTA: ${cta}. Доверительные сигналы: ${trust}.`;

  const contentBrief =
    `Обязательная структура: Hero (оффер + CTA) -> Услуги/каталог -> FAQ -> Контакты/каналы связи. ` +
    `Упор на конверсию в действие «${cta}». В FAQ раскрыть: ${faq}. ` +
    `Тексты должны быть краткими, понятными, без перегруза терминами и с бизнес-лексикой.`;

  return { businessBrief, styleBrief, contentBrief };
}
