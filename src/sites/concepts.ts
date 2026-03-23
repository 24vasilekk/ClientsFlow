import { SiteConcept } from "./types";

type ConceptInput = {
  businessName: string;
  city: string;
  niche: string;
  goal: string;
  tone: string;
  offer: string;
};

function clean(v: string, fallback: string): string {
  const t = (v || "").trim();
  return t || fallback;
}

export function generateConcepts(input: ConceptInput): SiteConcept[] {
  const businessName = clean(input.businessName, "Ваш бизнес");
  const city = clean(input.city, "вашем городе");
  const niche = clean(input.niche, "сервисный бизнес");
  const goal = clean(input.goal, "рост заявок");
  const offer = clean(input.offer, "ключевая услуга");
  const tone = clean(input.tone, "спокойно и профессионально");

  const sharedServices = [
    { id: "srv-1", title: offer, price: "от 3 500 ₽", description: "Фокус на ключевой результат и предсказуемый сервис." },
    { id: "srv-2", title: "Первичная консультация", price: "от 1 500 ₽", description: "Уточняем задачу и подбираем оптимальный сценарий." },
    { id: "srv-3", title: "Расширенный пакет", price: "от 7 000 ₽", description: "Для клиентов, которым важны глубина и сопровождение." }
  ];

  const sharedTestimonials = [
    { id: "t-1", author: "Анна К.", role: "Собственник", text: "Сайт сразу начал приводить более целевые заявки." },
    { id: "t-2", author: "Игорь М.", role: "Управляющий", text: "Понятный маршрут клиента до записи и меньше пустых диалогов." },
    { id: "t-3", author: "Мария С.", role: "Маркетинг", text: "Стало проще тестировать офферы и отслеживать конверсию." }
  ];

  const sharedFaq = [
    { id: "f-1", q: "Как быстро вы отвечаете?", a: "В рабочее время ответ обычно приходит в течение 2 минут." },
    { id: "f-2", q: "Можно ли записаться сразу?", a: "Да, после уточнения запроса предлагаем доступные окна записи." },
    { id: "f-3", q: "Как узнать стоимость?", a: "Показываем прозрачный диапазон цены и что влияет на итог." }
  ];

  return [
    {
      id: "premium",
      variant: "premium",
      name: "Premium Signature",
      description: "Более дорогая подача: чистый ритм, высокая читаемость, акцент на доверие.",
      strengths: ["Премиальный тон", "Аккуратная композиция", "Сильная подача оффера"],
      palette: { accent: "#0f172a", base: "#f8fafc", hero: "#e6f4ff" },
      hero: {
        title: `${businessName} — ${offer} в стиле premium`,
        subtitle: `${businessName} в ${city}. Подача: ${tone}. Цель: ${goal}.`,
        primaryCta: "Записаться",
        secondaryCta: "Смотреть услуги",
        stats: [
          { label: "Клиентов в месяц", value: "500+" },
          { label: "Средний рейтинг", value: "4.9/5" },
          { label: "Первый ответ", value: "< 2 мин" }
        ]
      },
      services: sharedServices,
      testimonials: sharedTestimonials,
      faq: sharedFaq,
      cabinet: {
        title: "Личный кабинет клиента",
        text: "Статус заявки, история обращений и быстрый вход через Telegram.",
        cta: "Войти через Telegram"
      }
    },
    {
      id: "conversion",
      variant: "conversion",
      name: "Conversion Engine",
      description: "Конверсионная подача: плотный оффер, CTA в ключевых точках, быстрый путь к заявке.",
      strengths: ["Оффер и CTA", "Быстрый сценарий", "Прозрачная структура"],
      palette: { accent: "#0b3b66", base: "#f8fbff", hero: "#dbeafe" },
      hero: {
        title: `${businessName}: сайт под ${goal.toLowerCase()}`,
        subtitle: `Для ниши «${niche}» с понятным сценарием: запрос -> уточнение -> запись.`,
        primaryCta: "Оставить заявку",
        secondaryCta: "Получить расчет",
        stats: [
          { label: "Конверсия в заявку", value: "+28%" },
          { label: "Время до ответа", value: "до 2 мин" },
          { label: "Повторные обращения", value: "+17%" }
        ]
      },
      services: sharedServices,
      testimonials: sharedTestimonials,
      faq: sharedFaq,
      cabinet: {
        title: "Кабинет и статусы",
        text: "Клиент видит этап, подтверждение записи и следующий шаг без лишних вопросов.",
        cta: "Перейти в кабинет"
      }
    },
    {
      id: "trust",
      variant: "trust",
      name: "Trust Expert",
      description: "Экспертная доверительная версия для услуг, где важно снизить тревожность клиента.",
      strengths: ["Тон доверия", "Факты и доказательства", "Спокойный визуальный стиль"],
      palette: { accent: "#14532d", base: "#f8faf8", hero: "#dcfce7" },
      hero: {
        title: `${businessName} — профессиональный подход к ${offer.toLowerCase()}`,
        subtitle: `Клиент сразу понимает уровень сервиса, этапы и условия до обращения.`,
        primaryCta: "Получить консультацию",
        secondaryCta: "Посмотреть кейсы",
        stats: [
          { label: "Доверие клиентов", value: "4.9/5" },
          { label: "Повторные визиты", value: "63%" },
          { label: "Срок ответа", value: "< 2 мин" }
        ]
      },
      services: sharedServices,
      testimonials: sharedTestimonials,
      faq: sharedFaq,
      cabinet: {
        title: "Персональный кабинет",
        text: "Безопасный вход и прозрачная коммуникация после первого обращения.",
        cta: "Открыть кабинет"
      }
    },
    {
      id: "minimal",
      variant: "minimal",
      name: "Minimal Focus",
      description: "Минималистичный вариант без визуального шума: только важные блоки для решения.",
      strengths: ["Лаконичность", "Четкая структура", "Фокус на действии"],
      palette: { accent: "#111827", base: "#f9fafb", hero: "#eef2ff" },
      hero: {
        title: `${businessName}. ${offer}. Без лишнего.`,
        subtitle: `Одна цель — ${goal.toLowerCase()}. Короткий путь клиента до целевого действия.`,
        primaryCta: "Оставить контакт",
        secondaryCta: "Услуги и цены",
        stats: [
          { label: "Скорость загрузки", value: "быстро" },
          { label: "Путь до заявки", value: "1-2 шага" },
          { label: "Понятность оффера", value: "высокая" }
        ]
      },
      services: sharedServices,
      testimonials: sharedTestimonials,
      faq: sharedFaq,
      cabinet: {
        title: "Кабинет без перегруза",
        text: "Только ключевые действия и статусы, чтобы клиент не терялся.",
        cta: "Войти в кабинет"
      }
    }
  ];
}
