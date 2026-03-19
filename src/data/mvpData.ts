import type { Conversation, Lead, Plan, Recommendation, SiteTemplate } from "../types";

export const plans: Plan[] = [
  {
    id: "trial",
    name: "Trial",
    monthlyPriceRub: 0,
    description: "Бесплатный тест с лимитами, чтобы увидеть ценность ClientsFlow.",
    cta: "Начать Trial",
    features: [
      "До 50 диалогов в месяц",
      "Базовые автоответы",
      "Один канал",
      "Базовая аналитика"
    ],
    limits: { conversationsPerMonth: 50, channels: 1 },
    gates: {
      basicInbox: true,
      leadQualification: true,
      recoveryFlows: false,
      aiRecommendations: false,
      advancedAnalytics: false,
      sitesBuilder: false
    }
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPriceRub: 3000,
    description: "Для небольших команд, которым нужен быстрый ответ и квалификация лидов.",
    cta: "Выбрать Starter",
    features: [
      "До 500 диалогов",
      "2 канала",
      "Квалификация лидов",
      "Дашборд воронки"
    ],
    limits: { conversationsPerMonth: 500, channels: 2 },
    gates: {
      basicInbox: true,
      leadQualification: true,
      recoveryFlows: false,
      aiRecommendations: false,
      advancedAnalytics: false,
      sitesBuilder: false
    }
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPriceRub: 6500,
    description: "Оптимален для растущего бизнеса: аналитика, возврат лидов, AI-подсказки.",
    cta: "Выбрать Growth",
    highlighted: true,
    features: [
      "До 2000 диалогов",
      "4 канала",
      "Сценарии возврата лидов",
      "AI-рекомендации"
    ],
    limits: { conversationsPerMonth: 2000, channels: 4 },
    gates: {
      basicInbox: true,
      leadQualification: true,
      recoveryFlows: true,
      aiRecommendations: true,
      advancedAnalytics: true,
      sitesBuilder: true
    }
  },
  {
    id: "scale",
    name: "Scale",
    monthlyPriceRub: 10000,
    description: "Максимум контроля для высокой нагрузки и операционных команд.",
    cta: "Выбрать Scale",
    features: [
      "Безлимит диалогов",
      "Все каналы",
      "Расширенная аналитика",
      "Приоритетные AI-инсайты"
    ],
    limits: { conversationsPerMonth: 999999, channels: 10 },
    gates: {
      basicInbox: true,
      leadQualification: true,
      recoveryFlows: true,
      aiRecommendations: true,
      advancedAnalytics: true,
      sitesBuilder: true
    }
  }
];

export const leads: Lead[] = [
  {
    id: "L-401",
    name: "Анна М.",
    source: "Instagram",
    service: "Окрашивание",
    status: "Квалифицирован",
    potentialRevenueRub: 7500,
    responseTimeSec: 14
  },
  {
    id: "L-402",
    name: "Игорь П.",
    source: "WhatsApp",
    service: "Стрижка + борода",
    status: "Ожидает запись",
    potentialRevenueRub: 2200,
    responseTimeSec: 9
  },
  {
    id: "L-403",
    name: "Екатерина Р.",
    source: "Сайт",
    service: "Первичный прием",
    status: "Новый лид",
    potentialRevenueRub: 4500,
    responseTimeSec: 6
  },
  {
    id: "L-404",
    name: "Мария К.",
    source: "Telegram",
    service: "Консультация",
    status: "Потерян",
    potentialRevenueRub: 5000,
    responseTimeSec: 460
  },
  {
    id: "L-405",
    name: "Денис О.",
    source: "Instagram",
    service: "Курс процедур",
    status: "Продажа",
    potentialRevenueRub: 16000,
    responseTimeSec: 22
  }
];

export const conversations: Conversation[] = [
  {
    id: "C-110",
    client: "Алина",
    channel: "WhatsApp",
    summary: "Спрашивает ближайшее окно на завтра и стоимость услуги.",
    sentiment: "Горячий",
    unread: 2,
    updatedAt: "2 мин назад"
  },
  {
    id: "C-111",
    client: "Максим",
    channel: "Instagram",
    summary: "Сравнивает пакет услуг, запрашивает детали по длительности.",
    sentiment: "Теплый",
    unread: 0,
    updatedAt: "12 мин назад"
  },
  {
    id: "C-112",
    client: "Оксана",
    channel: "Сайт",
    summary: "Оставила заявку, но не завершила запись. Запущен сценарий возврата.",
    sentiment: "Риск ухода",
    unread: 1,
    updatedAt: "35 мин назад"
  }
];

export const recommendations: Recommendation[] = [
  {
    id: "R-1",
    title: "Сократите время первого ответа в Instagram",
    impact: "+12-18% к конверсии в запись",
    action: "Добавить автосценарий с вопросом о желаемой дате и услуге в первые 10 секунд."
  },
  {
    id: "R-2",
    title: "Усильте сценарий возврата потерянных лидов",
    impact: "До 96 000 RUB/мес дополнительно",
    action: "Запустить цепочку из 2 follow-up сообщений через 2ч и 24ч с ограниченным предложением."
  },
  {
    id: "R-3",
    title: "Оптимизируйте квалификацию для дорогих услуг",
    impact: "Меньше пустых слотов в расписании",
    action: "Добавить фильтр бюджета и срочности перед предложением времени записи."
  }
];

export const sitesTemplates: SiteTemplate[] = [
  { id: "S1", name: "Clean Studio", niche: "Салоны красоты", preview: "Светлый премиальный лендинг с акцентом на услуги" },
  { id: "S2", name: "Sharp Barber", niche: "Барбершопы", preview: "Контрастная подача и блоки быстрого бронирования" },
  { id: "S3", name: "Clinic Trust", niche: "Клиники", preview: "Строгая структура, доверие, кейсы и этапы приема" },
  { id: "S4", name: "Expert Pro", niche: "Консультанты", preview: "Личный бренд, оффер, запись на консультацию" }
];

export const analyticsSeries = {
  weeklyLeads: [22, 30, 27, 34, 41, 38, 49],
  conversionRate: [24, 26, 25, 29, 31, 33, 36],
  responseTimeSec: [74, 58, 44, 29, 22, 19, 16],
  days: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
};
