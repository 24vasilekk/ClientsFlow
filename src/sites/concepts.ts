import { SiteConcept } from "./types";

type ConceptInput = {
  businessName: string;
  city: string;
  niche: string;
  goal: string;
  tone: string;
  offer: string;
  siteLikeReference?: string;
  hasLogo: boolean;
  photosCount: number;
  references: Array<{ url: string; likesStyle: boolean; likesStructure: boolean; likesOffer: boolean }>;
  contentBrief?: string;
};

function clean(v: string, fallback: string): string {
  const t = (v || "").trim();
  return t || fallback;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededPick<T>(seed: number, list: T[]): T {
  return list[seed % list.length];
}

function seededRange(seed: number, min: number, max: number): number {
  const span = max - min + 1;
  return min + (seed % span);
}

function normalizeReferences(
  references: Array<{ url: string; likesStyle: boolean; likesStructure: boolean; likesOffer: boolean }>
): Array<{ url: string; likesStyle: boolean; likesStructure: boolean; likesOffer: boolean }> {
  return references.filter((item) => item.url.trim().length > 0).slice(0, 5);
}

function buildServices(seed: number, offer: string, niche: string): SiteConcept["services"] {
  const serviceDurations = ["30–45 мин", "45–60 мин", "60–90 мин", "до 120 мин"];
  const baseTitles = [offer, "Первичная консультация", "Расширенный пакет", "Поддержка и сопровождение"];
  return baseTitles.slice(0, 3).map((title, idx) => {
    const localSeed = seed + idx * 37;
    const basePrice = seededRange(localSeed, 2500, 11000);
    return {
      id: `srv-${idx + 1}`,
      title,
      price: `от ${basePrice.toLocaleString("ru-RU")} ₽`,
      description: `${clean(niche, "Сервис")} с фокусом на результат, понятные этапы и контроль качества. ${seededPick(localSeed, serviceDurations)}.`
    };
  });
}

function buildTestimonials(seed: number, businessName: string): SiteConcept["testimonials"] {
  const roles = ["Собственник", "Операционный менеджер", "Маркетолог", "Руководитель направления"];
  const texts = [
    `После запуска ${businessName} стало проще доводить заявки до записи без потери темпа.`,
    "Появился понятный маршрут клиента и стало меньше однотипных вопросов в ручном режиме.",
    "Структура сайта дала больше целевых обращений и лучшее качество первичных диалогов.",
    "Команда тратит меньше времени на рутину, а конверсия в следующую стадию выросла."
  ];
  return [0, 1, 2].map((idx) => {
    const localSeed = seed + idx * 53;
    return {
      id: `t-${idx + 1}`,
      author: seededPick(localSeed, ["Анна К.", "Игорь М.", "Мария С.", "Олег П."]),
      role: seededPick(localSeed + 5, roles),
      text: seededPick(localSeed + 11, texts)
    };
  });
}

function buildFaq(seed: number, offer: string): SiteConcept["faq"] {
  const bank = [
    { q: "Как быстро вы отвечаете на заявку?", a: "Первичный ответ обычно уходит в течение 1–2 минут в рабочем режиме." },
    { q: "Можно ли записаться сразу с сайта?", a: "Да, после короткого уточнения задача переводится в запись или консультацию." },
    { q: "Как формируется стоимость?", a: "Цена зависит от объема запроса. Базовый диапазон прозрачно указан в карточках услуг." },
    { q: "Что если запрос нестандартный?", a: "Сценарий переводит диалог на менеджера с уже собранным контекстом." },
    { q: "Подойдет ли решение для моего бизнеса?", a: `Да, структура адаптируется под ваш оффер: ${offer.toLowerCase()}.` }
  ];
  return [0, 1, 2].map((idx) => ({ id: `f-${idx + 1}`, ...bank[(seed + idx) % bank.length] }));
}

function buildContacts(seed: number, city: string): SiteConcept["contacts"] {
  const phoneTail = seededRange(seed, 10, 99);
  return {
    phone: `+7 (495) 123-4${phoneTail}`,
    email: `hello${phoneTail}@cflow.site`,
    address: `${clean(city, "Ваш город")}, центральный район`,
    messengerLabel: seededPick(seed + 7, ["Написать в Telegram", "Связаться в WhatsApp", "Оставить сообщение"]) 
  };
}

function buildFooter(seed: number, businessName: string): SiteConcept["footer"] {
  const linksSet = ["О компании", "Услуги", "Отзывы", "FAQ", "Контакты", "Политика"];
  return {
    links: [0, 1, 2, 3].map((idx) => linksSet[(seed + idx) % linksSet.length]),
    legal: `© ${new Date().getFullYear()} ${businessName}. Все права защищены.`
  };
}

export function generateConcepts(input: ConceptInput): SiteConcept[] {
  const businessName = clean(input.businessName, "Ваш бизнес");
  const city = clean(input.city, "вашем городе");
  const niche = clean(input.niche, "сервисный бизнес");
  const goal = clean(input.goal, "рост заявок");
  const offer = clean(input.offer, "ключевая услуга");
  const tone = clean(input.tone, "спокойно и профессионально");
  const siteLike = clean(input.siteLikeReference || "", "современный premium SaaS-стиль");
  const refs = normalizeReferences(input.references);

  const basis = JSON.stringify({
    businessName,
    city,
    niche,
    goal,
    tone,
    offer,
    siteLike,
    hasLogo: input.hasLogo,
    photosCount: input.photosCount,
    references: refs,
    contentBrief: input.contentBrief || ""
  });
  const seed = hashString(basis);

  const styleVotes = refs.reduce(
    (acc, item) => {
      if (item.likesStyle) acc.style += 1;
      if (item.likesStructure) acc.structure += 1;
      if (item.likesOffer) acc.offer += 1;
      return acc;
    },
    { style: 0, structure: 0, offer: 0 }
  );

  const contactBlock = buildContacts(seed, city);
  const footerBlock = buildFooter(seed, businessName);

  const baseSubtitle = `${businessName} в ${city}. Ниша: ${niche}. Цель: ${goal}.`;
  const visualHint = `Ориентир: ${siteLike}. Референсы: ${refs.length}. Фото: ${input.photosCount}/10. Логотип: ${input.hasLogo ? "да" : "нет"}.`;

  return [
    {
      id: "premium",
      variant: "premium",
      name: "Premium",
      description: "Премиальная подача с акцентом на бренд и доверие.",
      strengths: ["Высокий визуальный класс", "Много воздуха", "Фокус на ценности"],
      palette: { accent: "#0f172a", base: "#f8fafc", hero: "#e6f4ff" },
      hero: {
        title: `${businessName} — ${offer} с premium-подачей`,
        subtitle: `${baseSubtitle} Тон: ${tone}. ${visualHint}`,
        primaryCta: "Записаться",
        secondaryCta: "Смотреть услуги",
        stats: [
          { label: "Обработано заявок", value: `${seededRange(seed, 320, 980)}+` },
          { label: "Средний рейтинг", value: `${seededRange(seed + 3, 47, 50) / 10}/5` },
          { label: "Первый ответ", value: "< 2 мин" }
        ]
      },
      services: buildServices(seed + 13, offer, niche),
      testimonials: buildTestimonials(seed + 23, businessName),
      faq: buildFaq(seed + 31, offer),
      contacts: contactBlock,
      footer: footerBlock,
      cabinet: {
        title: "Личный кабинет клиента",
        text: "Статус заявки, история обращений и быстрый вход через Telegram.",
        cta: "Войти через Telegram"
      }
    },
    {
      id: "conversion",
      variant: "conversion",
      name: "Conversion",
      description: "Плотная конверсионная структура с жестким фокусом на заявку.",
      strengths: ["Сильный оффер", "Короткий путь до лида", "Повторяющийся CTA"],
      palette: { accent: "#0b3b66", base: "#f8fbff", hero: "#dbeafe" },
      hero: {
        title: `${businessName}: сайт под ${goal.toLowerCase()}`,
        subtitle: `${baseSubtitle} Приоритет оффера в референсах: ${styleVotes.offer}/${refs.length || 1}.`,
        primaryCta: "Оставить заявку",
        secondaryCta: "Получить расчет",
        stats: [
          { label: "Конверсия в заявку", value: `+${seededRange(seed + 41, 18, 37)}%` },
          { label: "До ответа", value: `${seededRange(seed + 43, 1, 3)} мин` },
          { label: "Записей в месяц", value: `${seededRange(seed + 47, 80, 240)}` }
        ]
      },
      services: buildServices(seed + 53, offer, niche),
      testimonials: buildTestimonials(seed + 59, businessName),
      faq: buildFaq(seed + 61, offer),
      contacts: contactBlock,
      footer: footerBlock,
      cabinet: {
        title: "Кабинет и статусы",
        text: "Клиент видит этап, подтверждение записи и следующий шаг без лишних вопросов.",
        cta: "Перейти в кабинет"
      }
    },
    {
      id: "trust",
      variant: "trust",
      name: "Trust",
      description: "Экспертная версия для ниш, где важны спокойствие и доказательства.",
      strengths: ["Аргументы доверия", "Ровный тон", "Прозрачная коммуникация"],
      palette: { accent: "#14532d", base: "#f8faf8", hero: "#dcfce7" },
      hero: {
        title: `${businessName} — экспертный подход к ${offer.toLowerCase()}`,
        subtitle: `${baseSubtitle} В референсах акцент на структуре: ${styleVotes.structure}/${refs.length || 1}.`,
        primaryCta: "Получить консультацию",
        secondaryCta: "Посмотреть кейсы",
        stats: [
          { label: "Доверие клиентов", value: `${seededRange(seed + 71, 46, 50) / 10}/5` },
          { label: "Повторные обращения", value: `${seededRange(seed + 73, 42, 71)}%` },
          { label: "SLA ответа", value: "до 120 сек" }
        ]
      },
      services: buildServices(seed + 79, offer, niche),
      testimonials: buildTestimonials(seed + 83, businessName),
      faq: buildFaq(seed + 89, offer),
      contacts: contactBlock,
      footer: footerBlock,
      cabinet: {
        title: "Персональный кабинет",
        text: "Безопасный вход и прозрачная коммуникация после первого обращения.",
        cta: "Открыть кабинет"
      }
    },
    {
      id: "minimal",
      variant: "minimal",
      name: "Minimal",
      description: "Лаконичный вариант без лишних визуальных элементов.",
      strengths: ["Минимализм", "Высокая читаемость", "Четкий CTA"],
      palette: { accent: "#111827", base: "#f9fafb", hero: "#eef2ff" },
      hero: {
        title: `${businessName}. ${offer}. Без лишнего.`,
        subtitle: `${baseSubtitle} Акцент на style в референсах: ${styleVotes.style}/${refs.length || 1}.`,
        primaryCta: "Оставить контакт",
        secondaryCta: "Услуги и цены",
        stats: [
          { label: "Путь до заявки", value: "1–2 шага" },
          { label: "Блоков на экране", value: `${seededRange(seed + 101, 4, 7)}` },
          { label: "Фото в контуре", value: `${input.photosCount}` }
        ]
      },
      services: buildServices(seed + 103, offer, niche),
      testimonials: buildTestimonials(seed + 107, businessName),
      faq: buildFaq(seed + 109, offer),
      contacts: contactBlock,
      footer: footerBlock,
      cabinet: {
        title: "Кабинет без перегруза",
        text: "Только ключевые действия и статусы, чтобы клиент не терялся.",
        cta: "Войти в кабинет"
      }
    }
  ];
}
