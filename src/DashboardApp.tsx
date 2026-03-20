import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type NavItem =
  | "Обзор"
  | "Диалоги"
  | "Лиды"
  | "Аналитика"
  | "Потерянные"
  | "AI рекомендации"
  | "ClientsFlow Sites"
  | "Настройки";

type SubscriptionState = {
  planId: "trial" | "basic" | "pro" | "business" | null;
  subscriptionStatus: "none" | "trial" | "active";
  trialStartDate: string | null;
  onboardingCompleted?: boolean;
  onboardingData?: {
    businessType: string;
    channels: string[];
    goals: string[];
  };
};

type Channel = "Telegram" | "WhatsApp" | "Instagram" | "Website";
type LeadStatus = "новый" | "квалифицирован" | "ожидает записи" | "записан" | "потерян" | "эскалация";
type LeadStage = "новый" | "квалифицирован" | "ожидает записи" | "записан" | "потерян" | "передан менеджеру";
type BookingState = "не начата" | "в процессе" | "подтверждена" | "отменена";

type TimelineMessage = {
  role: "client" | "ai" | "manager";
  text: string;
  time: string;
};

type InboxConversation = {
  id: string;
  client: string;
  channel: Channel;
  status: LeadStatus;
  summary: string;
  score: number;
  purchaseProbability: number;
  suggestedAction: string;
  lastActivity: string;
  intent: string;
  extractedFields: Array<{ label: string; value: string }>;
  notes: string;
  timeline: TimelineMessage[];
};

type LeadRecord = {
  id: string;
  name: string;
  business: string;
  stage: LeadStage;
  channel: Channel;
  score: number;
  estimatedRevenue: number;
  lastActivityLabel: string;
  lastActivityMinutes: number;
  bookingState: BookingState;
  tags: string[];
  owner: string;
};

type LostRevenueSnapshot = {
  periodLabel: string;
  lostLeads: number;
  estimatedRevenue: number;
  topReason: string;
  reasons: Array<{ reason: string; count: number; revenue: number }>;
  actions: string[];
};

type RecommendationPriority = "Критично" | "Высокий" | "Средний";

type AiRecommendation = {
  id: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  expectedImpact: string;
  actionLabel: string;
  area: string;
};

type SitesTemplate = {
  id: string;
  name: string;
  description: string;
  suitableFor: string[];
  styleLabel: string;
  previewTheme: {
    gradientFrom: string;
    gradientTo: string;
    accent: string;
    surface: string;
  };
  heroPattern: string;
};

type SitesQuestion = {
  id: string;
  label: string;
  placeholder: string;
  hint: string;
};

type GeneratedSiteContent = {
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta: string;
  valueProps: string[];
  services: string[];
  about: string;
  processSteps: string[];
  faq: Array<{ q: string; a: string }>;
  finalCtaTitle: string;
  finalCtaText: string;
};

type PlanFeatureKey = "advancedAnalytics" | "aiRecommendations" | "sitesBuilder" | "lostRecovery";

type PlanDefinition = {
  id: "trial" | "basic" | "pro" | "business";
  title: string;
  priceLabel: string;
  description: string;
  features: string[];
  recommended?: boolean;
  gates: Record<PlanFeatureKey, boolean>;
};

const navItems: NavItem[] = [
  "Обзор",
  "Диалоги",
  "Лиды",
  "Аналитика",
  "Потерянные",
  "AI рекомендации",
  "ClientsFlow Sites",
  "Настройки"
];

const mobilePrimaryNav: NavItem[] = ["Обзор", "Диалоги", "Лиды", "Аналитика", "AI рекомендации"];

const planDefinitions: PlanDefinition[] = [
  {
    id: "trial",
    title: "Free Trial",
    priceLabel: "0 ₽ • 7 дней",
    description: "Базовый доступ для теста потока лидов.",
    features: ["1 канал", "Ограниченные диалоги", "Базовый Inbox"],
    gates: {
      advancedAnalytics: false,
      aiRecommendations: false,
      sitesBuilder: false,
      lostRecovery: false
    }
  },
  {
    id: "basic",
    title: "Basic",
    priceLabel: "3 000 ₽ / мес",
    description: "Для стабильной обработки входящих обращений.",
    features: ["1 канал", "AI-ответы", "Базовая аналитика"],
    gates: {
      advancedAnalytics: false,
      aiRecommendations: false,
      sitesBuilder: false,
      lostRecovery: false
    }
  },
  {
    id: "pro",
    title: "Pro",
    priceLabel: "6 500 ₽ / мес",
    description: "Для роста конверсии и возврата потерянных лидов.",
    recommended: true,
    features: ["Мультиканальность", "AI рекомендации", "Recovery сценарии", "Расширенная аналитика"],
    gates: {
      advancedAnalytics: true,
      aiRecommendations: true,
      sitesBuilder: true,
      lostRecovery: true
    }
  },
  {
    id: "business",
    title: "Business",
    priceLabel: "10 000 ₽ / мес",
    description: "Максимальный контроль и приоритетная поддержка.",
    features: ["Все функции Pro", "Глубокая аналитика", "Приоритетный саппорт"],
    gates: {
      advancedAnalytics: true,
      aiRecommendations: true,
      sitesBuilder: true,
      lostRecovery: true
    }
  }
];

const leadsOverTime = [18, 21, 26, 24, 31, 29, 35, 38, 36, 40, 43, 47];
const leadDays = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

const funnel = [
  { label: "Входящие обращения", value: 482, width: 100, color: "bg-cyan-500" },
  { label: "Квалифицировано", value: 314, width: 65, color: "bg-sky-500" },
  { label: "Дошли до записи", value: 176, width: 36, color: "bg-indigo-500" },
  { label: "Оплаченные услуги", value: 129, width: 27, color: "bg-emerald-500" }
];

const recentConversations = [
  {
    client: "Анна С.",
    channel: "Instagram Direct",
    status: "Ожидает подтверждение",
    summary: "Уточнила стоимость окрашивания, предложен слот на завтра 12:00",
    time: "3 мин назад"
  },
  {
    client: "Дмитрий К.",
    channel: "WhatsApp",
    status: "Квалифицирован",
    summary: "Подтвердил услугу и бюджет, переведен в запись",
    time: "11 мин назад"
  },
  {
    client: "Мария П.",
    channel: "Сайт",
    status: "Нужен follow-up",
    summary: "Оставила форму, не выбрала время. Запущен автоповтор через 2 часа",
    time: "26 мин назад"
  }
];

const aiRecommendations = [
  {
    title: "Сократите потери в вечерние часы",
    impact: "+9-13% к записям",
    description: "Добавьте отдельный сценарий обработки для обращений после 19:00 с быстрым предложением свободных слотов."
  },
  {
    title: "Усильте квалификацию по высокому чеку",
    impact: "Меньше нецелевых диалогов",
    description: "Перед подтверждением записи добавьте уточнение по приоритету услуги и диапазону бюджета."
  },
  {
    title: "Повышайте возврат потерянных лидов",
    impact: "До +74 000 руб./мес",
    description: "Настройте два follow-up касания для лидов без ответа: через 2 часа и через 24 часа."
  }
];

const lostRevenueByPeriod: Record<"7d" | "30d", LostRevenueSnapshot> = {
  "7d": {
    periodLabel: "7 дней",
    lostLeads: 18,
    estimatedRevenue: 54000,
    topReason: "Чаще всего лиды уходят после вопроса о цене.",
    reasons: [
      { reason: "После вопроса о стоимости", count: 8, revenue: 24100 },
      { reason: "Не завершили запись", count: 5, revenue: 15600 },
      { reason: "Нет ответа менеджера > 15 мин", count: 3, revenue: 9200 },
      { reason: "Не отправлен follow-up", count: 2, revenue: 5100 }
    ],
    actions: [
      "Обновить первый ответ на вопрос о стоимости с ценовым диапазоном и ценностью услуги.",
      "Отправить follow-up 12 лидам из группы риска в течение ближайших 2 часов.",
      "Добавить автоматическое напоминание по лидам без ответа через 45 минут."
    ]
  },
  "30d": {
    periodLabel: "30 дней",
    lostLeads: 74,
    estimatedRevenue: 223000,
    topReason: "Ключевая зона потерь: этап после первичного расчета стоимости.",
    reasons: [
      { reason: "После вопроса о стоимости", count: 31, revenue: 92100 },
      { reason: "Не завершили запись", count: 22, revenue: 68200 },
      { reason: "Нет ответа менеджера > 15 мин", count: 13, revenue: 39100 },
      { reason: "Не отправлен follow-up", count: 8, revenue: 23600 }
    ],
    actions: [
      "Скорректировать ценовой сценарий и добавить 2 альтернативы записи в первом ответе.",
      "Запустить recovery-цепочку для лидов, которые замолчали после расчета цены.",
      "Контролировать SLA ответа: не более 60 секунд в пиковые часы."
    ]
  }
};

const inboxConversations: InboxConversation[] = [
  {
    id: "CV-101",
    client: "Анна Л.",
    channel: "Instagram",
    status: "квалифицирован",
    summary: "Интерес к окрашиванию + стрижке, бюджет подтвержден, просит ближайшее окно.",
    score: 82,
    purchaseProbability: 74,
    suggestedAction: "Предложить 2 ближайших слота и закрепить запись.",
    lastActivity: "2 мин назад",
    intent: "Запись на услугу в ближайшие 48 часов",
    extractedFields: [
      { label: "Услуга", value: "Окрашивание + стрижка" },
      { label: "Бюджет", value: "до 8 000 руб." },
      { label: "Предпочтение", value: "После 18:00" }
    ],
    notes: "Высокий приоритет. Клиент сравнивает с 2 конкурентами.",
    timeline: [
      { role: "client", text: "Здравствуйте, сколько стоит окрашивание и есть ли запись на этой неделе?", time: "13:12" },
      { role: "ai", text: "Здравствуйте! Подскажите, пожалуйста, длину волос и желаемую дату, чтобы подобрать точную стоимость и свободные окна.", time: "13:12" },
      { role: "client", text: "Средняя длина, лучше в четверг вечером.", time: "13:14" },
      { role: "ai", text: "Отлично, могу предложить четверг 18:30 или 20:00. Какой вариант удобнее?", time: "13:14" }
    ]
  },
  {
    id: "CV-102",
    client: "Игорь Н.",
    channel: "WhatsApp",
    status: "ожидает записи",
    summary: "Услуга выбрана, клиент запросил детали по длительности процедуры.",
    score: 71,
    purchaseProbability: 61,
    suggestedAction: "Отправить уточнение по длительности и закрепить тайм-слот.",
    lastActivity: "9 мин назад",
    intent: "Согласование записи",
    extractedFields: [
      { label: "Услуга", value: "Стрижка + борода" },
      { label: "Время", value: "Сегодня после 19:00" },
      { label: "Источник", value: "Повторный клиент" }
    ],
    notes: "У клиента было 2 отмены в прошлом месяце.",
    timeline: [
      { role: "client", text: "Привет, сколько по времени займет стрижка с бородой?", time: "12:40" },
      { role: "ai", text: "Обычно 50-60 минут. Могу предложить время сегодня на 19:30.", time: "12:41" },
      { role: "client", text: "Ок, давай подумаю до вечера.", time: "12:44" }
    ]
  },
  {
    id: "CV-103",
    client: "Мария П.",
    channel: "Website",
    status: "новый",
    summary: "Оставила форму на консультацию, не указала удобное время.",
    score: 54,
    purchaseProbability: 42,
    suggestedAction: "Отправить follow-up с выбором времени консультации.",
    lastActivity: "22 мин назад",
    intent: "Первичный интерес",
    extractedFields: [
      { label: "Услуга", value: "Первичная консультация" },
      { label: "Источник", value: "Форма на сайте" },
      { label: "Контакт", value: "Email + Telegram" }
    ],
    notes: "Новый лид, без истории обращений.",
    timeline: [
      { role: "client", text: "Оставила заявку через сайт.", time: "12:16" },
      { role: "ai", text: "Спасибо за обращение! Подскажите, пожалуйста, удобное время для консультации.", time: "12:17" }
    ]
  },
  {
    id: "CV-104",
    client: "Сергей В.",
    channel: "Telegram",
    status: "эскалация",
    summary: "Нестандартный запрос по корпоративному обслуживанию, требуется менеджер.",
    score: 88,
    purchaseProbability: 79,
    suggestedAction: "Передать менеджеру и согласовать персональное предложение.",
    lastActivity: "31 мин назад",
    intent: "Запрос на корпоративный пакет",
    extractedFields: [
      { label: "Тип запроса", value: "B2B / корпоративный" },
      { label: "Объем", value: "10+ сотрудников" },
      { label: "Срок", value: "В течение недели" }
    ],
    notes: "Потенциально высокий чек, приоритетная обработка.",
    timeline: [
      { role: "client", text: "Нужен пакет услуг для команды, есть ли корпоративные условия?", time: "11:45" },
      { role: "ai", text: "Да, можем предложить индивидуальные условия. Уточните, пожалуйста, количество сотрудников и желаемые услуги.", time: "11:45" },
      { role: "client", text: "Около 14 человек, интересует регулярный формат.", time: "11:47" },
      { role: "manager", text: "Принято в работу, менеджер свяжется в течение 20 минут.", time: "11:49" }
    ]
  },
  {
    id: "CV-105",
    client: "Оксана Р.",
    channel: "Instagram",
    status: "потерян",
    summary: "Лид не ответил после предложения слотов, follow-up не сработал.",
    score: 39,
    purchaseProbability: 18,
    suggestedAction: "Перезапустить касание через 24 часа с новым оффером.",
    lastActivity: "1 ч назад",
    intent: "Сравнение условий у конкурентов",
    extractedFields: [
      { label: "Услуга", value: "Комплекс процедур" },
      { label: "Причина потери", value: "Нет ответа после 2 касаний" },
      { label: "Потенциал", value: "6 500 руб." }
    ],
    notes: "Нужен мягкий ретаргет и ограниченное предложение.",
    timeline: [
      { role: "ai", text: "Могу предложить завтра 12:00 или 14:30. Что удобнее?", time: "10:31" },
      { role: "ai", text: "Напомню, слоты актуальны до конца дня. Могу забронировать по вашему подтверждению.", time: "10:59" }
    ]
  },
  {
    id: "CV-106",
    client: "Елена Г.",
    channel: "WhatsApp",
    status: "записан",
    summary: "Запись подтверждена, отправлено автоматическое напоминание.",
    score: 93,
    purchaseProbability: 95,
    suggestedAction: "Сделка закрыта. Отправить post-visit follow-up после визита.",
    lastActivity: "1 ч 22 мин назад",
    intent: "Подтвержденная запись",
    extractedFields: [
      { label: "Дата", value: "Завтра 16:30" },
      { label: "Услуга", value: "Комплексный уход" },
      { label: "Статус", value: "Подтверждено" }
    ],
    notes: "Добавить в сегмент повторных клиентов.",
    timeline: [
      { role: "client", text: "Подтверждаю запись на завтра.", time: "09:48" },
      { role: "ai", text: "Отлично, запись подтверждена на 16:30. За 2 часа отправим напоминание.", time: "09:48" }
    ]
  }
];

const allStatuses: Array<LeadStatus | "все"> = [
  "все",
  "новый",
  "квалифицирован",
  "ожидает записи",
  "записан",
  "потерян",
  "эскалация"
];

const allChannels: Array<Channel | "все"> = ["все", "Telegram", "WhatsApp", "Instagram", "Website"];

const leadStages: Array<LeadStage | "все"> = [
  "все",
  "новый",
  "квалифицирован",
  "ожидает записи",
  "записан",
  "потерян",
  "передан менеджеру"
];

const bookingStates: Array<BookingState | "все"> = ["все", "не начата", "в процессе", "подтверждена", "отменена"];

const leadRecords: LeadRecord[] = [
  {
    id: "LD-2401",
    name: "Анна Лебедева",
    business: "Салон красоты Aura",
    stage: "квалифицирован",
    channel: "Instagram",
    score: 84,
    estimatedRevenue: 8200,
    lastActivityLabel: "3 мин назад",
    lastActivityMinutes: 3,
    bookingState: "в процессе",
    tags: ["Высокий чек", "Окрашивание", "Вечерний слот"],
    owner: "AI + Юлия"
  },
  {
    id: "LD-2402",
    name: "Игорь Смирнов",
    business: "Barber Point",
    stage: "ожидает записи",
    channel: "WhatsApp",
    score: 72,
    estimatedRevenue: 3600,
    lastActivityLabel: "11 мин назад",
    lastActivityMinutes: 11,
    bookingState: "в процессе",
    tags: ["Повторный", "Стрижка+борода"],
    owner: "AI"
  },
  {
    id: "LD-2403",
    name: "Мария Плотникова",
    business: "Clinic Nova",
    stage: "новый",
    channel: "Website",
    score: 57,
    estimatedRevenue: 5400,
    lastActivityLabel: "29 мин назад",
    lastActivityMinutes: 29,
    bookingState: "не начата",
    tags: ["Первичный лид", "Консультация"],
    owner: "AI"
  },
  {
    id: "LD-2404",
    name: "Сергей Власов",
    business: "Local Service Hub",
    stage: "передан менеджеру",
    channel: "Telegram",
    score: 89,
    estimatedRevenue: 12500,
    lastActivityLabel: "37 мин назад",
    lastActivityMinutes: 37,
    bookingState: "в процессе",
    tags: ["Корпоративный", "B2B"],
    owner: "Елена"
  },
  {
    id: "LD-2405",
    name: "Оксана Романова",
    business: "Beauty Studio M",
    stage: "потерян",
    channel: "Instagram",
    score: 41,
    estimatedRevenue: 6500,
    lastActivityLabel: "1 ч назад",
    lastActivityMinutes: 60,
    bookingState: "отменена",
    tags: ["Нужен follow-up", "Сравнивает цены"],
    owner: "AI"
  },
  {
    id: "LD-2406",
    name: "Елена Гурьева",
    business: "Clinic Nova",
    stage: "записан",
    channel: "WhatsApp",
    score: 95,
    estimatedRevenue: 9300,
    lastActivityLabel: "1 ч 15 мин назад",
    lastActivityMinutes: 75,
    bookingState: "подтверждена",
    tags: ["VIP", "Повторный клиент"],
    owner: "AI"
  },
  {
    id: "LD-2407",
    name: "Никита Орлов",
    business: "Barber Point",
    stage: "квалифицирован",
    channel: "Telegram",
    score: 77,
    estimatedRevenue: 4300,
    lastActivityLabel: "1 ч 42 мин назад",
    lastActivityMinutes: 102,
    bookingState: "в процессе",
    tags: ["Upsell", "Комплекс"],
    owner: "AI + Максим"
  },
  {
    id: "LD-2408",
    name: "Дарья Климова",
    business: "Experts Lab",
    stage: "ожидает записи",
    channel: "Website",
    score: 68,
    estimatedRevenue: 7100,
    lastActivityLabel: "2 ч назад",
    lastActivityMinutes: 120,
    bookingState: "в процессе",
    tags: ["Консалтинг", "Zoom"],
    owner: "AI"
  },
  {
    id: "LD-2409",
    name: "Артем Захаров",
    business: "Local Service Hub",
    stage: "новый",
    channel: "Instagram",
    score: 52,
    estimatedRevenue: 2900,
    lastActivityLabel: "2 ч 35 мин назад",
    lastActivityMinutes: 155,
    bookingState: "не начата",
    tags: ["Срочный запрос"],
    owner: "AI"
  },
  {
    id: "LD-2410",
    name: "Виктория Соколова",
    business: "Салон красоты Aura",
    stage: "записан",
    channel: "Telegram",
    score: 91,
    estimatedRevenue: 7800,
    lastActivityLabel: "3 ч назад",
    lastActivityMinutes: 180,
    bookingState: "подтверждена",
    tags: ["Запись на завтра", "Премиум услуга"],
    owner: "Юлия"
  }
];

const analyticsKpis = [
  { label: "Всего входящих", value: "1 248", note: "+12% к предыдущему месяцу" },
  { label: "Квалифицировано", value: "812", note: "65.1% от входящих" },
  { label: "Записано", value: "436", note: "53.7% от квалифицированных" },
  { label: "Потеряно", value: "228", note: "18.3% от входящих" },
  { label: "Среднее время ответа", value: "27 сек", note: "На 19 сек быстрее базы" },
  { label: "Общая конверсия", value: "34.9%", note: "+4.6 п.п. за 30 дней" }
];

const analyticsFunnelData = [
  { stage: "Входящие", value: 1248 },
  { stage: "Ответ получен", value: 1096 },
  { stage: "Квалифицировано", value: 812 },
  { stage: "Доведено до записи", value: 436 },
  { stage: "Потеряно", value: 228 }
];

const analyticsTrendData = [
  { day: "01 мар", incoming: 34, booked: 11 },
  { day: "03 мар", incoming: 38, booked: 13 },
  { day: "05 мар", incoming: 41, booked: 14 },
  { day: "07 мар", incoming: 39, booked: 13 },
  { day: "09 мар", incoming: 45, booked: 16 },
  { day: "11 мар", incoming: 47, booked: 17 },
  { day: "13 мар", incoming: 44, booked: 15 },
  { day: "15 мар", incoming: 52, booked: 19 },
  { day: "17 мар", incoming: 49, booked: 18 },
  { day: "19 мар", incoming: 55, booked: 21 }
];

const analyticsConversionData = [
  { name: "Записано", value: 436 },
  { name: "Потеряно", value: 228 }
];

const analyticsChannelData = [
  { channel: "Telegram", incoming: 342, qualified: 254, booked: 148, conversion: 43.3 },
  { channel: "WhatsApp", incoming: 318, qualified: 217, booked: 124, conversion: 39.0 },
  { channel: "Instagram", incoming: 366, qualified: 226, booked: 111, conversion: 30.3 },
  { channel: "Website", incoming: 222, qualified: 115, booked: 53, conversion: 23.9 }
];

const analyticsResponseTrend = [
  { period: "Пн", seconds: 31 },
  { period: "Вт", seconds: 29 },
  { period: "Ср", seconds: 26 },
  { period: "Чт", seconds: 28 },
  { period: "Пт", seconds: 24 },
  { period: "Сб", seconds: 22 },
  { period: "Вс", seconds: 25 }
];

const analyticsInsights = [
  "Большая часть лидов теряется после вопроса о стоимости.",
  "Telegram даёт больше целевых обращений, чем сайт.",
  "Есть 12 лидов, которым стоит написать повторно.",
  "Пик входящих обращений приходится на 17:00-20:00, увеличьте плотность слотов в это окно."
];

const aiRecommendationsFeed: AiRecommendation[] = [
  {
    id: "AI-201",
    title: "Слишком резкий ответ на вопрос о стоимости",
    description: "В 37% диалогов ответ на цену не объясняет ценность услуги и не предлагает следующий шаг.",
    priority: "Критично",
    expectedImpact: "+6-10% к конверсии в запись",
    actionLabel: "Обновить сценарий",
    area: "Скрипт первого ответа"
  },
  {
    id: "AI-202",
    title: "Есть 9 лидов без повторного касания",
    description: "Лиды проявили интерес, но после первого ответа не получили follow-up в течение 24 часов.",
    priority: "Высокий",
    expectedImpact: "До 42 000 ₽ возврата выручки",
    actionLabel: "Запустить follow-up",
    area: "Recovery-цепочка"
  },
  {
    id: "AI-203",
    title: "В WhatsApp выше конверсия, чем в Instagram",
    description: "Конверсия в запись: WhatsApp 39%, Instagram 30%. Рекомендуется перераспределить трафик.",
    priority: "Средний",
    expectedImpact: "+3-5 п.п. общей конверсии",
    actionLabel: "Применить",
    area: "Канальная стратегия"
  },
  {
    id: "AI-204",
    title: "Запись предлагается слишком поздно",
    description: "После выявления намерения система в среднем делает 2 лишних шага перед предложением слота.",
    priority: "Высокий",
    expectedImpact: "-18% потерь на этапе записи",
    actionLabel: "Обновить сценарий",
    area: "Логика доведения до записи"
  }
];

const aiPriorityActions = [
  {
    title: "Переписать блок ответа о цене",
    detail: "Добавить диапазон стоимости + короткое обоснование + предложение двух слотов.",
    action: "Обновить сценарий"
  },
  {
    title: "Вернуть «тихие» лиды за 24 часа",
    detail: "Запустить 2-step follow-up для 9 лидов с высоким lead score.",
    action: "Запустить follow-up"
  },
  {
    title: "Сместить приоритет в WhatsApp",
    detail: "Увеличить долю обращений из WhatsApp в промо-источниках на 20%.",
    action: "Применить"
  }
];

const aiBeforeAfterExamples = [
  {
    context: "Запрос стоимости в Instagram",
    before: "Цена от 4500 ₽. Если подходит, записывайтесь.",
    after:
      "Стоимость обычно 4500-6200 ₽ в зависимости от задачи. Могу сразу предложить 2 ближайших слота и закрепить удобный вариант."
  },
  {
    context: "Лид замолчал после первого ответа",
    before: "Напишите, если актуально.",
    after:
      "Вижу, что вопрос еще актуален. Могу предложить время на сегодня после 18:00 или завтра утром. Какой вариант удобнее?"
  }
];

const aiRewrittenReplies = [
  {
    scenario: "Клиент: «Сколько стоит?»",
    reply:
      "Ориентир по стоимости: 4500-6200 ₽ в зависимости от объема. Чтобы назвать точнее и сразу подобрать время, уточню 2 детали и предложу свободные слоты."
  },
  {
    scenario: "Клиент: «Я подумаю»",
    reply:
      "Конечно. Чтобы вам было проще сравнить варианты, могу зафиксировать удобный слот без предоплаты на 2 часа. Подойдет?"
  },
  {
    scenario: "Клиент не отвечает после квалификации",
    reply:
      "Напомню о вашем запросе: могу отправить короткое сравнение вариантов и сразу предложить запись в удобное окно."
  }
];

const aiImpactEstimation = [
  { metric: "Дополнительные записи", current: "176 / мес", projected: "203 / мес", uplift: "+27" },
  { metric: "Конверсия в запись", current: "36.5%", projected: "41.1%", uplift: "+4.6 п.п." },
  { metric: "Возврат потерянной выручки", current: "—", projected: "до 84 000 ₽ / мес", uplift: "Recovery" },
  { metric: "Среднее время до записи", current: "14 ч", projected: "9 ч", uplift: "-35%" }
];

const sitesTemplates: SitesTemplate[] = [
  {
    id: "clarity-one",
    name: "Clarity One",
    description: "Универсальный премиальный шаблон для сервисного бизнеса с акцентом на доверие и запись.",
    suitableFor: ["Салоны", "Клиники", "Локальные сервисы", "Консультанты"],
    styleLabel: "Светлый / деловой",
    previewTheme: {
      gradientFrom: "from-cyan-100/70",
      gradientTo: "to-slate-100",
      accent: "bg-cyan-600",
      surface: "bg-white"
    },
    heroPattern: "Акцент на конверсии и прозрачной записи"
  },
  {
    id: "service-pro",
    name: "Service Pro",
    description: "Структура для компаний с большим потоком заявок и повторных обращений.",
    suitableFor: ["Барбершопы", "Автосервисы", "Ремонт", "Локальный сервис"],
    styleLabel: "Контрастный / операционный",
    previewTheme: {
      gradientFrom: "from-slate-200",
      gradientTo: "to-cyan-100/70",
      accent: "bg-slate-900",
      surface: "bg-slate-50"
    },
    heroPattern: "Фокус на скорости ответа и маршруте клиента"
  },
  {
    id: "trust-medical",
    name: "Trust Medical",
    description: "Спокойная экспертная подача для медицины, диагностики и персональных практик.",
    suitableFor: ["Клиники", "Стоматология", "Психология", "Wellness"],
    styleLabel: "Нейтральный / экспертный",
    previewTheme: {
      gradientFrom: "from-blue-100/80",
      gradientTo: "to-white",
      accent: "bg-blue-700",
      surface: "bg-white"
    },
    heroPattern: "Акцент на компетентности и безопасной коммуникации"
  },
  {
    id: "expert-signature",
    name: "Expert Signature",
    description: "Персональный стиль для экспертов, коучей и студий с высоким средним чеком.",
    suitableFor: ["Эксперты", "Консультанты", "Онлайн-услуги", "Авторские студии"],
    styleLabel: "Минималистичный / premium",
    previewTheme: {
      gradientFrom: "from-violet-100/60",
      gradientTo: "to-rose-100/60",
      accent: "bg-violet-700",
      surface: "bg-white"
    },
    heroPattern: "Сильный личный бренд и точный оффер"
  }
];

const sitesFlowSteps = [
  "Выбор шаблона",
  "Бриф из 10 вопросов",
  "Генерация контента",
  "Публикация сайта"
];

const sitesQuestions: SitesQuestion[] = [
  { id: "businessType", label: "1. Чем вы занимаетесь?", placeholder: "Например: салон красоты / клиника / барбершоп", hint: "Это влияет на структуру услуг и блоки доверия." },
  { id: "businessName", label: "2. Название бизнеса", placeholder: "Например: Studio Nova", hint: "Будет использовано в заголовке и в контактах." },
  { id: "city", label: "3. Город или район", placeholder: "Например: Москва, Хамовники", hint: "Поможет сделать текст более локальным и релевантным." },
  { id: "mainOffer", label: "4. Ключевая услуга", placeholder: "Например: окрашивание и восстановление волос", hint: "Станет центральным оффером на первом экране." },
  { id: "audience", label: "5. Кто ваш основной клиент?", placeholder: "Например: женщины 25-40, которым важен аккуратный сервис", hint: "Помогает задать правильный тон и акценты." },
  { id: "priceRange", label: "6. Диапазон чека", placeholder: "Например: от 3 500 до 7 000 ₽", hint: "Нужен для честного ценового позиционирования." },
  { id: "advantages", label: "7. Ваши сильные стороны", placeholder: "Например: опыт мастеров, стерильность, быстрый ответ", hint: "Ляжет в блок преимуществ." },
  { id: "channels", label: "8. Каналы связи", placeholder: "Например: WhatsApp, Telegram, Instagram, сайт", hint: "Будет отражено в контактах и CTA." },
  { id: "goal", label: "9. Главная цель сайта", placeholder: "Например: больше записей на первичную консультацию", hint: "Определяет главное действие на сайте." },
  { id: "tone", label: "10. Тон коммуникации", placeholder: "Например: спокойно, уверенно, премиально", hint: "Определяет стиль заголовков и формулировок." }
];

const defaultSitesAnswers: Record<string, string> = {
  businessType: "Салон красоты",
  businessName: "Studio Nova",
  city: "Москва",
  mainOffer: "Окрашивание и комплексный уход",
  audience: "Женщины 25-40, которые ценят аккуратный сервис",
  priceRange: "от 3 500 до 7 000 ₽",
  advantages: "Опыт мастеров, прозрачные цены, ответ в течение 2 минут",
  channels: "WhatsApp, Telegram, Instagram",
  goal: "Больше записей на первую услугу",
  tone: "Премиально и спокойно"
};

function buildFallbackSiteContent(
  template: SitesTemplate,
  answers: Record<string, string>
): GeneratedSiteContent {
  return {
    heroTitle: `${answers.businessName} — ${answers.mainOffer.toLowerCase()} без лишних ожиданий`,
    heroSubtitle: `${answers.businessType} в ${answers.city}. Помогаем клиенту быстро понять формат услуги и записаться в удобное время.`,
    primaryCta: "Оставить заявку",
    secondaryCta: "Посмотреть услуги",
    valueProps: [
      `Ответ по заявке в течение 2 минут через ${answers.channels}.`,
      `Прозрачный диапазон стоимости: ${answers.priceRange}.`,
      `Сервис под аудиторию: ${answers.audience}.`
    ],
    services: [
      `${answers.mainOffer}`,
      "Первичная консультация",
      "Сопровождение до результата"
    ],
    about: `${answers.businessName} — это ${answers.businessType.toLowerCase()} с акцентом на сервис и понятную коммуникацию. Наши сильные стороны: ${answers.advantages}.`,
    processSteps: [
      "Оставляете заявку на сайте",
      "Получаете быстрый ответ и уточнение задачи",
      "Подтверждаете удобное время и приходите на услугу"
    ],
    faq: [
      { q: "Как быстро вы отвечаете на заявку?", a: "Обычно в течение 2 минут в рабочие часы, в остальное время — с ранним приоритетом." },
      { q: "Можно ли уточнить стоимость заранее?", a: `Да, сразу даем рабочий диапазон: ${answers.priceRange} и объясняем, от чего зависит финальная стоимость.` },
      { q: "Как записаться?", a: "Оставьте заявку в форме или напишите в удобный канал связи — мы предложим ближайшие окна." }
    ],
    finalCtaTitle: `${template.name}: готово к публикации за 5 минут`,
    finalCtaText: `Цель сайта: ${answers.goal}. Подключите форму и передавайте лиды прямо в ClientsFlow.`
  };
}

const analyticsPalette = {
  incoming: "#0ea5e9",
  booked: "#0f172a",
  qualified: "#38bdf8",
  lost: "#f43f5e",
  donutBooked: "#0f172a",
  donutLost: "#cbd5e1"
};

function loadSubscription(): SubscriptionState {
  if (typeof window === "undefined") {
    return { planId: null, subscriptionStatus: "none", trialStartDate: null, onboardingCompleted: false };
  }

  const raw = localStorage.getItem("clientsflow_subscription_state_v1");
  if (!raw) {
    return { planId: null, subscriptionStatus: "none", trialStartDate: null, onboardingCompleted: false };
  }

  try {
    const parsed = JSON.parse(raw) as SubscriptionState;
    return {
      planId: parsed.planId ?? null,
      subscriptionStatus: parsed.subscriptionStatus ?? "none",
      trialStartDate: parsed.trialStartDate ?? null,
      onboardingCompleted: parsed.onboardingCompleted ?? false,
      onboardingData: parsed.onboardingData ?? {
        businessType: "",
        channels: [],
        goals: []
      }
    };
  } catch {
    return { planId: null, subscriptionStatus: "none", trialStartDate: null, onboardingCompleted: false };
  }
}

function saveSubscription(next: SubscriptionState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("clientsflow_subscription_state_v1", JSON.stringify(next));
}

function formatRub(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)} руб.`;
}

function buildLinePoints(values: number[]): string {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function App() {
  const [activeNav, setActiveNav] = useState<NavItem>("Обзор");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "все">("все");
  const [channelFilter, setChannelFilter] = useState<Channel | "все">("все");
  const [selectedConversationId, setSelectedConversationId] = useState<string>(inboxConversations[0].id);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadStageFilter, setLeadStageFilter] = useState<LeadStage | "все">("все");
  const [leadChannelFilter, setLeadChannelFilter] = useState<Channel | "все">("все");
  const [leadBookingFilter, setLeadBookingFilter] = useState<BookingState | "все">("все");
  const [leadSortBy, setLeadSortBy] = useState<"lastActivity" | "score" | "revenue" | "name">("lastActivity");
  const [leadSortDirection, setLeadSortDirection] = useState<"asc" | "desc">("asc");
  const [leadViewMode, setLeadViewMode] = useState<"table" | "board">("table");
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  const [lostRevenuePeriod, setLostRevenuePeriod] = useState<"7d" | "30d">("7d");
  const [aiActionMessage, setAiActionMessage] = useState<string | null>(null);
  const [sitesTemplateId, setSitesTemplateId] = useState<string>(sitesTemplates[0].id);
  const [sitesAnswers, setSitesAnswers] = useState<Record<string, string>>(defaultSitesAnswers);
  const [sitesGeneratedContent, setSitesGeneratedContent] = useState<GeneratedSiteContent>(() =>
    buildFallbackSiteContent(sitesTemplates[0], defaultSitesAnswers)
  );
  const [sitesFlowStatus, setSitesFlowStatus] = useState<"idle" | "generating" | "ready" | "published">("idle");
  const [sitesGenerationProgress, setSitesGenerationProgress] = useState(0);
  const [sitesActionMessage, setSitesActionMessage] = useState<string | null>(null);
  const [sitesLastGenerationMode, setSitesLastGenerationMode] = useState<"ai" | "fallback" | null>(null);
  const [mobileInboxView, setMobileInboxView] = useState<"list" | "detail">("list");
  const [subscription, setSubscription] = useState<SubscriptionState>(() => loadSubscription());
  const [checkoutPlanId, setCheckoutPlanId] = useState<PlanDefinition["id"] | null>(null);
  const [checkoutCardholder, setCheckoutCardholder] = useState("Иван Петров");
  const [checkoutCardNumber, setCheckoutCardNumber] = useState("4242 4242 4242 4242");
  const [checkoutExpiry, setCheckoutExpiry] = useState("12/29");
  const [checkoutCvv, setCheckoutCvv] = useState("123");
  const [checkoutState, setCheckoutState] = useState<"idle" | "processing" | "success">("idle");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingBusinessType, setOnboardingBusinessType] = useState("салон красоты");
  const [onboardingChannels, setOnboardingChannels] = useState<string[]>(["WhatsApp"]);
  const [onboardingGoals, setOnboardingGoals] = useState<string[]>(["быстрее отвечать"]);
  const [uiNotice, setUiNotice] = useState<string | null>(null);

  const kpis = useMemo(
    () => [
      { label: "Входящие лиды", value: "482", note: "+14% к прошлому периоду" },
      { label: "Квалифицировано", value: "314", note: "65% от входящих" },
      { label: "Записано", value: "176", note: "Конверсия в запись 36.5%" },
      { label: "Потеряно", value: "57", note: "11.8% от входящих" },
      { label: "Среднее время ответа", value: "19 сек", note: "Было 62 сек до запуска" },
      { label: "Конверсия", value: "36.5%", note: "+8.2 п.п. за 30 дней" }
    ],
    []
  );

  const currentPlanLabel =
    subscription.planId === "trial"
      ? "Пробный"
      : subscription.planId === "basic"
        ? "Базовый"
        : subscription.planId === "pro"
          ? "Pro"
          : subscription.planId === "business"
            ? "Business"
            : "Не активирован";

  const currentPlanDefinition =
    planDefinitions.find((plan) => plan.id === (subscription.planId ?? "trial")) ?? planDefinitions[0];
  const trialDaysLeft = useMemo(() => {
    if (subscription.subscriptionStatus !== "trial" || !subscription.trialStartDate) return 0;
    const start = new Date(subscription.trialStartDate).getTime();
    const elapsed = Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, 7 - elapsed);
  }, [subscription.subscriptionStatus, subscription.trialStartDate]);

  const showUpgrade =
    subscription.subscriptionStatus !== "active" ||
    subscription.planId === "trial" ||
    subscription.planId === "basic";

  const hasFeature = (feature: PlanFeatureKey): boolean => {
    return currentPlanDefinition.gates[feature];
  };

  const bookedLeadsValue = analyticsConversionData.find((item) => item.name === "Записано")?.value ?? 0;
  const lostLeadsValue = analyticsConversionData.find((item) => item.name === "Потеряно")?.value ?? 0;
  const conversionTotal = bookedLeadsValue + lostLeadsValue;
  const conversionBookedPercent = conversionTotal > 0 ? Math.round((bookedLeadsValue / conversionTotal) * 100) : 0;
  const conversionLostPercent = conversionTotal > 0 ? Math.round((lostLeadsValue / conversionTotal) * 100) : 0;
  const averageResponse = Math.round(
    analyticsResponseTrend.reduce((sum, point) => sum + point.seconds, 0) / analyticsResponseTrend.length
  );
  const worstResponse = Math.max(...analyticsResponseTrend.map((point) => point.seconds));
  const lostRevenueSnapshot = lostRevenueByPeriod[lostRevenuePeriod];
  const selectedSitesTemplate = sitesTemplates.find((item) => item.id === sitesTemplateId) ?? sitesTemplates[0];
  const generatedSitesHeadline = sitesGeneratedContent.heroTitle;
  const generatedSitesSubheadline = sitesGeneratedContent.heroSubtitle;
  const chartTooltipStyle = {
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 14px 30px rgba(2, 6, 23, 0.1)"
  };

  const linePoints = useMemo(() => buildLinePoints(leadsOverTime), []);
  const filteredConversations = useMemo(
    () =>
      inboxConversations.filter((item) => {
        const passStatus = statusFilter === "все" || item.status === statusFilter;
        const passChannel = channelFilter === "все" || item.channel === channelFilter;
        return passStatus && passChannel;
      }),
    [statusFilter, channelFilter]
  );

  const selectedConversation =
    filteredConversations.find((item) => item.id === selectedConversationId) ?? filteredConversations[0] ?? null;

  const statusCounts = useMemo(
    () =>
      allStatuses.reduce<Record<string, number>>((acc, status) => {
        acc[status] =
          status === "все" ? inboxConversations.length : inboxConversations.filter((item) => item.status === status).length;
        return acc;
      }, {}),
    []
  );

  const channelCounts = useMemo(
    () =>
      allChannels.reduce<Record<string, number>>((acc, channel) => {
        acc[channel] =
          channel === "все" ? inboxConversations.length : inboxConversations.filter((item) => item.channel === channel).length;
        return acc;
      }, {}),
    []
  );

  const leadStageCounts = useMemo(
    () =>
      leadStages.reduce<Record<string, number>>((acc, stage) => {
        acc[stage] = stage === "все" ? leadRecords.length : leadRecords.filter((item) => item.stage === stage).length;
        return acc;
      }, {}),
    []
  );

  const filteredLeads = useMemo(() => {
    const normalizedQuery = leadQuery.trim().toLowerCase();
    return leadRecords
      .filter((lead) => {
        const passQuery =
          normalizedQuery.length === 0 ||
          lead.name.toLowerCase().includes(normalizedQuery) ||
          lead.id.toLowerCase().includes(normalizedQuery) ||
          lead.business.toLowerCase().includes(normalizedQuery) ||
          lead.tags.join(" ").toLowerCase().includes(normalizedQuery);
        const passStage = leadStageFilter === "все" || lead.stage === leadStageFilter;
        const passChannel = leadChannelFilter === "все" || lead.channel === leadChannelFilter;
        const passBooking = leadBookingFilter === "все" || lead.bookingState === leadBookingFilter;
        return passQuery && passStage && passChannel && passBooking;
      })
      .sort((a, b) => {
        if (leadSortBy === "name") {
          const cmp = a.name.localeCompare(b.name, "ru");
          return leadSortDirection === "asc" ? cmp : -cmp;
        }
        if (leadSortBy === "score") {
          const cmp = a.score - b.score;
          return leadSortDirection === "asc" ? cmp : -cmp;
        }
        if (leadSortBy === "revenue") {
          const cmp = a.estimatedRevenue - b.estimatedRevenue;
          return leadSortDirection === "asc" ? cmp : -cmp;
        }
        const cmp = a.lastActivityMinutes - b.lastActivityMinutes;
        return leadSortDirection === "asc" ? cmp : -cmp;
      });
  }, [leadQuery, leadStageFilter, leadChannelFilter, leadBookingFilter, leadSortBy, leadSortDirection]);

  const boardLeads = useMemo(
    () =>
      leadStages
        .filter((stage): stage is LeadStage => stage !== "все")
        .map((stage) => ({
          stage,
          items: filteredLeads.filter((lead) => lead.stage === stage)
        })),
    [filteredLeads]
  );

  function statusBadgeClass(status: LeadStatus): string {
    switch (status) {
      case "новый":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "квалифицирован":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "ожидает записи":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "записан":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "потерян":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  }

  function leadStageBadgeClass(stage: LeadStage): string {
    switch (stage) {
      case "новый":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "квалифицирован":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "ожидает записи":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "записан":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "потерян":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-violet-50 text-violet-700 border-violet-200";
    }
  }

  function bookingBadgeClass(state: BookingState): string {
    switch (state) {
      case "подтверждена":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "в процессе":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "отменена":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  }

  function recommendationPriorityClass(priority: RecommendationPriority): string {
    if (priority === "Критично") return "bg-rose-100 text-rose-700 border-rose-200";
    if (priority === "Высокий") return "bg-amber-100 text-amber-700 border-amber-200";
    return "bg-cyan-100 text-cyan-700 border-cyan-200";
  }

  function roleBubbleClass(role: TimelineMessage["role"]): string {
    if (role === "client") return "bg-white border border-slate-200 text-slate-700";
    if (role === "ai") return "bg-cyan-50 border border-cyan-200 text-cyan-900";
    return "bg-emerald-50 border border-emerald-200 text-emerald-900";
  }

  function handleNavChange(item: NavItem): void {
    if (item === "AI рекомендации" && !hasFeature("aiRecommendations")) {
      handleFeatureGuard("aiRecommendations");
      return;
    }
    if (item === "ClientsFlow Sites" && !hasFeature("sitesBuilder")) {
      handleFeatureGuard("sitesBuilder");
      return;
    }
    if (item === "Потерянные" && !hasFeature("lostRecovery")) {
      handleFeatureGuard("lostRecovery");
      return;
    }
    setActiveNav(item);
    setMobileInboxView("list");
  }

  function updateSitesAnswer(fieldId: string, value: string): void {
    setSitesAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }

  function toStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, Math.max(fallback.length, 3));
    return normalized.length > 0 ? normalized : fallback;
  }

  function toFaqArray(value: unknown, fallback: Array<{ q: string; a: string }>): Array<{ q: string; a: string }> {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
      .map((item) => {
        const record = item as { q?: unknown; a?: unknown };
        const q = typeof record.q === "string" ? record.q.trim() : "";
        const a = typeof record.a === "string" ? record.a.trim() : "";
        if (!q || !a) return null;
        return { q, a };
      })
      .filter((item): item is { q: string; a: string } => Boolean(item))
      .slice(0, 4);
    return normalized.length > 0 ? normalized : fallback;
  }

  function sanitizeGeneratedContent(
    candidate: Partial<GeneratedSiteContent> | null,
    fallback: GeneratedSiteContent
  ): GeneratedSiteContent {
    if (!candidate) return fallback;
    return {
      heroTitle: typeof candidate.heroTitle === "string" && candidate.heroTitle.trim() ? candidate.heroTitle.trim() : fallback.heroTitle,
      heroSubtitle:
        typeof candidate.heroSubtitle === "string" && candidate.heroSubtitle.trim() ? candidate.heroSubtitle.trim() : fallback.heroSubtitle,
      primaryCta: typeof candidate.primaryCta === "string" && candidate.primaryCta.trim() ? candidate.primaryCta.trim() : fallback.primaryCta,
      secondaryCta:
        typeof candidate.secondaryCta === "string" && candidate.secondaryCta.trim() ? candidate.secondaryCta.trim() : fallback.secondaryCta,
      valueProps: toStringArray(candidate.valueProps, fallback.valueProps),
      services: toStringArray(candidate.services, fallback.services),
      about: typeof candidate.about === "string" && candidate.about.trim() ? candidate.about.trim() : fallback.about,
      processSteps: toStringArray(candidate.processSteps, fallback.processSteps),
      faq: toFaqArray(candidate.faq, fallback.faq),
      finalCtaTitle:
        typeof candidate.finalCtaTitle === "string" && candidate.finalCtaTitle.trim()
          ? candidate.finalCtaTitle.trim()
          : fallback.finalCtaTitle,
      finalCtaText:
        typeof candidate.finalCtaText === "string" && candidate.finalCtaText.trim()
          ? candidate.finalCtaText.trim()
          : fallback.finalCtaText
    };
  }

  function parseJsonFromText(text: string): Partial<GeneratedSiteContent> | null {
    if (!text.trim()) return null;
    const direct = text.trim();
    const start = direct.indexOf("{");
    const end = direct.lastIndexOf("}");
    const source = start >= 0 && end > start ? direct.slice(start, end + 1) : direct;
    try {
      return JSON.parse(source) as Partial<GeneratedSiteContent>;
    } catch {
      return null;
    }
  }

  async function generateSitesWithAi(): Promise<void> {
    const baseFallback = buildFallbackSiteContent(selectedSitesTemplate, sitesAnswers);
    const prompt = [
      "Сгенерируй контент для лендинга малого бизнеса в России.",
      "Верни строго JSON без markdown.",
      "Тон: премиально, спокойно, профессионально, без хайпа.",
      "Избегай слов: AI, ИИ, нейросеть, революция, магия.",
      "Структура JSON:",
      "{\"heroTitle\":\"\",\"heroSubtitle\":\"\",\"primaryCta\":\"\",\"secondaryCta\":\"\",\"valueProps\":[\"\",\"\",\"\"],\"services\":[\"\",\"\",\"\"],\"about\":\"\",\"processSteps\":[\"\",\"\",\"\"],\"faq\":[{\"q\":\"\",\"a\":\"\"},{\"q\":\"\",\"a\":\"\"},{\"q\":\"\",\"a\":\"\"}],\"finalCtaTitle\":\"\",\"finalCtaText\":\"\"}",
      `Шаблон: ${selectedSitesTemplate.name}. Стиль: ${selectedSitesTemplate.styleLabel}.`,
      `Данные бизнеса: ${JSON.stringify(sitesAnswers, null, 2)}`
    ].join("\n");

    setSitesFlowStatus("generating");
    setSitesGenerationProgress(12);
    setSitesActionMessage("Готовим структуру и тексты на основе вашего брифа.");
    setSitesLastGenerationMode(null);

    const progress1 = window.setTimeout(() => setSitesGenerationProgress(34), 300);
    const progress2 = window.setTimeout(() => setSitesGenerationProgress(58), 700);
    const progress3 = window.setTimeout(() => setSitesGenerationProgress(82), 1200);

    try {
      const response = await fetch("/api/openrouter/sites-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter status ${response.status}`);
      }

      const data = (await response.json()) as { reply?: string };
      const parsed = parseJsonFromText(data.reply ?? "");
      const normalized = sanitizeGeneratedContent(parsed, baseFallback);

      setSitesGeneratedContent(normalized);
      setSitesLastGenerationMode("ai");
      setSitesGenerationProgress(100);
      setSitesFlowStatus("ready");
      setSitesActionMessage("Контент сгенерирован. Проверьте предпросмотр и публикуйте.");
    } catch {
      setSitesGeneratedContent(baseFallback);
      setSitesLastGenerationMode("fallback");
      setSitesGenerationProgress(100);
      setSitesFlowStatus("ready");
      setSitesActionMessage("Сеть недоступна, применён надежный шаблонный вариант. Можно публиковать или перегенерировать.");
    } finally {
      window.clearTimeout(progress1);
      window.clearTimeout(progress2);
      window.clearTimeout(progress3);
    }
  }

  useEffect(() => {
    saveSubscription(subscription);
  }, [subscription]);

  useEffect(() => {
    if (sitesFlowStatus !== "idle") return;
    setSitesGeneratedContent(buildFallbackSiteContent(selectedSitesTemplate, sitesAnswers));
  }, [sitesAnswers, sitesFlowStatus, selectedSitesTemplate]);

  useEffect(() => {
    if (!uiNotice) return;
    const timer = window.setTimeout(() => setUiNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [uiNotice]);

  const selectedCheckoutPlan = planDefinitions.find((plan) => plan.id === checkoutPlanId) ?? null;

  function triggerNotice(message: string): void {
    setUiNotice(message);
  }

  function handleFeatureGuard(feature: PlanFeatureKey): boolean {
    if (hasFeature(feature)) return true;
    handleNavChange("Настройки");
    triggerNotice(`Функция доступна на тарифе Pro и выше. Открыл раздел Настройки.`);
    return false;
  }

  function toggleChoice(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function activateTrial(): void {
    setSubscription((prev) => ({
      ...prev,
      planId: "trial",
      subscriptionStatus: "trial",
      trialStartDate: new Date().toISOString(),
      onboardingCompleted: false
    }));
    setCheckoutPlanId(null);
    setCheckoutState("idle");
    setOnboardingStep(1);
    triggerNotice("Пробный период активирован на 7 дней.");
    handleNavChange("Настройки");
  }

  function openCheckout(planId: PlanDefinition["id"]): void {
    setCheckoutPlanId(planId);
    setCheckoutState("idle");
    setCheckoutCardholder("Иван Петров");
    setCheckoutCardNumber("4242 4242 4242 4242");
    setCheckoutExpiry("12/29");
    setCheckoutCvv("123");
    handleNavChange("Настройки");
  }

  function processFakePayment(): void {
    if (!selectedCheckoutPlan || selectedCheckoutPlan.id === "trial") return;
    setCheckoutState("processing");
    window.setTimeout(() => {
      setCheckoutState("success");
      setSubscription((prev) => ({
        ...prev,
        planId: selectedCheckoutPlan.id,
        subscriptionStatus: "active",
        trialStartDate: null,
        onboardingCompleted: false
      }));
      setOnboardingStep(1);
      triggerNotice("Оплата прошла успешно. Запустите онбординг.");
    }, 1300);
  }

  function finishOnboarding(): void {
    setSubscription((prev) => ({
      ...prev,
      onboardingCompleted: true,
      onboardingData: {
        businessType: onboardingBusinessType,
        channels: onboardingChannels,
        goals: onboardingGoals
      }
    }));
    triggerNotice("Онбординг завершен. Система готова к работе.");
    handleNavChange("Обзор");
  }

  return (
    <div className="app-shell min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-[260px] shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
          <div className="mb-8 px-2">
            <p className="text-lg font-extrabold tracking-tight">ClientsFlow</p>
            <p className="mt-1 text-xs text-slate-500">AI Client Operations</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => handleNavChange(item)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                  activeNav === item
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-cyan-200 bg-cyan-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Текущий план</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{currentPlanLabel}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 px-3 py-3 backdrop-blur md:px-6 md:py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">{activeNav}</h1>
                <p className="text-xs text-slate-500 sm:text-sm">Рабочая панель управления потоком обращений</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => triggerNotice("Период: последние 30 дней")}
                  className="hidden rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 sm:block"
                >
                  Последние 30 дней
                </button>
                <div className="h-8 w-8 rounded-full bg-slate-900 shadow-sm sm:h-9 sm:w-9" />
              </div>
            </div>

            <div className="-mx-1 mt-3 overflow-x-auto pb-1 lg:hidden">
              <div className="flex min-w-max gap-2 px-1">
                {navItems.map((item) => (
                  <button
                    key={`mobile-${item}`}
                    onClick={() => handleNavChange(item)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      activeNav === item ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto px-3 py-4 pb-24 sm:px-4 sm:py-6 md:px-6 lg:pb-6">
            <div className="mx-auto w-full max-w-[1440px]">
            {uiNotice ? (
              <div className="mb-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">
                {uiNotice}
              </div>
            ) : null}
            {activeNav === "Диалоги" ? (
              <div className="grid gap-4 xl:grid-cols-[220px_1fr_360px]">
                <aside className={`${mobileInboxView === "detail" ? "hidden xl:block" : "block"} rounded-3xl border border-slate-200 bg-white p-4 shadow-sm`}>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Этапы лидов</p>
                  <div className="mt-3 space-y-1.5">
                    {allStatuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          statusFilter === status ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="capitalize">{status}</span>
                        <span className="text-xs opacity-80">{statusCounts[status]}</span>
                      </button>
                    ))}
                  </div>

                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Каналы</p>
                  <div className="mt-3 space-y-1.5">
                    {allChannels.map((channel) => (
                      <button
                        key={channel}
                        onClick={() => setChannelFilter(channel)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          channelFilter === channel ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span>{channel}</span>
                        <span className="text-xs opacity-80">{channelCounts[channel]}</span>
                      </button>
                    ))}
                  </div>
                </aside>

                <section className={`${mobileInboxView === "detail" ? "hidden xl:block" : "block"} rounded-3xl border border-slate-200 bg-white p-4 shadow-sm`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">AI Inbox</p>
                      <p className="text-sm text-slate-600">Входящие обращения и лиды в одном окне</p>
                    </div>
                    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
                      {filteredConversations.length} диалогов
                    </span>
                  </div>

                  <div className="space-y-2">
                    {filteredConversations.map((item) => {
                      const selected = selectedConversation?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedConversationId(item.id);
                            setMobileInboxView("detail");
                          }}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            selected
                              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className={`font-semibold ${selected ? "text-white" : "text-slate-900"}`}>{item.client}</p>
                              <p className={`text-xs ${selected ? "text-slate-300" : "text-slate-500"}`}>
                                {item.channel} • {item.lastActivity}
                              </p>
                            </div>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                selected ? "border-white/30 text-white" : statusBadgeClass(item.status)
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <p className={`mt-2 text-sm ${selected ? "text-slate-200" : "text-slate-700"}`}>{item.summary}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            <span className={`rounded-full px-2 py-0.5 ${selected ? "bg-white/10 text-white" : "bg-white text-slate-600"}`}>
                              Lead score: {item.score}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 ${selected ? "bg-white/10 text-white" : "bg-white text-slate-600"}`}>
                              Вероятность покупки: {item.purchaseProbability}%
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    {filteredConversations.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        По выбранным фильтрам диалоги не найдены.
                      </div>
                    ) : null}
                  </div>
                </section>

                <aside className={`${mobileInboxView === "detail" ? "block" : "hidden xl:block"} rounded-3xl border border-slate-200 bg-white p-4 shadow-sm`}>
                  {selectedConversation ? (
                    <div>
                      <button
                        onClick={() => setMobileInboxView("list")}
                        className="mb-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 xl:hidden"
                      >
                        ← Назад к списку
                      </button>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{selectedConversation.client}</p>
                          <p className="text-xs text-slate-500">{selectedConversation.channel} • {selectedConversation.lastActivity}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(selectedConversation.status)}`}>
                          {selectedConversation.status}
                        </span>
                      </div>

                      <div className="h-56 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        {selectedConversation.timeline.map((msg, idx) => (
                          <div key={`${msg.time}-${idx}`} className={`rounded-xl px-3 py-2 text-sm ${roleBubbleClass(msg.role)}`}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70">
                              {msg.role === "client" ? "Клиент" : msg.role === "ai" ? "AI" : "Менеджер"} • {msg.time}
                            </p>
                            <p className="mt-1 leading-relaxed">{msg.text}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">AI summary</p>
                          <p className="mt-1 text-sm text-slate-700">{selectedConversation.summary}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Обнаруженный интент</p>
                          <p className="mt-1 text-sm text-slate-700">{selectedConversation.intent}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Извлеченные поля</p>
                          <div className="mt-1 space-y-1 text-sm text-slate-700">
                            {selectedConversation.extractedFields.map((field) => (
                              <p key={field.label}>
                                <span className="font-semibold">{field.label}:</span> {field.value}
                              </p>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Рекомендованный следующий шаг</p>
                          <p className="mt-1 text-sm text-slate-700">{selectedConversation.suggestedAction}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Заметки</p>
                          <p className="mt-1 text-sm text-slate-700">{selectedConversation.notes}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button
                          onClick={() => triggerNotice("Follow-up отправлен клиенту.")}
                          className="w-full flex-1 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                          Отправить follow-up
                        </button>
                        <button
                          onClick={() => triggerNotice("Лид передан менеджеру.")}
                          className="w-full flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                        >
                          Передать менеджеру
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Выберите диалог для просмотра деталей.
                    </div>
                  )}
                </aside>
              </div>
            ) : activeNav === "Лиды" ? (
              <div className="space-y-4">
                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Lead Operations</p>
                      <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Управление лидами</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Все входящие обращения в едином операционном представлении: этапы, выручка, активность и быстрые действия.
                      </p>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <button
                        onClick={() => setLeadViewMode("table")}
                        className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                          leadViewMode === "table" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        Таблица
                      </button>
                      <button
                        onClick={() => setLeadViewMode("board")}
                        className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                          leadViewMode === "board" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        Доска
                      </button>
                      <button
                        onClick={() => {
                          const timestamp = new Intl.DateTimeFormat("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          }).format(new Date());
                          setLastExportAt(timestamp);
                          triggerNotice("Экспорт лидов подготовлен.");
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                      >
                        Экспорт CSV
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Поиск</span>
                      <input
                        value={leadQuery}
                        onChange={(e) => setLeadQuery(e.target.value)}
                        placeholder="Имя, ID, бизнес или тег"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Этап</span>
                      <select
                        value={leadStageFilter}
                        onChange={(e) => setLeadStageFilter(e.target.value as LeadStage | "все")}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      >
                        {leadStages.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Канал</span>
                      <select
                        value={leadChannelFilter}
                        onChange={(e) => setLeadChannelFilter(e.target.value as Channel | "все")}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      >
                        {allChannels.map((channel) => (
                          <option key={channel} value={channel}>
                            {channel}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Запись</span>
                      <select
                        value={leadBookingFilter}
                        onChange={(e) => setLeadBookingFilter(e.target.value as BookingState | "все")}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      >
                        {bookingStates.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Сортировка</span>
                      <div className="flex gap-2">
                        <select
                          value={leadSortBy}
                          onChange={(e) => setLeadSortBy(e.target.value as "lastActivity" | "score" | "revenue" | "name")}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        >
                          <option value="lastActivity">По активности</option>
                          <option value="score">По lead score</option>
                          <option value="revenue">По выручке</option>
                          <option value="name">По имени</option>
                        </select>
                        <button
                          onClick={() => setLeadSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:border-slate-500"
                        >
                          {leadSortDirection === "asc" ? "↑" : "↓"}
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-slate-600">
                      Найдено лидов: <span className="font-semibold text-slate-900">{filteredLeads.length}</span>
                    </p>
                    {lastExportAt ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Экспорт подготовлен: {lastExportAt}
                      </span>
                    ) : null}
                  </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  {leadStages
                    .filter((stage): stage is LeadStage => stage !== "все")
                    .map((stage) => (
                      <div key={stage} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{stage}</p>
                        <p className="mt-2 text-2xl font-extrabold text-slate-900">{leadStageCounts[stage]}</p>
                      </div>
                    ))}
                </section>

                {leadViewMode === "table" ? (
                  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <div className="space-y-2 p-3 lg:hidden">
                      {filteredLeads.map((lead) => (
                        <div key={`mobile-${lead.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-900">{lead.name}</p>
                              <p className="text-xs text-slate-500">{lead.id} • {lead.business}</p>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${leadStageBadgeClass(lead.stage)}`}>
                              {lead.stage}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                            <p>Канал: <span className="font-semibold text-slate-900">{lead.channel}</span></p>
                            <p>Score: <span className="font-semibold text-slate-900">{lead.score}</span></p>
                            <p>Выручка: <span className="font-semibold text-slate-900">{formatRub(lead.estimatedRevenue)}</span></p>
                            <p>Активность: <span className="font-semibold text-slate-900">{lead.lastActivityLabel}</span></p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {lead.tags.map((tag) => (
                              <span key={`${lead.id}-${tag}`} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-col gap-2">
                            <button
                              onClick={() => triggerNotice(`Повторное сообщение отправлено: ${lead.name}`)}
                              className="w-full rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                            >
                              Написать повторно
                            </button>
                            <button
                              onClick={() => triggerNotice(`Лид передан менеджеру: ${lead.name}`)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                            >
                              Передать менеджеру
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-auto lg:block">
                      <table className="min-w-[1120px] w-full border-collapse">
                        <thead className="bg-slate-50">
                          <tr className="text-left text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
                            <th className="px-4 py-3">Лид</th>
                            <th className="px-4 py-3">Этап</th>
                            <th className="px-4 py-3">Канал</th>
                            <th className="px-4 py-3">Lead score</th>
                            <th className="px-4 py-3">Оценка выручки</th>
                            <th className="px-4 py-3">Последняя активность</th>
                            <th className="px-4 py-3">Состояние записи</th>
                            <th className="px-4 py-3">Теги</th>
                            <th className="px-4 py-3">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeads.map((lead) => (
                            <tr key={lead.id} className="border-t border-slate-200 text-sm text-slate-700">
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-900">{lead.name}</p>
                                <p className="text-xs text-slate-500">{lead.id} • {lead.business}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${leadStageBadgeClass(lead.stage)}`}>
                                  {lead.stage}
                                </span>
                              </td>
                              <td className="px-4 py-3">{lead.channel}</td>
                              <td className="px-4 py-3">
                                <span className="font-semibold text-slate-900">{lead.score}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-semibold text-slate-900">{formatRub(lead.estimatedRevenue)}</span>
                              </td>
                              <td className="px-4 py-3">{lead.lastActivityLabel}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${bookingBadgeClass(lead.bookingState)}`}>
                                  {lead.bookingState}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {lead.tags.map((tag) => (
                                    <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1.5">
                                  <button
                                    onClick={() => triggerNotice(`Повторное сообщение отправлено: ${lead.name}`)}
                                    className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                                  >
                                    Написать повторно
                                  </button>
                                  <button
                                    onClick={() => triggerNotice(`Лид передан менеджеру: ${lead.name}`)}
                                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                                  >
                                    Передать менеджеру
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredLeads.length === 0 ? (
                      <div className="border-t border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                        По текущим фильтрам лиды не найдены. Измените критерии поиска или сбросьте фильтры.
                      </div>
                    ) : null}
                  </section>
                ) : (
                  <section className="overflow-x-auto pb-1">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                      {boardLeads.map((column) => (
                        <div key={column.stage} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{column.stage}</p>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${leadStageBadgeClass(column.stage)}`}>
                              {column.items.length}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {column.items.map((lead) => (
                              <div key={lead.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <p className="font-semibold text-slate-900">{lead.name}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{lead.business}</p>
                                <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                                  <span>{lead.channel}</span>
                                  <span>Score {lead.score}</span>
                                </div>
                                <p className="mt-1 text-xs font-semibold text-slate-800">{formatRub(lead.estimatedRevenue)}</p>
                                <p className="mt-1 text-xs text-slate-500">{lead.lastActivityLabel}</p>
                                <button
                                  onClick={() => triggerNotice(`Повторное сообщение отправлено: ${lead.name}`)}
                                  className="mt-3 w-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                                >
                                  Написать повторно
                                </button>
                              </div>
                            ))}
                            {column.items.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                                Нет лидов
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : activeNav === "Аналитика" ? (
              <div className="space-y-4">
                {!hasFeature("advancedAnalytics") ? (
                  <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-cyan-900">
                      На текущем тарифе доступна базовая аналитика. Для канальных сравнений и расширенных AI-инсайтов обновите план до Pro.
                    </p>
                    <button
                      onClick={() => handleNavChange("Настройки")}
                      className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
                    >
                      Обновить тариф
                    </button>
                  </section>
                ) : null}
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {analyticsKpis.map((kpi) => (
                    <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{kpi.label}</p>
                      <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{kpi.value}</p>
                      <p className="mt-2 text-sm text-slate-600">{kpi.note}</p>
                    </div>
                  ))}
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Динамика лидов</p>
                      <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Входящие и доведенные до записи</h3>
                    </div>
                    <div className="h-64 sm:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analyticsTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                          <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} />
                          <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend iconType="circle" />
                          <Line
                            type="monotone"
                            dataKey="incoming"
                            name="Входящие"
                            stroke={analyticsPalette.incoming}
                            strokeWidth={3}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            animationDuration={1200}
                          />
                          <Line
                            type="monotone"
                            dataKey="booked"
                            name="Доведено до записи"
                            stroke={analyticsPalette.booked}
                            strokeWidth={3}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            animationDuration={1300}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Конверсия</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Booked vs Lost</h3>
                    <div className="mt-3 h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsConversionData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={88}
                            paddingAngle={3}
                            animationDuration={1200}
                          >
                            {analyticsConversionData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={entry.name === "Записано" ? analyticsPalette.donutBooked : analyticsPalette.donutLost}
                              />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={chartTooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Записано</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{conversionBookedPercent}%</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Потеряно</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">{conversionLostPercent}%</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Воронка лидов</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Переход по этапам обработки</h3>
                    <div className="mt-3 h-64 sm:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsFunnelData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                          <XAxis dataKey="stage" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
                          <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Bar dataKey="value" name="Лиды" fill={analyticsPalette.incoming} radius={[10, 10, 0, 0]} animationDuration={1200} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Время ответа</p>
                      <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{averageResponse} сек</p>
                      <p className="mt-1 text-sm text-slate-600">Худшее значение недели: {worstResponse} сек</p>
                      <div className="mt-3 h-24">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analyticsResponseTrend}>
                            <Line
                              type="monotone"
                              dataKey="seconds"
                              stroke={analyticsPalette.booked}
                              strokeWidth={2.5}
                              dot={false}
                              animationDuration={1000}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-100 p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-700">Потерянная выручка</p>
                        <div className="flex rounded-full border border-rose-200 bg-white p-0.5">
                          <button
                            onClick={() => setLostRevenuePeriod("7d")}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              lostRevenuePeriod === "7d" ? "bg-rose-600 text-white" : "text-slate-600"
                            }`}
                          >
                            7 дней
                          </button>
                          <button
                            onClick={() => setLostRevenuePeriod("30d")}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              lostRevenuePeriod === "30d" ? "bg-rose-600 text-white" : "text-slate-600"
                            }`}
                          >
                            30 дней
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        За последние {lostRevenueSnapshot.periodLabel} потеряно {lostRevenueSnapshot.lostLeads} лидов
                      </p>
                      <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
                        {formatRub(lostRevenueSnapshot.estimatedRevenue)}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        Потенциальная недополученная выручка за выбранный период.
                      </p>

                      <div className="mt-3 rounded-2xl border border-rose-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-rose-700">Ключевая причина</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{lostRevenueSnapshot.topReason}</p>
                      </div>

                      <div className="mt-3 space-y-2">
                        {lostRevenueSnapshot.reasons.slice(0, 3).map((item) => (
                          <div key={item.reason} className="rounded-xl border border-rose-200 bg-white p-2.5 text-xs text-slate-700">
                            <p className="font-semibold">{item.reason}</p>
                            <p>{item.count} лидов • {formatRub(item.revenue)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Рекомендуем</p>
                        <p className="mt-1 text-sm text-slate-700">{lostRevenueSnapshot.actions[0]}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Эффективность каналов</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Сравнение по Telegram, WhatsApp, Instagram и сайту</h3>
                    <div className="mt-3 h-64 sm:h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsChannelData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                          <XAxis dataKey="channel" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={chartTooltipStyle} />
                          <Legend iconType="circle" />
                          <Bar dataKey="qualified" name="Квалифицировано" fill={analyticsPalette.qualified} radius={[8, 8, 0, 0]} animationDuration={1050} />
                          <Bar dataKey="booked" name="Доведено до записи" fill={analyticsPalette.booked} radius={[8, 8, 0, 0]} animationDuration={1200} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">AI Insights</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Рекомендации по росту конверсии</h3>
                    <div className="mt-3 space-y-2">
                      {analyticsInsights.map((insight) => (
                        <div key={insight} className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-sm text-slate-700">
                          {insight}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      Последнее обновление аналитики: сегодня, 10:42
                    </div>
                  </div>
                </section>
              </div>
            ) : activeNav === "AI рекомендации" ? (
              <div className="space-y-4">
                {!hasFeature("aiRecommendations") ? (
                  <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Доступ ограничен</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">AI рекомендации доступны на Pro и Business</h2>
                    <p className="mt-2 text-sm text-slate-700">
                      Этот модуль анализирует диалоги, предлагает улучшения скриптов и оценивает влияние на конверсию.
                    </p>
                    <button
                      onClick={() => handleNavChange("Настройки")}
                      className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
                    >
                      Обновить тариф
                    </button>
                  </section>
                ) : (
                  <>
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Активные рекомендации</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{aiRecommendationsFeed.length}</p>
                    <p className="mt-1 text-sm text-slate-600">Критичных: 1, высокого приоритета: 2</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Лиды для recovery</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">12</p>
                    <p className="mt-1 text-sm text-slate-600">Требуют повторного касания сегодня</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Потенциал роста</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">+4.6 п.п.</p>
                    <p className="mt-1 text-sm text-slate-600">Оценка прироста конверсии в запись</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Потенциальный эффект</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">до 84 000 ₽</p>
                    <p className="mt-1 text-sm text-slate-700">Дополнительная выручка в месяц</p>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Главная лента</p>
                        <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Главные рекомендации AI</h3>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {aiRecommendationsFeed.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-900">{item.title}</p>
                              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${recommendationPriorityClass(item.priority)}`}>
                              {item.priority}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-white px-2 py-0.5 text-slate-600">{item.area}</span>
                              <span className="rounded-full bg-cyan-50 px-2 py-0.5 font-semibold text-cyan-700">{item.expectedImpact}</span>
                            </div>
                            <button
                              onClick={() => setAiActionMessage(`Действие применено: ${item.actionLabel}`)}
                              className="w-full rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
                            >
                              {item.actionLabel}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Приоритетные действия</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Что сделать в первую очередь</h3>
                    <div className="mt-3 space-y-2.5">
                      {aiPriorityActions.map((action) => (
                        <div key={action.title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                          <p className="mt-1 text-xs text-slate-600">{action.detail}</p>
                          <button
                            onClick={() => setAiActionMessage(`Запущено: ${action.action}`)}
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 sm:w-auto"
                          >
                            {action.action}
                          </button>
                        </div>
                      ))}
                    </div>
                    {aiActionMessage ? (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                        {aiActionMessage}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Before / After</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Примеры улучшения диалогов</h3>
                    <div className="mt-3 space-y-3">
                      {aiBeforeAfterExamples.map((item) => (
                        <div key={item.context} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{item.context}</p>
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-rose-700">До</p>
                              <p className="mt-1 text-sm text-slate-700">{item.before}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">После</p>
                              <p className="mt-1 text-sm text-slate-700">{item.after}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Рекомендованные ответы</p>
                      <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Готовые формулировки ответов</h3>
                      <div className="mt-3 space-y-2.5">
                        {aiRewrittenReplies.map((reply) => (
                          <div key={reply.scenario} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500">{reply.scenario}</p>
                            <p className="mt-1 text-sm text-slate-700">{reply.reply}</p>
                            <button
                              onClick={() => setAiActionMessage("Сценарий ответа обновлен")}
                              className="mt-2 w-full rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
                            >
                              Применить
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Оценка эффекта</p>
                      <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Оценка эффекта после внедрения</h3>
                      <div className="mt-3 space-y-2">
                        {aiImpactEstimation.map((item) => (
                          <div key={item.metric} className="rounded-xl border border-cyan-200 bg-white p-3">
                            <p className="text-xs font-semibold text-slate-500">{item.metric}</p>
                            <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                              <span className="text-slate-700">{item.current}</span>
                              <span className="font-semibold text-slate-900">{item.projected}</span>
                              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-700">{item.uplift}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
                  </>
                )}
              </div>
            ) : activeNav === "ClientsFlow Sites" ? (
              <div className="space-y-4">
                {!hasFeature("sitesBuilder") ? (
                  <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Доступ ограничен</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">ClientsFlow Sites доступен на Pro и Business</h2>
                    <p className="mt-2 text-sm text-slate-700">
                      Конструктор сайтов с AI-генерацией контента помогает быстро запускать новые источники лидов.
                    </p>
                    <button
                      onClick={() => handleNavChange("Настройки")}
                      className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
                    >
                      Обновить тариф
                    </button>
                  </section>
                ) : (
                  <>
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Продукт экосистемы</p>
                      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">ClientsFlow Sites</h2>
                      <p className="mt-2 max-w-3xl text-sm text-slate-600">
                        Запустите сайт за 5 минут: выберите шаблон, заполните данные бизнеса, получите AI-переписанный контент и опубликуйте.
                        Sites выводит бизнес онлайн, а ClientsFlow берет входящие обращения и доводит до записи.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Фиксированная стоимость</p>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">3 500 ₽</p>
                      <p className="text-xs text-slate-600">за 1 сайт</p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Галерея шаблонов</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Выберите шаблон под ваш бизнес</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {sitesTemplates.map((template) => {
                        const selected = template.id === sitesTemplateId;
                        return (
                          <button
                            key={template.id}
                            onClick={() => setSitesTemplateId(template.id)}
                            className={`rounded-2xl border p-4 text-left transition ${
                              selected ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                            }`}
                          >
                            <div className={`h-24 rounded-xl ${selected ? "bg-white/10" : "bg-gradient-to-br from-cyan-100 to-slate-100"} p-3`}>
                              <div className={`h-2.5 w-20 rounded-full ${selected ? "bg-white/40" : "bg-slate-300"}`} />
                              <div className={`mt-2 h-2 w-28 rounded-full ${selected ? "bg-white/30" : "bg-slate-300/80"}`} />
                              <div className={`mt-4 h-12 rounded-lg ${selected ? "bg-white/20" : "bg-white"} border ${selected ? "border-white/20" : "border-slate-200"}`} />
                            </div>
                            <p className={`mt-3 font-semibold ${selected ? "text-white" : "text-slate-900"}`}>{template.name}</p>
                            <p className={`mt-1 text-sm ${selected ? "text-slate-200" : "text-slate-600"}`}>{template.description}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {template.suitableFor.map((item) => (
                                <span
                                  key={item}
                                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                                    selected ? "bg-white/10 text-white" : "bg-white text-slate-600"
                                  }`}
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                            <p className={`mt-2 text-xs font-semibold ${selected ? "text-cyan-200" : "text-cyan-700"}`}>{template.styleLabel}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Процесс генерации</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Статус генерации</h3>
                    <div className="mt-4 space-y-2">
                      {sitesFlowSteps.map((step, index) => {
                        const done = sitesFlowStatus === "published" || (sitesFlowStatus === "ready" && index <= 2) || (sitesFlowStatus === "generating" && sitesGenerationProgress >= (index + 1) * 25);
                        const active = sitesFlowStatus === "generating" && !done && sitesGenerationProgress >= index * 25;
                        return (
                          <div key={step} className={`rounded-xl border px-3 py-2 text-sm ${done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : active ? "border-cyan-200 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                            {step}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4">
                      <div className="h-2.5 rounded-full bg-slate-100">
                        <div className="h-2.5 rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${sitesGenerationProgress}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        {sitesFlowStatus === "idle" && "Готово к генерации"}
                        {sitesFlowStatus === "generating" && `Генерация... ${sitesGenerationProgress}%`}
                        {sitesFlowStatus === "ready" && "Контент готов к публикации"}
                        {sitesFlowStatus === "published" && "Сайт опубликован"}
                      </p>
                    </div>
                    {sitesActionMessage ? (
                      <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
                        {sitesActionMessage}
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Бриф для генерации</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Ответьте на 10 вопросов</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      На основе этих ответов сервис перепишет тексты сайта под ваш бизнес и выбранный шаблон.
                    </p>
                    <div className="mt-4 grid gap-3">
                      {sitesQuestions.map((question) => (
                        <label key={question.id} className="block rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <span className="block text-sm font-semibold text-slate-900">{question.label}</span>
                          <span className="mt-1 block text-xs text-slate-500">{question.hint}</span>
                          <input
                            value={sitesAnswers[question.id] ?? ""}
                            onChange={(event) => updateSitesAnswer(question.id, event.target.value)}
                            placeholder={question.placeholder}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        onClick={() => {
                          void generateSitesWithAi();
                        }}
                        disabled={sitesFlowStatus === "generating"}
                        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        {sitesFlowStatus === "generating" ? "Генерируем контент..." : "Сгенерировать тексты и сайт"}
                      </button>
                      <button
                        onClick={() => {
                          setSitesAnswers(defaultSitesAnswers);
                          const fallback = buildFallbackSiteContent(selectedSitesTemplate, defaultSitesAnswers);
                          setSitesGeneratedContent(fallback);
                          setSitesFlowStatus("idle");
                          setSitesGenerationProgress(0);
                          setSitesLastGenerationMode(null);
                          setSitesActionMessage("Бриф сброшен к стартовым данным. Можно собрать новый вариант.");
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 sm:w-auto"
                      >
                        Сбросить бриф
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Реальный предпросмотр</p>
                        <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Как будет выглядеть сайт</h3>
                      </div>
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                        {sitesLastGenerationMode === "ai" ? "Сгенерировано по брифу" : sitesLastGenerationMode === "fallback" ? "Шаблонный вариант" : "Черновик"}
                      </span>
                    </div>

                    <div className={`mt-4 overflow-hidden rounded-2xl border border-slate-200 ${selectedSitesTemplate.previewTheme.surface}`}>
                      <div className={`bg-gradient-to-r ${selectedSitesTemplate.previewTheme.gradientFrom} ${selectedSitesTemplate.previewTheme.gradientTo} px-4 py-6`}>
                        <p className="text-xs font-semibold text-slate-700">{selectedSitesTemplate.name} • {selectedSitesTemplate.heroPattern}</p>
                        <h4 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{generatedSitesHeadline}</h4>
                        <p className="mt-2 max-w-xl text-sm text-slate-700">{generatedSitesSubheadline}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button className={`rounded-full ${selectedSitesTemplate.previewTheme.accent} px-4 py-2 text-xs font-semibold text-white`}>
                            {sitesGeneratedContent.primaryCta}
                          </button>
                          <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                            {sitesGeneratedContent.secondaryCta}
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 p-4">
                        <div className="grid gap-2 sm:grid-cols-3">
                          {sitesGeneratedContent.valueProps.map((item) => (
                            <div key={item} className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                              {item}
                            </div>
                          ))}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Услуги</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            {sitesGeneratedContent.services.map((service) => (
                              <div key={service} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-700">
                                {service}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">О компании</p>
                          <p className="mt-1 text-sm text-slate-700">{sitesGeneratedContent.about}</p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Как проходит запись</p>
                          <div className="mt-2 space-y-1.5">
                            {sitesGeneratedContent.processSteps.map((step, index) => (
                              <p key={step} className="text-sm text-slate-700">
                                {index + 1}. {step}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">FAQ</p>
                          <div className="mt-2 space-y-2">
                            {sitesGeneratedContent.faq.map((item) => (
                              <div key={item.q} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                <p className="text-xs font-semibold text-slate-900">{item.q}</p>
                                <p className="mt-1 text-xs text-slate-600">{item.a}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                          <p className="text-sm font-semibold text-slate-900">{sitesGeneratedContent.finalCtaTitle}</p>
                          <p className="mt-1 text-xs text-slate-700">{sitesGeneratedContent.finalCtaText}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        onClick={() => {
                          setSitesFlowStatus("published");
                          setSitesGenerationProgress(100);
                          setSitesActionMessage("Сайт опубликован. Финальная версия будет передана вашим менеджером для выдачи ссылки.");
                        }}
                        disabled={sitesFlowStatus !== "ready" && sitesFlowStatus !== "published"}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        Опубликовать и передать менеджеру
                      </button>
                      <button
                        onClick={() => handleNavChange("Диалоги")}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 sm:w-auto"
                      >
                        Открыть AI Inbox
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Экосистема</p>
                  <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Как Sites работает вместе с ClientsFlow</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-cyan-200 bg-white p-3 text-sm text-slate-700">1. Публикуете сайт за 5 минут</div>
                    <div className="rounded-xl border border-cyan-200 bg-white p-3 text-sm text-slate-700">2. Получаете входящие заявки с формы</div>
                    <div className="rounded-xl border border-cyan-200 bg-white p-3 text-sm text-slate-700">3. ClientsFlow квалифицирует и ведет к записи</div>
                    <div className="rounded-xl border border-cyan-200 bg-white p-3 text-sm text-slate-700">4. Вся аналитика и конверсия в одном дашборде</div>
                  </div>
                </section>
                  </>
                )}
              </div>
            ) : activeNav === "Потерянные" ? (
              <div className="space-y-4">
                {hasFeature("lostRecovery") ? (
                  <>
                    <section className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-100 p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-700">Контроль восстановления</p>
                          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Потерянные лиды и выручка</h2>
                        </div>
                        <div className="flex rounded-full border border-rose-200 bg-white p-0.5">
                          <button
                            onClick={() => setLostRevenuePeriod("7d")}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              lostRevenuePeriod === "7d" ? "bg-rose-600 text-white" : "text-slate-600"
                            }`}
                          >
                            7 дней
                          </button>
                          <button
                            onClick={() => setLostRevenuePeriod("30d")}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              lostRevenuePeriod === "30d" ? "bg-rose-600 text-white" : "text-slate-600"
                            }`}
                          >
                            30 дней
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-slate-700">
                        За последние {lostRevenueSnapshot.periodLabel} потеряно <span className="font-semibold">{lostRevenueSnapshot.lostLeads} лидов</span>
                      </p>
                      <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
                        {formatRub(lostRevenueSnapshot.estimatedRevenue)}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">Потенциальная недополученная выручка.</p>
                    </section>

                    <section className="grid gap-4 xl:grid-cols-3">
                      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Причины потерь</p>
                        <div className="mt-3 space-y-2">
                          {lostRevenueSnapshot.reasons.map((reason) => (
                            <div key={reason.reason} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-slate-900">{reason.reason}</p>
                                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                  {reason.count} лидов
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-600">Оценка потерь: {formatRub(reason.revenue)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Действия восстановления</p>
                        <div className="mt-3 space-y-2">
                          {lostRevenueSnapshot.actions.map((action) => (
                            <div key={action} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="text-sm text-slate-700">{action}</p>
                              <button
                                onClick={() => triggerNotice("Recovery-сценарий запущен.")}
                                className="mt-2 w-full rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-semibold text-white"
                              >
                                Запустить
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </>
                ) : (
                  <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Доступ ограничен</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">Recovery-модуль доступен на Pro и Business</h2>
                    <p className="mt-2 text-sm text-slate-700">
                      Здесь отображаются причины потери лидов, оценка недополученной выручки и автоматические сценарии возврата.
                    </p>
                    <button
                      onClick={() => handleNavChange("Настройки")}
                      className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
                    >
                      Обновить тариф
                    </button>
                  </section>
                )}
              </div>
            ) : activeNav === "Настройки" ? (
              <div className="space-y-4">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Подписка</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Тариф и активация</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Текущий план: <span className="font-semibold text-slate-900">{currentPlanLabel}</span>
                    {subscription.subscriptionStatus === "trial" ? ` • осталось ${trialDaysLeft} дней` : ""}
                  </p>
                </section>

                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {planDefinitions.map((plan) => (
                    <div
                      key={plan.id}
                      className={`rounded-3xl border p-4 shadow-sm ${
                        plan.recommended ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-900">{plan.title}</p>
                      <p className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">{plan.priceLabel}</p>
                      <p className="mt-1 text-sm text-slate-600">{plan.description}</p>
                      <div className="mt-3 space-y-1 text-xs text-slate-700">
                        {plan.features.map((feature) => (
                          <p key={feature}>• {feature}</p>
                        ))}
                      </div>
                      {plan.id === "trial" ? (
                        <button
                          onClick={activateTrial}
                          className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Начать бесплатно
                        </button>
                      ) : (
                        <button
                          onClick={() => openCheckout(plan.id)}
                          className="mt-4 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Выбрать тариф
                        </button>
                      )}
                    </div>
                  ))}
                </section>

                {selectedCheckoutPlan ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Демо-оплата</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                      Оплата тарифа {selectedCheckoutPlan.title} • {selectedCheckoutPlan.priceLabel}
                    </h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label>
                        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Имя держателя</span>
                        <input
                          value={checkoutCardholder}
                          onChange={(e) => setCheckoutCardholder(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Номер карты</span>
                        <input
                          value={checkoutCardNumber}
                          onChange={(e) => setCheckoutCardNumber(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Срок</span>
                        <input
                          value={checkoutExpiry}
                          onChange={(e) => setCheckoutExpiry(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">CVV</span>
                        <input
                          value={checkoutCvv}
                          onChange={(e) => setCheckoutCvv(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={processFakePayment}
                        disabled={checkoutState === "processing"}
                        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                      >
                        {checkoutState === "processing" ? "Оплата..." : "Оплатить"}
                      </button>
                      {checkoutState === "success" ? (
                        <button
                          onClick={() => setOnboardingStep(1)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto"
                        >
                          Запустить онбординг
                        </button>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {(subscription.subscriptionStatus !== "none" || checkoutState === "success") && !subscription.onboardingCompleted ? (
                  <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Онбординг</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Запуск AI-системы ClientsFlow</h3>
                    <p className="mt-1 text-sm text-slate-700">Шаг {onboardingStep} из 3</p>

                    {onboardingStep === 1 ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-800">Выберите тип бизнеса</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {["салон красоты", "барбершоп", "клиника", "локальный сервис", "эксперт / консультант"].map((type) => (
                            <button
                              key={type}
                              onClick={() => setOnboardingBusinessType(type)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                onboardingBusinessType === type ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setOnboardingStep(2)} className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto">
                          Далее
                        </button>
                      </div>
                    ) : null}

                    {onboardingStep === 2 ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-800">Подключаемые каналы</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {["Telegram", "WhatsApp", "Instagram", "Website"].map((channel) => (
                            <button
                              key={channel}
                              onClick={() => setOnboardingChannels((prev) => toggleChoice(prev, channel))}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                onboardingChannels.includes(channel) ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                              }`}
                            >
                              {channel}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => setOnboardingStep(1)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                            Назад
                          </button>
                          <button onClick={() => setOnboardingStep(3)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                            Далее
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {onboardingStep === 3 ? (
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-800">Бизнес-цели</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {["быстрее отвечать", "автоматизировать запись", "видеть аналитику", "возвращать потерянных клиентов", "снизить ручную нагрузку"].map((goal) => (
                            <button
                              key={goal}
                              onClick={() => setOnboardingGoals((prev) => toggleChoice(prev, goal))}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                onboardingGoals.includes(goal) ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
                              }`}
                            >
                              {goal}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => setOnboardingStep(2)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                            Назад
                          </button>
                          <button onClick={finishOnboarding} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                            Завершить запуск
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm text-slate-600">
                    Статус подписки: <span className="font-semibold text-slate-900">{currentPlanLabel}</span>
                  </p>
                </div>

                {subscription.subscriptionStatus !== "none" && !subscription.onboardingCompleted ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-amber-900">
                      Онбординг не завершен. Завершите настройку, чтобы AI-логика начала полноценно обрабатывать обращения.
                    </p>
                    <button
                      onClick={() => handleNavChange("Настройки")}
                      className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
                    >
                      Завершить онбординг
                    </button>
                  </div>
                ) : null}

                {showUpgrade ? (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-cyan-900">
                      Для мультиканальности, продвинутых AI-рекомендаций и расширенной аналитики обновите план до Pro или Business.
                    </p>
                    <button
                      onClick={() => handleNavChange("Настройки")}
                      className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
                    >
                      Обновить тариф
                    </button>
                  </div>
                ) : null}

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {kpis.map((kpi) => (
                    <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{kpi.label}</p>
                      <p className="mt-2 text-3xl font-extrabold text-slate-900">{kpi.value}</p>
                      <p className="mt-2 text-sm text-slate-600">{kpi.note}</p>
                    </div>
                  ))}
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Лиды по дням</p>
                    <svg viewBox="0 0 100 100" className="mt-4 h-48 w-full text-cyan-600" aria-hidden="true">
                      <polyline
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={linePoints}
                      />
                    </svg>
                    <div className="mt-2 hidden grid-cols-12 text-center text-xs text-slate-500 sm:grid">
                      {leadDays.map((d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Воронка лидов</p>
                    <div className="mt-4 space-y-4">
                      {funnel.map((step) => (
                        <div key={step.label}>
                          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                            <span>{step.label}</span>
                            <span className="font-semibold">{step.value}</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100">
                            <div className={`h-2.5 rounded-full ${step.color}`} style={{ width: `${step.width}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Последние диалоги</p>
                      <button
                        onClick={() => handleNavChange("Диалоги")}
                        className="text-xs font-semibold text-cyan-700"
                      >
                        Открыть все
                      </button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {recentConversations.map((c) => (
                        <div key={`${c.client}-${c.time}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-slate-900">{c.client}</p>
                            <span className="text-xs text-slate-500">{c.time}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{c.channel} • {c.status}</p>
                          <p className="mt-2 text-sm text-slate-700">{c.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-rose-100 p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-700">Потерянная выручка</p>
                        <div className="flex rounded-full border border-rose-200 bg-white p-0.5">
                          <button
                            onClick={() => setLostRevenuePeriod("7d")}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              lostRevenuePeriod === "7d" ? "bg-rose-600 text-white" : "text-slate-600"
                            }`}
                          >
                            7 дней
                          </button>
                          <button
                            onClick={() => setLostRevenuePeriod("30d")}
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                              lostRevenuePeriod === "30d" ? "bg-rose-600 text-white" : "text-slate-600"
                            }`}
                          >
                            30 дней
                          </button>
                        </div>
                      </div>

                      <p className="mt-3 text-sm font-semibold text-slate-700">
                        За последние {lostRevenueSnapshot.periodLabel} потеряно {lostRevenueSnapshot.lostLeads} лидов
                      </p>
                      <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
                        {formatRub(lostRevenueSnapshot.estimatedRevenue)}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">Потенциальная недополученная выручка.</p>

                      <div className="mt-3 rounded-2xl border border-rose-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-rose-700">Чаще всего</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{lostRevenueSnapshot.topReason}</p>
                      </div>

                      <div className="mt-3 space-y-2 text-xs text-slate-700">
                        {lostRevenueSnapshot.reasons.slice(0, 3).map((item) => (
                          <div key={item.reason} className="rounded-xl border border-rose-200 bg-white px-3 py-2">
                            <p className="font-semibold">{item.reason}</p>
                            <p>{item.count} лидов • {formatRub(item.revenue)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Рекомендуем</p>
                        <p className="mt-1 text-sm text-slate-700">{lostRevenueSnapshot.actions[1]}</p>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">ClientsFlow Sites</p>
                      <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Сайт за 5 минут + автоворонка лидов</h3>
                      <p className="mt-2 text-sm text-slate-700">
                        Клиент выбирает шаблон, заполняет данные бизнеса, получает AI-переписанный сайт и сразу передает лиды в ClientsFlow.
                      </p>
                      <div className="mt-3 grid gap-2">
                        <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs text-slate-700">1. Шаблон + данные бизнеса</div>
                        <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs text-slate-700">2. AI генерирует контент и структуру</div>
                        <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs text-slate-700">3. Публикация и обработка входящих в AI Inbox</div>
                      </div>
                      <div className="mt-3 flex flex-col items-start justify-between gap-2 text-xs text-slate-700 sm:flex-row sm:items-center">
                        <span>Фиксированная цена: <span className="font-semibold text-slate-900">3 500 ₽</span></span>
                        <button
                          onClick={() => handleNavChange("ClientsFlow Sites")}
                          className="w-full rounded-lg bg-slate-900 px-2.5 py-2 font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
                        >
                          Открыть модуль
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">AI рекомендации</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {aiRecommendations.map((rec) => (
                      <div key={rec.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-semibold text-slate-900">{rec.title}</p>
                        <p className="mt-1 text-xs font-semibold text-cyan-700">{rec.impact}</p>
                        <p className="mt-2 text-sm text-slate-700">{rec.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
            </div>
          </main>

          <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur lg:hidden">
            <div className="grid grid-cols-5 gap-1">
              {mobilePrimaryNav.map((item) => (
                <button
                  key={`bottom-${item}`}
                  onClick={() => handleNavChange(item)}
                  className={`rounded-xl px-1 py-2 text-[11px] font-semibold leading-tight transition ${
                    activeNav === item ? "bg-slate-900 text-white" : "text-slate-700"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
