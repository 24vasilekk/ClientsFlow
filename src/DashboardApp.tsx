import { useEffect, useMemo, useRef, useState } from "react";
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
  | "CFlow Sites"
  | "Настройки";

type DashboardAppProps = {
  standaloneSites?: boolean;
  onNavigate?: (path: "/" | "/login" | "/dashboard" | "/pricing" | "/workbench" | "/sites") => void;
};

type SubscriptionState = {
  planId: "trial" | "basic" | "pro" | "business" | null;
  subscriptionStatus: "none" | "trial" | "active";
  trialStartDate: string | null;
  onboardingCompleted?: boolean;
  onboardingData?: {
    businessType: string;
    channels: string[];
    goals: string[];
    profileSummary?: string;
    businessAnswers?: Array<{ question: string; answer: string }>;
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
    accentColor: string;
    surface: string;
    softSurface: string;
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
  trustStats: Array<{ label: string; value: string }>;
  valueProps: string[];
  services: string[];
  about: string;
  processSteps: string[];
  outcomes: string[];
  showcaseTitle: string;
  showcaseText: string;
  testimonials: Array<{ name: string; role: string; text: string }>;
  packages: Array<{ name: string; price: string; features: string[]; recommended?: boolean }>;
  faq: Array<{ q: string; a: string }>;
  finalCtaTitle: string;
  finalCtaText: string;
  contactLine: string;
};

type SitesProduct = {
  id: string;
  title: string;
  price: string;
  description: string;
  ctaText: string;
  images: string[];
};

type SitesSectionKey =
  | "about"
  | "valueProps"
  | "services"
  | "process"
  | "gallery"
  | "testimonials"
  | "faq"
  | "cabinet"
  | "contacts"
  | "map";

type SitesSectionConfig = {
  key: SitesSectionKey;
  title: string;
  description: string;
};

type ServiceEvent = {
  id: string;
  leadId: string;
  clientName: string;
  channel: Channel;
  direction: "inbound" | "outbound";
  text: string;
  timestamp: string;
  status?: LeadStatus;
  stage?: LeadStage;
  bookingState?: BookingState;
  responseSeconds?: number;
  revenue?: number;
  lostReason?: string;
};

type ServiceConnection = {
  serviceName: string;
  endpoint: string;
  token: string;
  botToken: string;
  autoReplyEnabled: boolean;
  connectedAt: string | null;
};

type TelegramProfile = {
  started: boolean;
  completed: boolean;
  step: number;
  answers: {
    businessType: string;
    mainService: string;
    city: string;
    goal: string;
  };
};

type BusinessBriefAnswer = {
  question: string;
  answer: string;
};

type BusinessBriefState = {
  started: boolean;
  completed: boolean;
  targetCount: number;
  currentQuestion: string;
  answers: BusinessBriefAnswer[];
  updatedAt: string | null;
};

type BusinessTuningState = {
  businessSummary: string;
  targetAudience: string;
  mainServices: string;
  responseStyle: string;
  qualificationRules: string;
  escalationRules: string;
  forbiddenWords: string;
  workingHours: string;
  cityCoverage: string;
  updatedAt: string | null;
};

type SettingsQuestion = {
  id: string;
  question: string;
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
  "Настройки"
];

const mobilePrimaryNav: NavItem[] = ["Обзор", "Диалоги", "Лиды", "Аналитика", "AI рекомендации"];

function BrandWordmark({
  cClass = "text-cyan-500",
  flowClass = "text-slate-900"
}: {
  cClass?: string;
  flowClass?: string;
}) {
  return (
    <span className="inline-flex items-baseline font-extrabold tracking-tight">
      <span className={cClass}>C</span>
      <span className={flowClass}>Flow</span>
    </span>
  );
}

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
      accentColor: "#0891b2",
      surface: "bg-white",
      softSurface: "bg-slate-50"
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
      accentColor: "#0f172a",
      surface: "bg-slate-50",
      softSurface: "bg-white"
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
      accentColor: "#1d4ed8",
      surface: "bg-white",
      softSurface: "bg-slate-50"
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
      accentColor: "#5b21b6",
      surface: "bg-white",
      softSurface: "bg-slate-50"
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

const sitesSectionLibrary: SitesSectionConfig[] = [
  { key: "about", title: "О компании", description: "Краткий блок о бизнесе и позиционировании." },
  { key: "valueProps", title: "Преимущества", description: "Почему клиент выбирает именно вас." },
  { key: "services", title: "Услуги", description: "Ключевые направления и формат работы." },
  { key: "process", title: "Как это работает", description: "Пошаговый путь клиента до записи." },
  { key: "gallery", title: "Галерея", description: "До 5 фотографий бизнеса, команды или кейсов." },
  { key: "testimonials", title: "Отзывы", description: "Социальное доказательство и доверие." },
  { key: "faq", title: "FAQ", description: "Ответы на частые вопросы перед обращением." },
  { key: "cabinet", title: "Личный кабинет", description: "Блок входа клиента в кабинет через Telegram." },
  { key: "contacts", title: "Контакты", description: "Город, каналы связи и кнопки действия." },
  { key: "map", title: "Карта", description: "Блок локации, если важен офлайн-визит." }
];

const defaultSitesSections: Record<SitesSectionKey, boolean> = {
  about: true,
  valueProps: true,
  services: true,
  process: true,
  gallery: true,
  testimonials: true,
  faq: true,
  cabinet: true,
  contacts: true,
  map: false
};

const defaultSitesSectionOrder: SitesSectionKey[] = sitesSectionLibrary.map((item) => item.key);

function buildFallbackSiteContent(
  template: SitesTemplate,
  answers: Record<string, string>
): GeneratedSiteContent {
  return {
    heroTitle: `${answers.businessName} — ${answers.mainOffer.toLowerCase()} with seamless booking`,
    heroSubtitle: `${answers.businessType} in ${answers.city}. Clear offer, fast response, and a smooth path from inquiry to confirmed appointment.`,
    primaryCta: "Book a consultation",
    secondaryCta: "View services",
    trustStats: [
      { label: "Clients per month", value: "500+" },
      { label: "Average rating", value: "4.9/5" },
      { label: "First response time", value: "< 2 min" }
    ],
    valueProps: [
      `Fast reply across ${answers.channels}.`,
      `Transparent pricing range: ${answers.priceRange}.`,
      `Built for ${answers.audience}.`
    ],
    services: [
      `${answers.mainOffer}`,
      "Initial consultation",
      "End-to-end service support"
    ],
    about: `${answers.businessName} is a ${answers.businessType.toLowerCase()} focused on service quality and clear communication. Core strengths: ${answers.advantages}.`,
    processSteps: [
      "Submit your request on the website",
      "Get a fast confirmation and details",
      "Choose a time slot and complete booking"
    ],
    outcomes: [
      "Higher intent inquiries with less manual back-and-forth",
      "Stable bookings even during peak periods",
      "Clear customer journey from inquiry to payment"
    ],
    showcaseTitle: "Lead Operations Workspace",
    showcaseText: "Track source channel, qualification stage, booking status, and next best action in one operational view.",
    testimonials: [
      {
        name: "Elena Smirnova",
        role: "Managing Partner, Local Studio",
        text: "After launch, we reduced low-intent chats and improved booking consistency. Visitors now understand what to do next."
      },
      {
        name: "Andrew Polyakov",
        role: "Owner, Service Company",
        text: "The website feels premium and trustworthy. We now receive more qualified inquiries that are ready to book."
      },
      {
        name: "Maria Kuznetsova",
        role: "Independent Consultant",
        text: "Clear structure and professional copy made it easy to launch quickly without rewriting every block manually."
      }
    ],
    packages: [
      { name: "Start", price: "from 3,500 RUB", features: ["Core pages", "Lead form", "Launch-ready setup"] },
      { name: "Growth", price: "from 7,500 RUB", features: ["Extended sections", "Booking flow blocks", "CRM-ready handoff"], recommended: true },
      { name: "Scale", price: "custom", features: ["Multi-page structure", "Conversion experiments", "Priority support"] }
    ],
    faq: [
      { q: "How quickly do you reply?", a: "Typically within 2 minutes during business hours, with priority follow-up after hours." },
      { q: "Can I get pricing before booking?", a: `Yes. We share a transparent working range: ${answers.priceRange}, plus what impacts final pricing.` },
      { q: "How do I book?", a: "Submit the form or message us in your preferred channel and we will offer available time slots." }
    ],
    finalCtaTitle: `${template.name}: ready to launch in minutes`,
    finalCtaText: `Primary website goal: ${answers.goal}. Connect your form and route all leads into CFlow.`,
    contactLine: `${answers.businessName}, ${answers.city} • Channels: ${answers.channels}`
  };
}

function createDefaultSitesProducts(content: GeneratedSiteContent, galleryUrls: string[]): SitesProduct[] {
  const images = galleryUrls.slice(0, 5);
  return content.services.slice(0, 3).map((service, index) => ({
    id: `product-${index + 1}`,
    title: service,
    price: content.packages[index]?.price || "по запросу",
    description:
      index === 0
        ? "Базовый пакет услуги с быстрым стартом и понятными условиями."
        : index === 1
          ? "Расширенный формат с дополнительными опциями и поддержкой."
          : "Индивидуальный пакет под задачи бизнеса и нужный уровень сервиса.",
    ctaText: "Связаться с менеджером",
    images: images.length ? [images[index % images.length]] : []
  }));
}

const analyticsPalette = {
  incoming: "#0ea5e9",
  booked: "#0f172a",
  qualified: "#38bdf8",
  lost: "#f43f5e",
  donutBooked: "#0f172a",
  donutLost: "#cbd5e1"
};

const SERVICE_CONNECTION_KEY = "clientsflow_service_connection_v1";
const SERVICE_EVENTS_KEY = "clientsflow_service_events_v1";
const TELEGRAM_OFFSET_KEY = "clientsflow_telegram_offset_v1";
const TELEGRAM_PROFILES_KEY = "clientsflow_telegram_profiles_v1";
const BUSINESS_BRIEF_KEY = "clientsflow_business_brief_v1";
const BUSINESS_TUNING_KEY = "clientsflow_business_tuning_v1";
const SITES_BUILDER_PREFS_KEY = "clientsflow_sites_builder_prefs_v1";
const SITES_BUILDER_STYLE_KEY = "clientsflow_sites_builder_style_v1";
const SITES_BUILDER_PAYMENT_KEY = "clientsflow_sites_builder_payment_v1";
const TELEGRAM_ONBOARDING_QUESTIONS = [
  "Чтобы настроить ответы под ваш бизнес, задам 4 коротких вопроса. Первый: в какой нише вы работаете?",
  "Отлично. Какая у вас ключевая услуга или предложение?",
  "В каком городе или регионе вы работаете?",
  "Какая главная цель: больше лидов, больше записей или рост среднего чека?"
];
const TELEGRAM_MAX_AUTO_REPLIES_PER_SYNC = 6;
const SETTINGS_QUESTIONS: SettingsQuestion[] = [
  { id: "q1", question: "Как называется ваш бизнес и чем вы занимаетесь?" },
  { id: "q2", question: "Какая ключевая услуга или продукт приносит основной доход?" },
  { id: "q3", question: "Кто ваш основной клиент?" },
  { id: "q4", question: "Через какие каналы чаще всего приходят обращения?" },
  { id: "q5", question: "Какие вопросы клиенты задают чаще всего в первом сообщении?" },
  { id: "q6", question: "Какие возражения по цене или условиям встречаются чаще всего?" },
  { id: "q7", question: "Что обязательно нужно уточнить перед записью или продажей?" },
  { id: "q8", question: "В каких случаях диалог нужно передавать менеджеру?" },
  { id: "q9", question: "Какой стиль ответа вы хотите: формальный, дружелюбный, экспертный?" },
  { id: "q10", question: "Какая главная цель на ближайший месяц: лиды, запись, конверсия, средний чек?" }
];
const BUSINESS_BRIEF_MIN_QUESTIONS = 10;
const BUSINESS_BRIEF_FALLBACK_QUESTIONS = [
  "Какую услугу вы продаете чаще всего и в каком среднем чеке?",
  "Кто ваш основной клиент: возраст, потребность и сценарий обращения?",
  "Через какие каналы приходят обращения в первую очередь?",
  "Какой ответ клиент должен получить в первые 30 секунд?",
  "Какие вопросы о цене или условиях задают чаще всего?",
  "Как вы определяете, что лид готов к записи или покупке?",
  "Какие возражения чаще всего мешают довести до сделки?",
  "Что обязательно нужно уточнить до передачи в запись?",
  "Через сколько минут после тишины отправлять повторное касание?",
  "Какая цель на ближайший месяц: больше лидов, выше конверсия или выше средний чек?",
  "Какие услуги или категории приоритетны для продвижения сейчас?",
  "В каких случаях диалог нужно сразу передавать менеджеру?"
];

function loadSitesSections(): Record<SitesSectionKey, boolean> {
  if (typeof window === "undefined") return defaultSitesSections;
  try {
    const raw = localStorage.getItem(SITES_BUILDER_PREFS_KEY);
    if (!raw) return defaultSitesSections;
    const parsed = JSON.parse(raw) as { sections?: Partial<Record<SitesSectionKey, boolean>> };
    const next: Record<SitesSectionKey, boolean> = { ...defaultSitesSections };
    for (const key of defaultSitesSectionOrder) {
      const value = parsed.sections?.[key];
      if (typeof value === "boolean") next[key] = value;
    }
    return next;
  } catch {
    return defaultSitesSections;
  }
}

function loadSitesSectionOrder(): SitesSectionKey[] {
  if (typeof window === "undefined") return defaultSitesSectionOrder;
  try {
    const raw = localStorage.getItem(SITES_BUILDER_PREFS_KEY);
    if (!raw) return defaultSitesSectionOrder;
    const parsed = JSON.parse(raw) as { order?: unknown };
    if (!Array.isArray(parsed.order)) return defaultSitesSectionOrder;
    const normalized = parsed.order.filter((item): item is SitesSectionKey => defaultSitesSectionOrder.includes(item as SitesSectionKey));
    const unique = Array.from(new Set(normalized));
    const missing = defaultSitesSectionOrder.filter((key) => !unique.includes(key));
    return [...unique, ...missing];
  } catch {
    return defaultSitesSectionOrder;
  }
}

function saveSitesBuilderPrefs(sections: Record<SitesSectionKey, boolean>, order: SitesSectionKey[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SITES_BUILDER_PREFS_KEY,
    JSON.stringify({
      sections,
      order
    })
  );
}

function loadSitesBuilderStyle(): {
  accentColor: string;
  baseColor: string;
  cabinetEnabled: boolean;
  telegramBot: string;
} {
  if (typeof window === "undefined") {
    return {
      accentColor: "#0f172a",
      baseColor: "#f8fafc",
      cabinetEnabled: true,
      telegramBot: "@clientsflow_support_bot"
    };
  }
  try {
    const raw = localStorage.getItem(SITES_BUILDER_STYLE_KEY);
    if (!raw) {
      return {
        accentColor: "#0f172a",
        baseColor: "#f8fafc",
        cabinetEnabled: true,
        telegramBot: "@clientsflow_support_bot"
      };
    }
    const parsed = JSON.parse(raw) as Partial<{
      accentColor: string;
      baseColor: string;
      cabinetEnabled: boolean;
      telegramBot: string;
    }>;
    const isHex = (value: string | undefined) => Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
    return {
      accentColor: isHex(parsed.accentColor) ? (parsed.accentColor as string) : "#0f172a",
      baseColor: isHex(parsed.baseColor) ? (parsed.baseColor as string) : "#f8fafc",
      cabinetEnabled: typeof parsed.cabinetEnabled === "boolean" ? parsed.cabinetEnabled : true,
      telegramBot: typeof parsed.telegramBot === "string" && parsed.telegramBot.trim() ? parsed.telegramBot.trim() : "@clientsflow_support_bot"
    };
  } catch {
    return {
      accentColor: "#0f172a",
      baseColor: "#f8fafc",
      cabinetEnabled: true,
      telegramBot: "@clientsflow_support_bot"
    };
  }
}

function saveSitesBuilderStyle(style: {
  accentColor: string;
  baseColor: string;
  cabinetEnabled: boolean;
  telegramBot: string;
}): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SITES_BUILDER_STYLE_KEY, JSON.stringify(style));
}

function loadSitesBuilderPayment(): { paid: boolean; paidAt: string | null } {
  if (typeof window === "undefined") return { paid: false, paidAt: null };
  try {
    const raw = localStorage.getItem(SITES_BUILDER_PAYMENT_KEY);
    if (!raw) return { paid: false, paidAt: null };
    const parsed = JSON.parse(raw) as Partial<{ paid: boolean; paidAt: string | null }>;
    return {
      paid: parsed.paid === true,
      paidAt: typeof parsed.paidAt === "string" ? parsed.paidAt : null
    };
  } catch {
    return { paid: false, paidAt: null };
  }
}

function saveSitesBuilderPayment(state: { paid: boolean; paidAt: string | null }): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SITES_BUILDER_PAYMENT_KEY, JSON.stringify(state));
}

function loadServiceConnection(): ServiceConnection {
  if (typeof window === "undefined") {
    return { serviceName: "", endpoint: "", token: "", botToken: "", autoReplyEnabled: true, connectedAt: null };
  }
  try {
    const raw = localStorage.getItem(SERVICE_CONNECTION_KEY);
    if (!raw) return { serviceName: "", endpoint: "", token: "", botToken: "", autoReplyEnabled: true, connectedAt: null };
    const parsed = JSON.parse(raw) as Partial<ServiceConnection>;
    return {
      serviceName: parsed.serviceName ?? "",
      endpoint: parsed.endpoint ?? "",
      token: parsed.token ?? "",
      botToken: parsed.botToken ?? "",
      autoReplyEnabled: parsed.autoReplyEnabled ?? true,
      connectedAt: parsed.connectedAt ?? null
    };
  } catch {
    return { serviceName: "", endpoint: "", token: "", botToken: "", autoReplyEnabled: true, connectedAt: null };
  }
}

function saveServiceConnection(connection: ServiceConnection): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SERVICE_CONNECTION_KEY, JSON.stringify(connection));
}

function loadServiceEvents(): ServiceEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SERVICE_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ServiceEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveServiceEvents(events: ServiceEvent[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SERVICE_EVENTS_KEY, JSON.stringify(events));
}

function loadTelegramOffset(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(TELEGRAM_OFFSET_KEY);
  const parsed = Number(raw ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function saveTelegramOffset(offset: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TELEGRAM_OFFSET_KEY, String(offset));
}

function loadTelegramProfiles(): Record<string, TelegramProfile> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TELEGRAM_PROFILES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, TelegramProfile>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveTelegramProfiles(profiles: Record<string, TelegramProfile>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TELEGRAM_PROFILES_KEY, JSON.stringify(profiles));
}

function loadBusinessBrief(): BusinessBriefState {
  if (typeof window === "undefined") {
    return { started: false, completed: false, targetCount: BUSINESS_BRIEF_MIN_QUESTIONS, currentQuestion: "", answers: [], updatedAt: null };
  }
  try {
    const raw = localStorage.getItem(BUSINESS_BRIEF_KEY);
    if (!raw) {
      return { started: false, completed: false, targetCount: BUSINESS_BRIEF_MIN_QUESTIONS, currentQuestion: "", answers: [], updatedAt: null };
    }
    const parsed = JSON.parse(raw) as Partial<BusinessBriefState>;
    const answers = Array.isArray(parsed.answers)
      ? parsed.answers
          .filter((item) => item && typeof item.question === "string" && typeof item.answer === "string")
          .map((item) => ({ question: item.question, answer: item.answer }))
      : [];
    const targetCount =
      typeof parsed.targetCount === "number" && parsed.targetCount >= BUSINESS_BRIEF_MIN_QUESTIONS
        ? Math.round(parsed.targetCount)
        : BUSINESS_BRIEF_MIN_QUESTIONS;
    return {
      started: parsed.started ?? answers.length > 0,
      completed: parsed.completed ?? answers.length >= targetCount,
      targetCount,
      currentQuestion: typeof parsed.currentQuestion === "string" ? parsed.currentQuestion : "",
      answers,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null
    };
  } catch {
    return { started: false, completed: false, targetCount: BUSINESS_BRIEF_MIN_QUESTIONS, currentQuestion: "", answers: [], updatedAt: null };
  }
}

function saveBusinessBrief(brief: BusinessBriefState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUSINESS_BRIEF_KEY, JSON.stringify(brief));
}

function loadBusinessTuning(): BusinessTuningState {
  const defaults: BusinessTuningState = {
    businessSummary: "",
    targetAudience: "",
    mainServices: "",
    responseStyle: "вежливо, коротко, по делу",
    qualificationRules: "",
    escalationRules: "",
    forbiddenWords: "AI, ИИ, бот, нейросеть",
    workingHours: "",
    cityCoverage: "",
    updatedAt: null
  };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(BUSINESS_TUNING_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<BusinessTuningState>;
    return {
      businessSummary: parsed.businessSummary ?? defaults.businessSummary,
      targetAudience: parsed.targetAudience ?? defaults.targetAudience,
      mainServices: parsed.mainServices ?? defaults.mainServices,
      responseStyle: parsed.responseStyle ?? defaults.responseStyle,
      qualificationRules: parsed.qualificationRules ?? defaults.qualificationRules,
      escalationRules: parsed.escalationRules ?? defaults.escalationRules,
      forbiddenWords: parsed.forbiddenWords ?? defaults.forbiddenWords,
      workingHours: parsed.workingHours ?? defaults.workingHours,
      cityCoverage: parsed.cityCoverage ?? defaults.cityCoverage,
      updatedAt: parsed.updatedAt ?? defaults.updatedAt
    };
  } catch {
    return defaults;
  }
}

function saveBusinessTuning(tuning: BusinessTuningState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUSINESS_TUNING_KEY, JSON.stringify(tuning));
}

function parseServiceEvents(raw: unknown): ServiceEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      const e = item as Partial<ServiceEvent>;
      const channel = e.channel;
      const validChannel = channel === "Telegram" || channel === "WhatsApp" || channel === "Instagram" || channel === "Website";
      if (!e.leadId || !e.clientName || !validChannel || !e.direction || !e.text || !e.timestamp) return null;
      return {
        id: e.id || `EV-${index}-${Math.random().toString(36).slice(2, 8)}`,
        leadId: String(e.leadId),
        clientName: String(e.clientName),
        channel,
        direction: e.direction === "outbound" ? "outbound" : "inbound",
        text: String(e.text),
        timestamp: String(e.timestamp),
        status: e.status,
        stage: e.stage,
        bookingState: e.bookingState,
        responseSeconds: typeof e.responseSeconds === "number" ? e.responseSeconds : undefined,
        revenue: typeof e.revenue === "number" ? e.revenue : undefined,
        lostReason: typeof e.lostReason === "string" ? e.lostReason : undefined
      } as ServiceEvent;
    })
    .filter((event): event is ServiceEvent => Boolean(event));
}

function formatLastActivity(timestamp: string): { label: string; minutes: number } {
  const ms = new Date(timestamp).getTime();
  const diffMin = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (diffMin < 1) return { label: "только что", minutes: 0 };
  if (diffMin < 60) return { label: `${diffMin} мин назад`, minutes: diffMin };
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  if (hours < 24) return { label: minutes > 0 ? `${hours} ч ${minutes} мин назад` : `${hours} ч назад`, minutes: diffMin };
  const days = Math.floor(hours / 24);
  return { label: `${days} дн назад`, minutes: diffMin };
}

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

function hexToRgba(hex: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(15,23,42,${safeAlpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
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

export default function App({ standaloneSites = false, onNavigate }: DashboardAppProps) {
  const initialSitesStyle = useMemo(() => loadSitesBuilderStyle(), []);
  const serviceImportRef = useRef<HTMLInputElement | null>(null);
  const [activeNav, setActiveNav] = useState<NavItem>(standaloneSites ? "CFlow Sites" : "Обзор");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "все">("все");
  const [channelFilter, setChannelFilter] = useState<Channel | "все">("все");
  const [selectedConversationId, setSelectedConversationId] = useState<string>("");
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
  const [sitesProducts, setSitesProducts] = useState<SitesProduct[]>(() =>
    createDefaultSitesProducts(buildFallbackSiteContent(sitesTemplates[0], defaultSitesAnswers), [])
  );
  const [sitesFlowStatus, setSitesFlowStatus] = useState<"idle" | "generating" | "ready" | "published">("idle");
  const [sitesGenerationProgress, setSitesGenerationProgress] = useState(0);
  const [sitesActionMessage, setSitesActionMessage] = useState<string | null>(null);
  const [sitesPublishedUrl, setSitesPublishedUrl] = useState<string>("");
  const [sitesPublishing, setSitesPublishing] = useState(false);
  const [sitesPayment, setSitesPayment] = useState<{ paid: boolean; paidAt: string | null }>(() => loadSitesBuilderPayment());
  const [sitesPaymentModalOpen, setSitesPaymentModalOpen] = useState(false);
  const [sitesPaymentState, setSitesPaymentState] = useState<"idle" | "processing" | "success">("idle");
  const [sitesPaymentName, setSitesPaymentName] = useState("Иван Петров");
  const [sitesPaymentCard, setSitesPaymentCard] = useState("4242 4242 4242 4242");
  const [sitesPaymentExpiry, setSitesPaymentExpiry] = useState("12/29");
  const [sitesPaymentCvv, setSitesPaymentCvv] = useState("123");
  const [sitesLastGenerationMode, setSitesLastGenerationMode] = useState<"ai" | "fallback" | null>(null);
  const [sitesLogoUrl, setSitesLogoUrl] = useState<string>("");
  const [sitesGalleryUrls, setSitesGalleryUrls] = useState<string[]>([]);
  const [sitesSections, setSitesSections] = useState<Record<SitesSectionKey, boolean>>(() => loadSitesSections());
  const [sitesSectionOrder, setSitesSectionOrder] = useState<SitesSectionKey[]>(() => loadSitesSectionOrder());
  const [draggedSitesSection, setDraggedSitesSection] = useState<SitesSectionKey | null>(null);
  const [sitesAccentColor, setSitesAccentColor] = useState<string>(initialSitesStyle.accentColor);
  const [sitesBaseColor, setSitesBaseColor] = useState<string>(initialSitesStyle.baseColor);
  const [sitesCabinetEnabled, setSitesCabinetEnabled] = useState<boolean>(initialSitesStyle.cabinetEnabled);
  const [sitesTelegramBot, setSitesTelegramBot] = useState<string>(initialSitesStyle.telegramBot);
  const [sitesPreviewTab, setSitesPreviewTab] = useState<"home" | "services" | "reviews" | "cabinet">("home");
  const [sitesFaqOpen, setSitesFaqOpen] = useState<string | null>(null);
  const [sitesOpenedProductId, setSitesOpenedProductId] = useState<string | null>(null);
  const [draggedSitesProductId, setDraggedSitesProductId] = useState<string | null>(null);
  const [sitesProductUploadIndex, setSitesProductUploadIndex] = useState<number | null>(null);
  const sitesLogoInputRef = useRef<HTMLInputElement | null>(null);
  const sitesGalleryInputRef = useRef<HTMLInputElement | null>(null);
  const sitesProductImageInputRef = useRef<HTMLInputElement | null>(null);
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
  const [serviceConnection, setServiceConnection] = useState<ServiceConnection>(() => loadServiceConnection());
  const [serviceEvents, setServiceEvents] = useState<ServiceEvent[]>(() => loadServiceEvents());
  const [serviceSyncLoading, setServiceSyncLoading] = useState(false);
  const [telegramOffset, setTelegramOffset] = useState<number>(() => loadTelegramOffset());
  const [telegramProfiles, setTelegramProfiles] = useState<Record<string, TelegramProfile>>(() => loadTelegramProfiles());
  const [businessBrief, setBusinessBrief] = useState<BusinessBriefState>(() => loadBusinessBrief());
  const [businessBriefAnswer, setBusinessBriefAnswer] = useState("");
  const [businessBriefLoading, setBusinessBriefLoading] = useState(false);
  const [businessTuning, setBusinessTuning] = useState<BusinessTuningState>(() => loadBusinessTuning());
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [settingsSetupStep, setSettingsSetupStep] = useState<1 | 2 | 3 | 4>(1);
  const [settingsChannels, setSettingsChannels] = useState<string[]>(["Telegram"]);
  const [settingsQuestionIndex, setSettingsQuestionIndex] = useState(0);
  const [settingsBusinessAnswers, setSettingsBusinessAnswers] = useState<Record<string, string>>(
    () => SETTINGS_QUESTIONS.reduce<Record<string, string>>((acc, item) => ({ ...acc, [item.id]: "" }), {})
  );
  const [settingsSummary, setSettingsSummary] = useState("");
  const [settingsSummaryLoading, setSettingsSummaryLoading] = useState(false);

  const hasLiveData = serviceEvents.length > 0;

  const liveConversations = useMemo<InboxConversation[]>(() => {
    const grouped = serviceEvents.reduce<Record<string, ServiceEvent[]>>((acc, event) => {
      if (!acc[event.leadId]) acc[event.leadId] = [];
      acc[event.leadId].push(event);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([leadId, events]) => {
        const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const last = sorted[sorted.length - 1];
        const lastActivity = formatLastActivity(last.timestamp);
        const status: LeadStatus = last.status ?? "новый";
        const scoreMap: Record<LeadStatus, number> = {
          новый: 45,
          квалифицирован: 74,
          "ожидает записи": 67,
          записан: 95,
          потерян: 28,
          эскалация: 82
        };
        const probabilityMap: Record<LeadStatus, number> = {
          новый: 34,
          квалифицирован: 68,
          "ожидает записи": 62,
          записан: 96,
          потерян: 14,
          эскалация: 71
        };
        const timeline: TimelineMessage[] = sorted.map((event) => ({
          role: event.direction === "inbound" ? "client" : event.status === "эскалация" ? "manager" : "ai",
          text: event.text,
          time: new Date(event.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
        }));
        const suggestedAction =
          status === "новый"
            ? "Уточнить задачу и предложить следующий шаг."
            : status === "квалифицирован"
              ? "Перевести в запись с выбором времени."
              : status === "ожидает записи"
                ? "Подтвердить слот и закрыть запись."
                : status === "потерян"
                  ? "Запустить recovery-касание."
                  : status === "эскалация"
                    ? "Передать кейс менеджеру."
                    : "Подготовить post-visit follow-up.";
        return {
          id: leadId,
          client: last.clientName,
          channel: last.channel,
          status,
          summary: last.text.slice(0, 180),
          score: scoreMap[status],
          purchaseProbability: probabilityMap[status],
          suggestedAction,
          lastActivity: lastActivity.label,
          intent: sorted.find((item) => item.direction === "inbound")?.text.slice(0, 100) || "Входящее обращение",
          extractedFields: [
            { label: "Lead ID", value: leadId },
            { label: "Канал", value: last.channel },
            { label: "Сообщений", value: String(sorted.length) }
          ],
          notes: last.lostReason ? `Причина потери: ${last.lostReason}` : "Данные получены из подключенного сервиса.",
          timeline
        };
      })
      .sort((a, b) => {
        const aMin = formatLastActivity(serviceEvents.find((event) => event.leadId === a.id)?.timestamp || new Date().toISOString()).minutes;
        const bMin = formatLastActivity(serviceEvents.find((event) => event.leadId === b.id)?.timestamp || new Date().toISOString()).minutes;
        return aMin - bMin;
      });
  }, [serviceEvents]);

  const liveLeadRecords = useMemo<LeadRecord[]>(() => {
    return liveConversations.map((conv) => {
      const related = serviceEvents.filter((event) => event.leadId === conv.id);
      const latest = related[related.length - 1];
      const stage: LeadStage =
        latest?.stage ??
        (conv.status === "эскалация"
          ? "передан менеджеру"
          : conv.status === "квалифицирован"
            ? "квалифицирован"
            : conv.status === "ожидает записи"
              ? "ожидает записи"
              : conv.status === "записан"
                ? "записан"
                : conv.status === "потерян"
                  ? "потерян"
                  : "новый");
      const activity = formatLastActivity(latest?.timestamp || new Date().toISOString());
      const estimatedRevenue = Math.round(
        related.reduce((sum, event) => sum + (event.revenue ?? 0), 0) || (conv.status === "записан" ? 5000 : conv.status === "квалифицирован" ? 3500 : 0)
      );
      const bookingState: BookingState =
        latest?.bookingState ??
        (stage === "записан" ? "подтверждена" : stage === "потерян" ? "отменена" : stage === "ожидает записи" ? "в процессе" : "не начата");
      return {
        id: conv.id,
        name: conv.client,
        business: serviceConnection.serviceName || "Подключенный сервис",
        stage,
        channel: conv.channel,
        score: conv.score,
        estimatedRevenue,
        lastActivityLabel: activity.label,
        lastActivityMinutes: activity.minutes,
        bookingState,
        tags: [`${conv.channel}`, `${conv.status}`],
        owner: conv.status === "эскалация" ? "Менеджер" : "AI"
      };
    });
  }, [liveConversations, serviceEvents, serviceConnection.serviceName]);

  const incomingLeads = liveLeadRecords.length;
  const qualifiedLeads = liveLeadRecords.filter((lead) => lead.stage === "квалифицирован" || lead.stage === "ожидает записи" || lead.stage === "записан" || lead.stage === "передан менеджеру").length;
  const bookedLeads = liveLeadRecords.filter((lead) => lead.stage === "записан").length;
  const lostLeads = liveLeadRecords.filter((lead) => lead.stage === "потерян").length;
  const responseSamples = serviceEvents.map((event) => event.responseSeconds).filter((value): value is number => typeof value === "number" && value > 0);
  const averageResponse = responseSamples.length > 0 ? Math.round(responseSamples.reduce((sum, value) => sum + value, 0) / responseSamples.length) : 0;
  const worstResponse = responseSamples.length > 0 ? Math.max(...responseSamples) : 0;
  const conversionPercent = incomingLeads > 0 ? Number(((bookedLeads / incomingLeads) * 100).toFixed(1)) : 0;

  const kpis = useMemo(
    () => [
      { label: "Входящие лиды", value: `${incomingLeads}`, note: hasLiveData ? "Данные из подключенного сервиса" : "Подключите сервис, чтобы увидеть статистику" },
      { label: "Квалифицировано", value: `${qualifiedLeads}`, note: incomingLeads > 0 ? `${Math.round((qualifiedLeads / incomingLeads) * 100)}% от входящих` : "—" },
      { label: "Записано", value: `${bookedLeads}`, note: incomingLeads > 0 ? `Конверсия в запись ${conversionPercent}%` : "—" },
      { label: "Потеряно", value: `${lostLeads}`, note: incomingLeads > 0 ? `${Math.round((lostLeads / incomingLeads) * 100)}% от входящих` : "—" },
      { label: "Среднее время ответа", value: averageResponse > 0 ? `${averageResponse} сек` : "—", note: averageResponse > 0 ? `Худшее значение ${worstResponse} сек` : "Нет данных responseSeconds" },
      { label: "Конверсия", value: incomingLeads > 0 ? `${conversionPercent}%` : "—", note: hasLiveData ? "Считается по вашим событиям" : "Добавьте события, чтобы рассчитать конверсию" }
    ],
    [incomingLeads, qualifiedLeads, bookedLeads, lostLeads, averageResponse, worstResponse, conversionPercent, hasLiveData]
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

  const conversionTotal = bookedLeads + lostLeads;
  const conversionBookedPercent = conversionTotal > 0 ? Math.round((bookedLeads / conversionTotal) * 100) : 0;
  const conversionLostPercent = conversionTotal > 0 ? Math.round((lostLeads / conversionTotal) * 100) : 0;

  const analyticsKpisLive = [
    { label: "Всего входящих", value: `${incomingLeads}`, note: "По подключенному сервису" },
    { label: "Квалифицировано", value: `${qualifiedLeads}`, note: incomingLeads > 0 ? `${Math.round((qualifiedLeads / incomingLeads) * 100)}% от входящих` : "—" },
    { label: "Записано", value: `${bookedLeads}`, note: qualifiedLeads > 0 ? `${Math.round((bookedLeads / qualifiedLeads) * 100)}% от квалифицированных` : "—" },
    { label: "Потеряно", value: `${lostLeads}`, note: incomingLeads > 0 ? `${Math.round((lostLeads / incomingLeads) * 100)}% от входящих` : "—" },
    { label: "Среднее время ответа", value: averageResponse > 0 ? `${averageResponse} сек` : "—", note: averageResponse > 0 ? `Худшее ${worstResponse} сек` : "Нет данных" },
    { label: "Общая конверсия", value: incomingLeads > 0 ? `${conversionPercent}%` : "—", note: "В запись от всех входящих" }
  ];

  const analyticsTrendDataLive = useMemo(() => {
    const days = Array.from({ length: 10 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (9 - index));
      const key = date.toISOString().slice(0, 10);
      const label = date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
      const dayEvents = serviceEvents.filter((event) => event.timestamp.slice(0, 10) === key);
      const incoming = dayEvents.filter((event) => event.direction === "inbound").length;
      const booked = dayEvents.filter((event) => event.status === "записан" || event.stage === "записан").length;
      return { day: label, incoming, booked };
    });
    return days;
  }, [serviceEvents]);

  const analyticsFunnelDataLive = [
    { stage: "Входящие", value: incomingLeads },
    { stage: "Ответ получен", value: liveLeadRecords.filter((lead) => serviceEvents.some((event) => event.leadId === lead.id && event.direction === "outbound")).length },
    { stage: "Квалифицировано", value: qualifiedLeads },
    { stage: "Доведено до записи", value: bookedLeads },
    { stage: "Потеряно", value: lostLeads }
  ];

  const analyticsConversionDataLive = [
    { name: "Записано", value: bookedLeads },
    { name: "Потеряно", value: lostLeads }
  ];

  const analyticsChannelDataLive = useMemo(() => {
    const channels: Channel[] = ["Telegram", "WhatsApp", "Instagram", "Website"];
    return channels.map((channel) => {
      const channelLeads = liveLeadRecords.filter((lead) => lead.channel === channel);
      const incoming = channelLeads.length;
      const qualified = channelLeads.filter((lead) => lead.stage === "квалифицирован" || lead.stage === "ожидает записи" || lead.stage === "записан" || lead.stage === "передан менеджеру").length;
      const booked = channelLeads.filter((lead) => lead.stage === "записан").length;
      const conversion = incoming > 0 ? Number(((booked / incoming) * 100).toFixed(1)) : 0;
      return { channel, incoming, qualified, booked, conversion };
    });
  }, [liveLeadRecords]);

  const analyticsResponseTrendLive = useMemo(() => {
    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    return days.map((dayLabel, index) => {
      const values = serviceEvents
        .filter((event) => {
          if (typeof event.responseSeconds !== "number") return false;
          const jsDay = new Date(event.timestamp).getDay(); // 0..6 Sun..Sat
          const mapped = jsDay === 0 ? 6 : jsDay - 1;
          return mapped === index;
        })
        .map((event) => event.responseSeconds as number);
      const avg = values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
      return { period: dayLabel, seconds: avg };
    });
  }, [serviceEvents]);

  const analyticsInsightsLive = [
    incomingLeads > 0
      ? `В системе ${incomingLeads} активных лидов. Основной фокус: ускорить этап квалификации.`
      : "Нет данных по лидам. Подключите сервис и загрузите события.",
    lostLeads > 0
      ? `Потеряно ${lostLeads} лидов. Запустите сценарий recovery для возврата части потока.`
      : "Потерянные лиды пока не обнаружены в подключенных событиях.",
    averageResponse > 0
      ? `Среднее время ответа ${averageResponse} сек. Цель: удерживать ниже 60 секунд.`
      : "Добавьте поле responseSeconds в событиях для расчёта SLA.",
    `Наиболее конверсионный канал: ${
      analyticsChannelDataLive.sort((a, b) => b.conversion - a.conversion)[0]?.channel || "—"
    }.`
  ];

  const lostRevenueByPeriodLive: Record<"7d" | "30d", LostRevenueSnapshot> = {
    "7d": (() => {
      const from = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const rangeEvents = serviceEvents.filter((event) => new Date(event.timestamp).getTime() >= from);
      const lost = rangeEvents.filter((event) => event.status === "потерян" || event.stage === "потерян");
      const lostLeadsCount = new Set(lost.map((item) => item.leadId)).size;
      const estimated = lost.reduce((sum, item) => sum + (item.revenue ?? 0), 0);
      return {
        periodLabel: "7 дней",
        lostLeads: lostLeadsCount,
        estimatedRevenue: estimated,
        topReason: lost[0]?.lostReason || "Основные потери фиксируются после первичного диалога.",
        reasons: [
          { reason: "После вопроса о стоимости", count: Math.round(lostLeadsCount * 0.45), revenue: Math.round(estimated * 0.45) },
          { reason: "Нет follow-up", count: Math.round(lostLeadsCount * 0.3), revenue: Math.round(estimated * 0.3) },
          { reason: "Долгий ответ", count: Math.max(0, lostLeadsCount - Math.round(lostLeadsCount * 0.75)), revenue: Math.round(estimated * 0.25) }
        ],
        actions: [
          "Сократить задержку первого ответа и зафиксировать SLA.",
          "Запустить повторное касание для лидов без ответа.",
          "Переписать сценарий ответа на цену и сразу предлагать слот."
        ]
      };
    })(),
    "30d": (() => {
      const from = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const rangeEvents = serviceEvents.filter((event) => new Date(event.timestamp).getTime() >= from);
      const lost = rangeEvents.filter((event) => event.status === "потерян" || event.stage === "потерян");
      const lostLeadsCount = new Set(lost.map((item) => item.leadId)).size;
      const estimated = lost.reduce((sum, item) => sum + (item.revenue ?? 0), 0);
      return {
        periodLabel: "30 дней",
        lostLeads: lostLeadsCount,
        estimatedRevenue: estimated,
        topReason: lost[0]?.lostReason || "Ключевая зона потерь: лиды без повторного контакта.",
        reasons: [
          { reason: "После вопроса о стоимости", count: Math.round(lostLeadsCount * 0.42), revenue: Math.round(estimated * 0.42) },
          { reason: "Нет follow-up", count: Math.round(lostLeadsCount * 0.33), revenue: Math.round(estimated * 0.33) },
          { reason: "Долгий ответ", count: Math.max(0, lostLeadsCount - Math.round(lostLeadsCount * 0.75)), revenue: Math.round(estimated * 0.25) }
        ],
        actions: [
          "Пересобрать сценарии первичного ответа для быстрых квалификаций.",
          "Автоматизировать recovery-цепочку для тихих лидов.",
          "Внедрить ежедневный контроль потерь по каналам."
        ]
      };
    })()
  };

  const lostRevenueSnapshot = lostRevenueByPeriodLive[lostRevenuePeriod];
  const selectedSitesTemplate = sitesTemplates.find((item) => item.id === sitesTemplateId) ?? sitesTemplates[0];
  const enabledSitesSectionsCount = Object.values(sitesSections).filter(Boolean).length;
  const orderedSitesSectionLibrary = sitesSectionOrder
    .map((key) => sitesSectionLibrary.find((item) => item.key === key))
    .filter((item): item is SitesSectionConfig => Boolean(item));
  const sitesAccentPreview = sitesAccentColor || selectedSitesTemplate.previewTheme.accentColor;
  const sitesHeroBackground = hexToRgba(sitesBaseColor, 0.9);
  const sitesSoftBackground = hexToRgba(sitesAccentPreview, 0.08);
  const sitesAccentBorder = hexToRgba(sitesAccentPreview, 0.28);
  const generatedSitesHeadline = sitesGeneratedContent.heroTitle;
  const generatedSitesSubheadline = sitesGeneratedContent.heroSubtitle;
  const chartTooltipStyle = {
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    boxShadow: "0 14px 30px rgba(2, 6, 23, 0.1)"
  };

  const overviewLeadSeries = analyticsTrendDataLive.map((item) => item.incoming);
  const linePoints = useMemo(
    () => buildLinePoints(overviewLeadSeries.length >= 2 ? overviewLeadSeries : [0, 0]),
    [overviewLeadSeries]
  );
  const overviewLeadDays = analyticsTrendDataLive.map((item) => item.day);
  const overviewFunnel = [
    { label: "Входящие обращения", value: incomingLeads, width: 100, color: "bg-cyan-500" },
    {
      label: "Квалифицировано",
      value: qualifiedLeads,
      width: incomingLeads > 0 ? Math.max(2, Math.round((qualifiedLeads / incomingLeads) * 100)) : 0,
      color: "bg-sky-500"
    },
    {
      label: "Дошли до записи",
      value: bookedLeads,
      width: incomingLeads > 0 ? Math.max(2, Math.round((bookedLeads / incomingLeads) * 100)) : 0,
      color: "bg-indigo-500"
    },
    {
      label: "Потеряно",
      value: lostLeads,
      width: incomingLeads > 0 ? Math.max(2, Math.round((lostLeads / incomingLeads) * 100)) : 0,
      color: "bg-rose-500"
    }
  ];
  const recentConversationsLive = liveConversations.slice(0, 3).map((item) => ({
    client: item.client,
    channel: item.channel,
    status: item.status,
    summary: item.summary,
    time: item.lastActivity
  }));
  const filteredConversations = useMemo(
    () =>
      liveConversations.filter((item) => {
        const passStatus = statusFilter === "все" || item.status === statusFilter;
        const passChannel = channelFilter === "все" || item.channel === channelFilter;
        return passStatus && passChannel;
      }),
    [statusFilter, channelFilter, liveConversations]
  );

  const selectedConversation =
    filteredConversations.find((item) => item.id === selectedConversationId) ?? filteredConversations[0] ?? null;

  const statusCounts = useMemo(
    () =>
      allStatuses.reduce<Record<string, number>>((acc, status) => {
        acc[status] =
          status === "все" ? liveConversations.length : liveConversations.filter((item) => item.status === status).length;
        return acc;
      }, {}),
    [liveConversations]
  );

  const channelCounts = useMemo(
    () =>
      allChannels.reduce<Record<string, number>>((acc, channel) => {
        acc[channel] =
          channel === "все" ? liveConversations.length : liveConversations.filter((item) => item.channel === channel).length;
        return acc;
      }, {}),
    [liveConversations]
  );

  const leadStageCounts = useMemo(
    () =>
      leadStages.reduce<Record<string, number>>((acc, stage) => {
        acc[stage] = stage === "все" ? liveLeadRecords.length : liveLeadRecords.filter((item) => item.stage === stage).length;
        return acc;
      }, {}),
    [liveLeadRecords]
  );

  const filteredLeads = useMemo(() => {
    const normalizedQuery = leadQuery.trim().toLowerCase();
    return liveLeadRecords
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
  }, [leadQuery, leadStageFilter, leadChannelFilter, leadBookingFilter, leadSortBy, leadSortDirection, liveLeadRecords]);

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
    if (standaloneSites && item !== "CFlow Sites") return;
    if (item === "AI рекомендации" && !hasFeature("aiRecommendations")) {
      handleFeatureGuard("aiRecommendations");
      return;
    }
    if (item === "CFlow Sites" && !hasFeature("sitesBuilder")) {
      handleFeatureGuard("sitesBuilder");
      return;
    }
    setActiveNav(item);
    setMobileInboxView("list");
  }

  function updateSitesAnswer(fieldId: string, value: string): void {
    setSitesAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }

  function toggleSitesSection(key: SitesSectionKey): void {
    setSitesSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function updateGeneratedContent<K extends keyof GeneratedSiteContent>(key: K, value: GeneratedSiteContent[K]): void {
    setSitesGeneratedContent((prev) => ({ ...prev, [key]: value }));
  }

  function updateValueProp(index: number, value: string): void {
    setSitesGeneratedContent((prev) => {
      const next = [...prev.valueProps];
      next[index] = value;
      return { ...prev, valueProps: next };
    });
  }

  function updateFaqItem(index: number, field: "q" | "a", value: string): void {
    setSitesGeneratedContent((prev) => {
      const next = [...prev.faq];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return { ...prev, faq: next };
    });
  }

  function updateSitesProduct(index: number, field: keyof SitesProduct, value: string): void {
    setSitesProducts((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function reorderSitesProducts(sourceId: string, targetId: string): void {
    if (sourceId === targetId) return;
    setSitesProducts((prev) => {
      const sourceIndex = prev.findIndex((item) => item.id === sourceId);
      const targetIndex = prev.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  async function handleSitesProductImageUpload(file?: File): Promise<void> {
    if (!file || sitesProductUploadIndex === null) return;
    const dataUrl = await readFileAsDataUrl(file);
    setSitesProducts((prev) => {
      const next = [...prev];
      if (!next[sitesProductUploadIndex]) return prev;
      const current = next[sitesProductUploadIndex];
      next[sitesProductUploadIndex] = { ...current, images: [dataUrl] };
      return next;
    });
    setSitesActionMessage(`Фото загружено для товара #${sitesProductUploadIndex + 1}.`);
    setSitesProductUploadIndex(null);
  }

  function startSitesPayment(): void {
    if (!sitesPaymentName.trim() || !sitesPaymentCard.trim() || !sitesPaymentExpiry.trim() || !sitesPaymentCvv.trim()) {
      setSitesActionMessage("Заполните платежные поля, чтобы продолжить.");
      return;
    }
    setSitesPaymentState("processing");
    window.setTimeout(() => {
      setSitesPaymentState("success");
      setSitesPayment({ paid: true, paidAt: new Date().toISOString() });
      setSitesActionMessage("Оплата 3 500 ₽ успешно подтверждена. Теперь можно публиковать сайт.");
      window.setTimeout(() => setSitesPaymentModalOpen(false), 700);
    }, 1200);
  }

  function reorderSitesSections(sourceKey: SitesSectionKey, targetKey: SitesSectionKey): void {
    if (sourceKey === targetKey) return;
    setSitesSectionOrder((prev) => {
      const sourceIndex = prev.indexOf(sourceKey);
      const targetIndex = prev.indexOf(targetKey);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function renderSitesPreviewSection(key: SitesSectionKey): JSX.Element | null {
    if (!sitesSections[key]) return null;
    const visibleByTab: Record<typeof sitesPreviewTab, SitesSectionKey[]> = {
      home: ["about", "valueProps", "process", "gallery", "contacts", "map"],
      services: ["services"],
      reviews: ["testimonials", "faq"],
      cabinet: ["cabinet"]
    };
    if (!visibleByTab[sitesPreviewTab].includes(key)) return null;

    if (key === "about") return null;

    if (key === "valueProps") {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Преимущества</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {sitesGeneratedContent.valueProps.map((item) => (
              <div key={item} className="aspect-square rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
                {item}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (key === "services") {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Услуги и товары</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {sitesProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => setSitesOpenedProductId(product.id)}
                className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:border-slate-400"
              >
                <div className="h-20 overflow-hidden rounded-md border border-slate-200 bg-white">
                  {product.images[0] ? <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-slate-100" />}
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-900">{product.title}</p>
                <p className="text-xs text-slate-600">{product.price}</p>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (key === "process") {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Как это работает</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {sitesGeneratedContent.processSteps.map((step, index) => (
              <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">{index + 1}. </span>{step}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (key === "gallery") {
      if (sitesGalleryUrls.length === 0) return null;
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Галерея</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sitesGalleryUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img src={url} alt={`Фото ${index + 1}`} className="h-24 w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (key === "testimonials") {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Отзывы</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {sitesGeneratedContent.testimonials.map((item) => (
              <div key={item.name} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <p className="text-xs font-semibold text-slate-900">{item.name}</p>
                <p className="text-[11px] text-slate-500">{item.role}</p>
                <p className="mt-1 text-xs text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (key === "faq") {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
            <h4 className="text-3xl font-extrabold tracking-tight text-slate-900">Частые вопросы</h4>
            <div className="space-y-0">
              {sitesGeneratedContent.faq.map((item) => {
                const open = sitesFaqOpen === item.q;
                return (
                  <div key={item.q} className="border-t border-slate-200 py-3">
                    <button onClick={() => setSitesFaqOpen(open ? null : item.q)} className="flex w-full items-center justify-between gap-2 text-left">
                      <span className="text-base font-semibold text-slate-900">{item.q}</span>
                      <span className="text-xl text-slate-500">{open ? "−" : "+"}</span>
                    </button>
                    {open ? <p className="mt-2 text-sm text-slate-600">{item.a}</p> : null}
                  </div>
                );
              })}
              <div className="border-t border-slate-200" />
            </div>
          </div>
        </div>
      );
    }

    if (key === "cabinet") {
      if (!sitesCabinetEnabled) return null;
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Личный кабинет</p>
          <div className="mt-2 rounded-lg border p-3" style={{ borderColor: sitesAccentBorder, backgroundColor: sitesSoftBackground }}>
            <p className="text-xs font-semibold text-slate-900">Доступ к записям и персональным данным</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-white" style={{ backgroundColor: sitesAccentPreview }}>
                Войти через Telegram
              </button>
              <span className="text-[11px] text-slate-600">{sitesTelegramBot}</span>
            </div>
          </div>
        </div>
      );
    }

    if (key === "contacts") return null;

    if (key === "map") {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Карта</p>
          <div className="mt-2 rounded-lg border border-slate-200 p-3" style={{ backgroundColor: sitesHeroBackground }}>
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 25 }).map((_, index) => (
                <div key={index} className="h-5 rounded border border-slate-200 bg-white" />
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-700">Локация: {sitesAnswers.city || "уточняется"}</p>
          </div>
        </div>
      );
    }

    return null;
  }

  const openedSitesProduct = sitesProducts.find((item) => item.id === sitesOpenedProductId) || null;
  const contactsIcons = ["TG", "WA", "IG"];
  const previewTabs: Array<{ id: "home" | "services" | "reviews" | "cabinet"; label: string }> = [
    { id: "home", label: "Дом" },
    { id: "services", label: "Услуги" },
    { id: "reviews", label: "Отзывы" },
    { id: "cabinet", label: "Личный кабинет" }
  ];

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("File read error"));
      };
      reader.onerror = () => reject(new Error("File read error"));
      reader.readAsDataURL(file);
    });
  }

  async function handleSitesLogoUpload(file?: File): Promise<void> {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setSitesLogoUrl(dataUrl);
    setSitesActionMessage("Логотип загружен. Теперь можно генерировать финальный вариант сайта.");
  }

  async function handleSitesGalleryUpload(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    const currentCount = sitesGalleryUrls.length;
    const room = Math.max(0, 5 - currentCount);
    if (room === 0) {
      setSitesActionMessage("Добавлено максимум 5 фотографий. Удалите одну, чтобы загрузить новую.");
      return;
    }
    const selected = Array.from(files).slice(0, room);
    const dataUrls = await Promise.all(selected.map((file) => readFileAsDataUrl(file)));
    setSitesGalleryUrls((prev) => [...prev, ...dataUrls].slice(0, 5));
    setSitesActionMessage("Фотографии добавлены в предпросмотр сайта.");
  }

  function toStringArray(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, Math.max(fallback.length, 3));
    return normalized.length > 0 ? normalized : fallback;
  }

  function toStatsArray(
    value: unknown,
    fallback: Array<{ label: string; value: string }>
  ): Array<{ label: string; value: string }> {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
      .map((item) => {
        const record = item as { label?: unknown; value?: unknown };
        const label = typeof record.label === "string" ? record.label.trim() : "";
        const statValue = typeof record.value === "string" ? record.value.trim() : "";
        if (!label || !statValue) return null;
        return { label, value: statValue };
      })
      .filter((item): item is { label: string; value: string } => Boolean(item))
      .slice(0, 3);
    return normalized.length > 0 ? normalized : fallback;
  }

  function toTestimonialsArray(
    value: unknown,
    fallback: Array<{ name: string; role: string; text: string }>
  ): Array<{ name: string; role: string; text: string }> {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
      .map((item) => {
        const record = item as { name?: unknown; role?: unknown; text?: unknown };
        const name = typeof record.name === "string" ? record.name.trim() : "";
        const role = typeof record.role === "string" ? record.role.trim() : "";
        const text = typeof record.text === "string" ? record.text.trim() : "";
        if (!name || !role || !text) return null;
        return { name, role, text };
      })
      .filter((item): item is { name: string; role: string; text: string } => Boolean(item))
      .slice(0, 3);
    return normalized.length > 0 ? normalized : fallback;
  }

  function toPackagesArray(
    value: unknown,
    fallback: Array<{ name: string; price: string; features: string[]; recommended?: boolean }>
  ): Array<{ name: string; price: string; features: string[]; recommended?: boolean }> {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
      .map((item) => {
        const record = item as { name?: unknown; price?: unknown; features?: unknown; recommended?: unknown };
        const name = typeof record.name === "string" ? record.name.trim() : "";
        const price = typeof record.price === "string" ? record.price.trim() : "";
        const features = toStringArray(record.features, []);
        if (!name || !price || features.length === 0) return null;
        const normalizedPackage: { name: string; price: string; features: string[]; recommended?: boolean } = {
          name,
          price,
          features
        };
        if (record.recommended === true) {
          normalizedPackage.recommended = true;
        }
        return normalizedPackage;
      })
      .filter((item) => item !== null)
      .slice(0, 3);
    return normalized.length > 0 ? (normalized as Array<{ name: string; price: string; features: string[]; recommended?: boolean }>) : fallback;
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
      trustStats: toStatsArray(candidate.trustStats, fallback.trustStats),
      valueProps: toStringArray(candidate.valueProps, fallback.valueProps),
      services: toStringArray(candidate.services, fallback.services),
      about: typeof candidate.about === "string" && candidate.about.trim() ? candidate.about.trim() : fallback.about,
      processSteps: toStringArray(candidate.processSteps, fallback.processSteps),
      outcomes: toStringArray(candidate.outcomes, fallback.outcomes),
      showcaseTitle:
        typeof candidate.showcaseTitle === "string" && candidate.showcaseTitle.trim() ? candidate.showcaseTitle.trim() : fallback.showcaseTitle,
      showcaseText:
        typeof candidate.showcaseText === "string" && candidate.showcaseText.trim() ? candidate.showcaseText.trim() : fallback.showcaseText,
      testimonials: toTestimonialsArray(candidate.testimonials, fallback.testimonials),
      packages: toPackagesArray(candidate.packages, fallback.packages),
      faq: toFaqArray(candidate.faq, fallback.faq),
      finalCtaTitle:
        typeof candidate.finalCtaTitle === "string" && candidate.finalCtaTitle.trim()
          ? candidate.finalCtaTitle.trim()
          : fallback.finalCtaTitle,
      finalCtaText:
        typeof candidate.finalCtaText === "string" && candidate.finalCtaText.trim()
          ? candidate.finalCtaText.trim()
          : fallback.finalCtaText,
      contactLine:
        typeof candidate.contactLine === "string" && candidate.contactLine.trim() ? candidate.contactLine.trim() : fallback.contactLine
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
    if (!sitesLogoUrl) {
      setSitesActionMessage("Сначала загрузите логотип. Он обязателен для генерации и публикации сайта.");
      return;
    }
    const baseFallback = buildFallbackSiteContent(selectedSitesTemplate, sitesAnswers);
    const prompt = [
      "Создай контент для премиального production-looking template website для малого/среднего сервисного бизнеса.",
      "Сайт должен адаптироваться под ниши: beauty, auto service, clinic, dental, local agency, consulting, repair, cleaning, real estate и схожие.",
      "Это единый универсальный шаблон, меняется только стиль и наполнение.",
      "На шаблонном сайте не использовать градиенты: только чистые однотонные поверхности и аккуратные бордеры.",
      "В структуре предусмотреть навигацию: Дом, Услуги, Личный кабинет.",
      "Личный кабинет на сайте должен иметь вход через Telegram.",
      "Верни строго JSON без markdown.",
      "Тон: премиально, спокойно, профессионально, без хайпа.",
      "Избегай слов: AI, ИИ, нейросеть, революция, магия.",
      "Копирайтинг на английском языке, лаконичный и конверсионный.",
      "Структура JSON:",
      "{\"heroTitle\":\"\",\"heroSubtitle\":\"\",\"primaryCta\":\"\",\"secondaryCta\":\"\",\"trustStats\":[{\"label\":\"\",\"value\":\"\"},{\"label\":\"\",\"value\":\"\"},{\"label\":\"\",\"value\":\"\"}],\"valueProps\":[\"\",\"\",\"\"],\"services\":[\"\",\"\",\"\"],\"about\":\"\",\"processSteps\":[\"\",\"\",\"\"],\"outcomes\":[\"\",\"\",\"\"],\"showcaseTitle\":\"\",\"showcaseText\":\"\",\"testimonials\":[{\"name\":\"\",\"role\":\"\",\"text\":\"\"},{\"name\":\"\",\"role\":\"\",\"text\":\"\"},{\"name\":\"\",\"role\":\"\",\"text\":\"\"}],\"packages\":[{\"name\":\"\",\"price\":\"\",\"features\":[\"\",\"\"],\"recommended\":true},{\"name\":\"\",\"price\":\"\",\"features\":[\"\",\"\"]},{\"name\":\"\",\"price\":\"\",\"features\":[\"\",\"\"]}],\"faq\":[{\"q\":\"\",\"a\":\"\"},{\"q\":\"\",\"a\":\"\"},{\"q\":\"\",\"a\":\"\"}],\"finalCtaTitle\":\"\",\"finalCtaText\":\"\",\"contactLine\":\"\"}",
      `Шаблон: ${selectedSitesTemplate.name}. Стиль: ${selectedSitesTemplate.styleLabel}.`,
      `Включенные секции конструктора: ${sitesSectionLibrary
        .filter((item) => sitesSections[item.key])
        .map((item) => item.title)
        .join(", ") || "базовая структура"}.`,
      `Цвет акцента: ${sitesAccentPreview}. Базовый фон: ${sitesBaseColor}.`,
      `Личный кабинет на сайте: ${sitesCabinetEnabled ? "включен" : "выключен"}. Telegram: ${sitesTelegramBot}.`,
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
      setSitesProducts(createDefaultSitesProducts(normalized, sitesGalleryUrls));
      setSitesLastGenerationMode("ai");
      setSitesGenerationProgress(100);
      setSitesFlowStatus("ready");
      setSitesActionMessage("Контент сгенерирован. Проверьте предпросмотр и публикуйте.");
    } catch {
      setSitesGeneratedContent(baseFallback);
      setSitesProducts(createDefaultSitesProducts(baseFallback, sitesGalleryUrls));
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
    saveServiceConnection(serviceConnection);
  }, [serviceConnection]);

  useEffect(() => {
    saveServiceEvents(serviceEvents);
  }, [serviceEvents]);

  useEffect(() => {
    saveTelegramOffset(telegramOffset);
  }, [telegramOffset]);

  useEffect(() => {
    saveTelegramProfiles(telegramProfiles);
  }, [telegramProfiles]);

  useEffect(() => {
    saveBusinessBrief(businessBrief);
  }, [businessBrief]);

  useEffect(() => {
    saveBusinessTuning(businessTuning);
  }, [businessTuning]);

  useEffect(() => {
    saveSitesBuilderPrefs(sitesSections, sitesSectionOrder);
  }, [sitesSections, sitesSectionOrder]);

  useEffect(() => {
    saveSitesBuilderStyle({
      accentColor: sitesAccentColor,
      baseColor: sitesBaseColor,
      cabinetEnabled: sitesCabinetEnabled,
      telegramBot: sitesTelegramBot
    });
  }, [sitesAccentColor, sitesBaseColor, sitesCabinetEnabled, sitesTelegramBot]);

  useEffect(() => {
    saveSitesBuilderPayment(sitesPayment);
  }, [sitesPayment]);

  useEffect(() => {
    if (sitesFlowStatus !== "idle") return;
    const draft = buildFallbackSiteContent(selectedSitesTemplate, sitesAnswers);
    setSitesGeneratedContent(draft);
    setSitesProducts(createDefaultSitesProducts(draft, sitesGalleryUrls));
  }, [sitesAnswers, sitesFlowStatus, selectedSitesTemplate, sitesGalleryUrls]);

  useEffect(() => {
    if (!uiNotice) return;
    const timer = window.setTimeout(() => setUiNotice(null), 2600);
    return () => window.clearTimeout(timer);
  }, [uiNotice]);

  useEffect(() => {
    if (filteredConversations.length === 0) {
      setSelectedConversationId("");
      return;
    }
    if (!filteredConversations.some((item) => item.id === selectedConversationId)) {
      setSelectedConversationId(filteredConversations[0].id);
    }
  }, [filteredConversations, selectedConversationId]);

  useEffect(() => {
    setShowFullTimeline(false);
  }, [selectedConversationId]);

  useEffect(() => {
    if (standaloneSites && activeNav !== "CFlow Sites") {
      setActiveNav("CFlow Sites");
    }
  }, [standaloneSites, activeNav]);

  const selectedCheckoutPlan = planDefinitions.find((plan) => plan.id === checkoutPlanId) ?? null;
  const navNeedsLiveData = ["Обзор", "Аналитика", "Потерянные", "AI рекомендации"].includes(activeNav);
  const showSettingsSetupWizard = activeNav === "Настройки" && !standaloneSites && !subscription.onboardingCompleted;
  const currentSettingsQuestion = SETTINGS_QUESTIONS[settingsQuestionIndex];
  const answeredSettingsQuestions = SETTINGS_QUESTIONS.filter((item) => settingsBusinessAnswers[item.id]?.trim()).length;

  function triggerNotice(message: string): void {
    setUiNotice(message);
  }

  async function importServiceEvents(file?: File): Promise<void> {
    if (!file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as unknown;
      const events = parseServiceEvents(parsed);
      setServiceEvents(events);
      setServiceConnection((prev) => ({ ...prev, connectedAt: new Date().toISOString() }));
      triggerNotice(events.length > 0 ? `Импортировано событий: ${events.length}` : "Файл прочитан, но валидные события не найдены.");
    } catch {
      triggerNotice("Не удалось прочитать JSON. Проверьте формат файла.");
    }
  }

  async function syncServiceEvents(): Promise<void> {
    if (!serviceConnection.endpoint.trim()) {
      triggerNotice("Укажите endpoint сервиса в настройках подключения.");
      return;
    }
    setServiceSyncLoading(true);
    try {
      const response = await fetch(serviceConnection.endpoint, {
        headers: serviceConnection.token ? { Authorization: `Bearer ${serviceConnection.token}` } : undefined
      });
      if (!response.ok) throw new Error("HTTP error");
      const data = (await response.json()) as unknown;
      const events = parseServiceEvents(data);
      setServiceEvents(events);
      setServiceConnection((prev) => ({ ...prev, connectedAt: new Date().toISOString() }));
      triggerNotice(`Синхронизация завершена. Событий: ${events.length}.`);
    } catch {
      triggerNotice("Синхронизация не удалась. Используйте импорт JSON или проверьте endpoint/CORS.");
    } finally {
      setServiceSyncLoading(false);
    }
  }

  function profileFromAnswer(previous: TelegramProfile | undefined, step: number, answer: string): TelegramProfile {
    const base: TelegramProfile =
      previous ??
      ({
        started: true,
        completed: false,
        step: 0,
        answers: {
          businessType: "",
          mainService: "",
          city: "",
          goal: ""
        }
      } as TelegramProfile);

    const next = {
      ...base,
      started: true,
      answers: { ...base.answers }
    };
    if (step === 0) next.answers.businessType = answer;
    if (step === 1) next.answers.mainService = answer;
    if (step === 2) next.answers.city = answer;
    if (step === 3) next.answers.goal = answer;
    next.step = Math.min(step + 1, TELEGRAM_ONBOARDING_QUESTIONS.length);
    if (next.step >= TELEGRAM_ONBOARDING_QUESTIONS.length) {
      next.completed = true;
    }
    return next;
  }

  function buildTelegramBusinessContext(profile: TelegramProfile | undefined): string {
    if (!profile?.completed) return "";
    return [
      `Ниша: ${profile.answers.businessType || "не указано"}`,
      `Ключевая услуга: ${profile.answers.mainService || "не указано"}`,
      `Город: ${profile.answers.city || "не указано"}`,
      `Цель: ${profile.answers.goal || "не указано"}`
    ].join("; ");
  }

  function buildBusinessBriefContext(brief: BusinessBriefState): string {
    if (!brief.answers.length) return "";
    return brief.answers
      .slice(0, brief.targetCount)
      .map((item, index) => `${index + 1}. ${item.question}: ${item.answer}`)
      .join(" | ");
  }

  function buildBusinessTuningContext(tuning: BusinessTuningState): string {
    const parts = [
      tuning.businessSummary ? `Описание бизнеса: ${tuning.businessSummary}` : "",
      tuning.targetAudience ? `ЦА: ${tuning.targetAudience}` : "",
      tuning.mainServices ? `Ключевые услуги: ${tuning.mainServices}` : "",
      tuning.responseStyle ? `Стиль ответа: ${tuning.responseStyle}` : "",
      tuning.qualificationRules ? `Правила квалификации: ${tuning.qualificationRules}` : "",
      tuning.escalationRules ? `Когда передавать менеджеру: ${tuning.escalationRules}` : "",
      tuning.workingHours ? `График: ${tuning.workingHours}` : "",
      tuning.cityCoverage ? `География: ${tuning.cityCoverage}` : "",
      tuning.forbiddenWords ? `Нельзя использовать слова: ${tuning.forbiddenWords}` : ""
    ].filter(Boolean);
    return parts.join(" | ");
  }

  function fallbackAdaptiveQuestion(answers: BusinessBriefAnswer[]): string {
    const next = BUSINESS_BRIEF_FALLBACK_QUESTIONS[answers.length];
    if (next) return next;
    const lastAnswer = answers[answers.length - 1]?.answer || "вашу цель по росту конверсии";
    return `Уточните дополнительные детали по теме "${lastAnswer}", чтобы сделать ответы точнее в реальных диалогах.`;
  }

  async function generateBusinessBriefQuestion(answers: BusinessBriefAnswer[]): Promise<string> {
    try {
      const response = await fetch("/api/openrouter/business-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: serviceConnection.serviceName || "Подключенный сервис",
          targetCount: businessBrief.targetCount,
          answers,
          endpoint: serviceConnection.endpoint || "",
          onboarding: subscription.onboardingData || null
        })
      });
      const data = (await response.json()) as { question?: string; reply?: string };
      const rawQuestion = data.question || data.reply || "";
      if (response.ok && rawQuestion.trim()) {
        return rawQuestion.trim();
      }
    } catch {
      // fallback below
    }
    return fallbackAdaptiveQuestion(answers);
  }

  async function startBusinessBrief(): Promise<void> {
    setBusinessBriefLoading(true);
    try {
      const firstQuestion = await generateBusinessBriefQuestion([]);
      setBusinessBrief({
        started: true,
        completed: false,
        targetCount: BUSINESS_BRIEF_MIN_QUESTIONS,
        currentQuestion: firstQuestion,
        answers: [],
        updatedAt: new Date().toISOString()
      });
      setBusinessBriefAnswer("");
      triggerNotice("Бриф запущен. Ответьте на вопросы, чтобы адаптировать ответы под ваш бизнес.");
    } finally {
      setBusinessBriefLoading(false);
    }
  }

  async function submitBusinessBriefAnswer(): Promise<void> {
    const answerText = businessBriefAnswer.trim();
    if (!businessBrief.currentQuestion.trim() || !answerText) {
      triggerNotice("Заполните ответ на текущий вопрос.");
      return;
    }
    setBusinessBriefLoading(true);
    try {
      const nextAnswers = [...businessBrief.answers, { question: businessBrief.currentQuestion, answer: answerText }];
      if (nextAnswers.length >= businessBrief.targetCount) {
        setBusinessBrief({
          ...businessBrief,
          answers: nextAnswers,
          currentQuestion: "",
          completed: true,
          updatedAt: new Date().toISOString()
        });
        setBusinessBriefAnswer("");
        triggerNotice("Бриф завершен. Ответы теперь учитываются при генерации сообщений клиентам.");
        return;
      }
      const nextQuestion = await generateBusinessBriefQuestion(nextAnswers);
      setBusinessBrief({
        ...businessBrief,
        answers: nextAnswers,
        currentQuestion: nextQuestion,
        completed: false,
        updatedAt: new Date().toISOString()
      });
      setBusinessBriefAnswer("");
    } finally {
      setBusinessBriefLoading(false);
    }
  }

  function buildTelegramFallbackReply(input: string, profile: TelegramProfile | undefined): string {
    const text = input.toLowerCase();
    const service = profile?.answers.mainService || businessTuning.mainServices || "услуга";
    if (text.includes("цена") || text.includes("стоим")) {
      return `Стоимость зависит от задачи и формата. Следующий шаг: напишите, какая именно ${service} нужна и на когда планируете запись.`;
    }
    if (text.includes("запис") || text.includes("когда можно")) {
      return "Подберем удобный слот без лишней переписки. Следующий шаг: напишите удобный день и время, и я предложу ближайшие окна.";
    }
    if (text.includes("адрес") || text.includes("где вы")) {
      return "Сориентирую по адресу и формату визита. Следующий шаг: напишите ваш район, чтобы предложить самый удобный вариант.";
    }
    return `Спасибо за обращение, помогу по вашей задаче. Следующий шаг: уточните, какая ${service} нужна и на какое время вам удобно.`;
  }

  async function syncTelegramBotEvents(): Promise<void> {
    if (!serviceConnection.botToken.trim()) {
      triggerNotice("Укажите Bot Token для Telegram.");
      return;
    }
    setServiceSyncLoading(true);
    try {
      const updatesResp = await fetch("/api/telegram/get-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: serviceConnection.botToken.trim(),
          offset: telegramOffset > 0 ? telegramOffset + 1 : 0
        })
      });
      const updatesData = (await updatesResp.json()) as {
        updates?: Array<{
          update_id: number;
          message?: {
            date: number;
            text?: string;
            from?: { is_bot?: boolean; first_name?: string; username?: string };
            chat?: { id: number; type: string; title?: string; username?: string; first_name?: string };
          };
        }>;
        error?: string;
      };
      if (!updatesResp.ok) {
        throw new Error(updatesData.error || "Telegram sync failed");
      }

      const updates = Array.isArray(updatesData.updates) ? updatesData.updates : [];
      let nextOffset = telegramOffset;
      const inboundEvents: ServiceEvent[] = [];
      const profilesNext = { ...telegramProfiles };
      let autoRepliesCount = 0;
      let replyErrorsCount = 0;
      let reachedReplyCap = false;

      for (const update of updates) {
        if (serviceConnection.autoReplyEnabled && autoRepliesCount >= TELEGRAM_MAX_AUTO_REPLIES_PER_SYNC) {
          reachedReplyCap = true;
          break;
        }
        const message = update.message;
        if (!message?.text || !message.chat?.id || message.from?.is_bot) {
          if (update.update_id > nextOffset) nextOffset = update.update_id;
          continue;
        }
        const timestamp = new Date(message.date * 1000).toISOString();
        const leadId = `tg-${message.chat.id}`;
        const clientName =
          message.from?.first_name ||
          message.from?.username ||
          message.chat.title ||
          message.chat.username ||
          message.chat.first_name ||
          "Telegram клиент";
        inboundEvents.push({
          id: `in-${update.update_id}`,
          leadId,
          clientName,
          channel: "Telegram",
          direction: "inbound",
          text: message.text,
          timestamp,
          status: "новый",
          stage: "новый",
          bookingState: "не начата"
        });

        const canAutoReply = serviceConnection.autoReplyEnabled && autoRepliesCount < TELEGRAM_MAX_AUTO_REPLIES_PER_SYNC;

        if (canAutoReply) {
          try {
            const incomingText = message.text.trim();
            const currentProfile = profilesNext[leadId];
            let replyText = "";

            if (!currentProfile || !currentProfile.started) {
              profilesNext[leadId] = {
                started: true,
                completed: false,
                step: 0,
                answers: {
                  businessType: "",
                  mainService: "",
                  city: "",
                  goal: ""
                }
              };
              replyText = TELEGRAM_ONBOARDING_QUESTIONS[0];
            } else if (!currentProfile.completed) {
              const updated = profileFromAnswer(currentProfile, currentProfile.step, incomingText);
              profilesNext[leadId] = updated;
              if (!updated.completed) {
                replyText = TELEGRAM_ONBOARDING_QUESTIONS[updated.step];
              } else {
                replyText =
                  "Отлично, профиль бизнеса зафиксирован. Теперь буду отвечать с учетом вашей ниши и целей. Напишите любой вопрос клиента для теста.";
              }
            } else {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 10000);
              let replyResp: Response;
              try {
                replyResp = await fetch("/api/openrouter/telegram-reply", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    text: incomingText,
                    businessName: serviceConnection.serviceName || "Ваш сервис",
                  businessContext: [
                    buildTelegramBusinessContext(currentProfile),
                    subscription.onboardingData?.profileSummary
                      ? `Профиль бизнеса: ${subscription.onboardingData.profileSummary}`
                      : "",
                    Array.isArray(subscription.onboardingData?.businessAnswers) && subscription.onboardingData?.businessAnswers.length
                      ? `Внутренние правила: ${subscription.onboardingData.businessAnswers
                          .map((item) => `${item.question}: ${item.answer}`)
                          .join(" | ")}`
                      : ""
                  ]
                      .filter(Boolean)
                      .join(" | ")
                }),
                  signal: controller.signal
                });
              } finally {
                clearTimeout(timeout);
              }
              const replyData = (await replyResp.json()) as { reply?: string };
              replyText = replyResp.ok ? (replyData.reply || "").trim() : "";
              if (!replyText) {
                replyText = buildTelegramFallbackReply(incomingText, currentProfile);
              }
            }

            if (replyText) {
              const sendResp = await fetch("/api/telegram/send-message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  botToken: serviceConnection.botToken.trim(),
                  chatId: message.chat.id,
                  text: replyText
                })
              });
              if (!sendResp.ok) {
                const sendErr = (await sendResp.json().catch(() => ({}))) as { error?: string };
                throw new Error(sendErr.error || `Telegram send status ${sendResp.status}`);
              }
              inboundEvents.push({
                id: `out-${update.update_id}`,
                leadId,
                clientName,
                channel: "Telegram",
                direction: "outbound",
                text: replyText,
                timestamp: new Date().toISOString(),
                status: "квалифицирован",
                stage: "квалифицирован",
                bookingState: "в процессе"
              });
              autoRepliesCount += 1;
            }
          } catch {
            replyErrorsCount += 1;
            // Keep sync resilient even if one reply fails.
          }
        }
        if (update.update_id > nextOffset) nextOffset = update.update_id;
      }

      if (nextOffset > telegramOffset) setTelegramOffset(nextOffset);
      setTelegramProfiles(profilesNext);
      if (inboundEvents.length > 0) {
        setServiceEvents((prev) => {
          const dedupe = new Set(prev.map((event) => event.id));
          const appended = inboundEvents.filter((event) => !dedupe.has(event.id));
          return [...appended, ...prev].slice(0, 1500);
        });
      }
      setServiceConnection((prev) => ({ ...prev, connectedAt: new Date().toISOString() }));
      const extraInfo = reachedReplyCap
        ? ` Ответов за цикл: ${autoRepliesCount}, остальные обработаются при следующей синхронизации.`
        : ` Ответов за цикл: ${autoRepliesCount}.`;
      const errorsInfo = replyErrorsCount > 0 ? ` Ошибок отправки: ${replyErrorsCount}.` : "";
      triggerNotice(
        `Telegram синхронизирован. Новых событий: ${inboundEvents.length}.${extraInfo}${errorsInfo}`
      );
    } catch (error: any) {
      triggerNotice(error?.message || "Ошибка синхронизации Telegram.");
    } finally {
      setServiceSyncLoading(false);
    }
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

  function finishOnboarding(summaryOverride?: string): void {
    const answered = SETTINGS_QUESTIONS.map((item) => ({
      question: item.question,
      answer: settingsBusinessAnswers[item.id] || ""
    })).filter((item) => item.answer.trim().length > 0);
    setSubscription((prev) => ({
      ...prev,
      onboardingCompleted: true,
      onboardingData: {
        businessType: onboardingBusinessType,
        channels: settingsChannels.length > 0 ? settingsChannels : onboardingChannels,
        goals: onboardingGoals,
        profileSummary: summaryOverride || settingsSummary || prev.onboardingData?.profileSummary || "",
        businessAnswers: answered
      }
    }));
    setSettingsSetupStep(1);
    setSettingsQuestionIndex(0);
    triggerNotice("Настройка завершена. Система готова к работе.");
  }

  function resetSettingsSetup(): void {
    setSettingsSetupStep(1);
    setSettingsQuestionIndex(0);
    setSettingsChannels(["Telegram"]);
    setSettingsSummary("");
    setCheckoutPlanId(null);
    setCheckoutState("idle");
    setSettingsBusinessAnswers(SETTINGS_QUESTIONS.reduce<Record<string, string>>((acc, item) => ({ ...acc, [item.id]: "" }), {}));
  }

  async function goToSettingsStepThree(): Promise<void> {
    setSettingsSetupStep(3);
    if (!settingsSummary.trim()) {
      await generateBusinessSummaryForSetup();
    }
  }

  function completeSettingsSetupWithPlan(planId: PlanDefinition["id"]): void {
    if (planId === "trial") {
      setSubscription((prev) => ({
        ...prev,
        planId: "trial",
        subscriptionStatus: "trial",
        trialStartDate: new Date().toISOString(),
        onboardingCompleted: false
      }));
      finishOnboarding(settingsSummary);
      return;
    }
    setCheckoutState("processing");
    window.setTimeout(() => {
      setCheckoutState("success");
      setSubscription((prev) => ({
        ...prev,
        planId,
        subscriptionStatus: "active",
        trialStartDate: null,
        onboardingCompleted: false
      }));
      finishOnboarding(settingsSummary);
    }, 1200);
  }

  async function generateBusinessSummaryForSetup(): Promise<void> {
    setSettingsSummaryLoading(true);
    try {
      const answersPayload = SETTINGS_QUESTIONS.map((item) => ({
        question: item.question,
        answer: settingsBusinessAnswers[item.id] || ""
      }));
      const response = await fetch("/api/openrouter/business-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: serviceConnection.serviceName || "Подключенный бизнес",
          channels: settingsChannels,
          answers: answersPayload
        })
      });
      const data = (await response.json()) as { summary?: string; reply?: string };
      const raw = (data.summary || data.reply || "").trim();
      if (response.ok && raw.length >= 120) {
        setSettingsSummary(raw);
      } else {
        throw new Error("fallback");
      }
    } catch {
      const fallback = [
        `${serviceConnection.serviceName || "Ваш бизнес"} работает с входящими обращениями через ${settingsChannels.join(", ") || "основные каналы связи"}.`,
        "Ключевая задача — быстро отвечать на первый запрос, корректно квалифицировать клиента и переводить его к записи или покупке без лишних шагов.",
        "В коммуникации важно сохранять единый стиль, учитывать частые вопросы по цене, срокам и доступным слотам, а также заранее выделять обращения, которые требуют участия менеджера.",
        "Фокус на ближайший период: повысить скорость первого ответа, снизить потери лидов между касаниями и увеличить долю обращений, дошедших до целевого действия.",
        "Операционная логика должна включать прозрачные этапы воронки, контроль follow-up и регулярный анализ причин потерь, чтобы команда могла быстро корректировать сценарии."
      ].join(" ");
      setSettingsSummary(fallback);
    } finally {
      setSettingsSummaryLoading(false);
    }
  }

  return (
    <div
      className={`app-shell min-h-screen text-slate-900 ${
        standaloneSites
          ? "bg-[radial-gradient(70%_80%_at_10%_10%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(50%_60%_at_90%_0%,rgba(59,130,246,0.2),transparent_60%),#020617]"
          : "bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100"
      }`}
    >
      <div className="flex min-h-screen">
        {!standaloneSites ? (
        <aside className="hidden w-[260px] shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
          <div className="mb-8 px-2">
            <p className="text-lg font-extrabold tracking-tight">
              <BrandWordmark />
            </p>
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
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={`sticky top-0 z-30 px-3 py-3 backdrop-blur md:px-6 md:py-4 ${
              standaloneSites ? "border-b border-blue-900/50 bg-slate-950/90" : "border-b border-slate-200/90 bg-white/95"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className={`text-lg font-extrabold tracking-tight sm:text-xl ${standaloneSites ? "text-white" : ""}`}>
                  {standaloneSites ? "CFlow Sites" : activeNav}
                </h1>
                <p className={`text-xs sm:text-sm ${standaloneSites ? "text-slate-300" : "text-slate-500"}`}>
                  {standaloneSites ? "Конструктор сайтов для бизнеса: шаблон, контент, публикация" : "Рабочая панель управления потоком обращений"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {standaloneSites ? (
                  <>
                    <button
                      onClick={() => onNavigate?.("/")}
                      className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200"
                    >
                      На главную
                    </button>
                    <button
                      onClick={() => onNavigate?.("/dashboard")}
                      className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
                    >
                      Личный кабинет
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => triggerNotice("Период: последние 30 дней")}
                      className="hidden rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 sm:block"
                    >
                      Последние 30 дней
                    </button>
                    <div className="h-8 w-8 rounded-full bg-slate-900 shadow-sm sm:h-9 sm:w-9" />
                  </>
                )}
              </div>
            </div>

            {!standaloneSites ? (
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
            ) : null}
          </header>

          <main className={`flex-1 overflow-auto px-3 py-4 pb-24 sm:px-4 sm:py-6 md:px-6 lg:pb-6 ${standaloneSites ? "text-slate-100" : ""}`}>
            <div className={`mx-auto w-full ${standaloneSites ? "max-w-[1320px]" : "max-w-[1440px]"}`}>
            {uiNotice ? (
              <div className="mb-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">
                {uiNotice}
              </div>
            ) : null}
            {!hasLiveData && navNeedsLiveData ? (
              <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Источник данных не подключен</p>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">Статистика будет считаться только по вашему сервису</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-700">
                  Фейковые метрики отключены. Подключите endpoint или импортируйте JSON-события сообщений, чтобы построить живые показатели по лидам, ответам и конверсии.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => handleNavChange("Настройки")}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Подключить сервис
                  </button>
                  <button
                    onClick={() => serviceImportRef.current?.click()}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    Импортировать JSON
                  </button>
                </div>
                <input
                  ref={serviceImportRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => {
                    void importServiceEvents(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </section>
            ) : activeNav === "Диалоги" ? (
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
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-xs text-slate-500">Сообщений в переписке: {selectedConversation.timeline.length}</p>
                        <button
                          onClick={() => setShowFullTimeline(true)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                        >
                          Полная переписка
                        </button>
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
                  {analyticsKpisLive.map((kpi) => (
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
                        <LineChart data={analyticsTrendDataLive} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                            data={analyticsConversionDataLive}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={88}
                            paddingAngle={3}
                            animationDuration={1200}
                          >
                            {analyticsConversionDataLive.map((entry) => (
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
                        <BarChart data={analyticsFunnelDataLive} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                          <LineChart data={analyticsResponseTrendLive}>
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
                        <BarChart data={analyticsChannelDataLive} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
                      {analyticsInsightsLive.map((insight) => (
                        <div key={insight} className="rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-sm text-slate-700">
                          {insight}
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      Последнее обновление аналитики:{" "}
                      {serviceConnection.connectedAt
                        ? new Date(serviceConnection.connectedAt).toLocaleString("ru-RU")
                        : "нет синхронизации"}
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
                    <p className="mt-1 text-sm text-slate-600">Сформированы по вашим текущим данным</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Лиды для recovery</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{lostLeads}</p>
                    <p className="mt-1 text-sm text-slate-600">Требуют повторного касания</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Потенциал роста</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">+{Math.max(1, Math.round(conversionPercent * 0.2))} п.п.</p>
                    <p className="mt-1 text-sm text-slate-600">Оценка прироста конверсии</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Потенциальный эффект</p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{formatRub(Math.round(lostRevenueSnapshot.estimatedRevenue * 0.35))}</p>
                    <p className="mt-1 text-sm text-slate-700">Потенциальный возврат выручки</p>
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
            ) : activeNav === "CFlow Sites" ? (
              <>
              <div className="space-y-4">
                {!hasFeature("sitesBuilder") ? (
                  <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Доступ ограничен</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">CFlow Sites доступен на Pro и Business</h2>
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
                      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">CFlow Sites</h2>
                      <p className="mt-2 max-w-3xl text-sm text-slate-600">
                        Запустите сайт за 5 минут: выберите один из 4 стилей, заполните бриф из 10 вопросов, получите сгенерированный контент и опубликуйте.
                        Sites выводит бизнес онлайн, а CFlow берет входящие обращения и доводит до записи.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSitesPaymentModalOpen(true);
                        setSitesPaymentState("idle");
                      }}
                      className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-left transition hover:border-cyan-400"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Фиксированная стоимость</p>
                      <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">3 500 ₽</p>
                      <p className="text-xs text-slate-600">за 1 сайт</p>
                      <p className={`mt-1 text-xs font-semibold ${sitesPayment.paid ? "text-emerald-700" : "text-amber-700"}`}>
                        {sitesPayment.paid ? "Оплачено" : "Нажмите, чтобы оплатить на этой странице"}
                      </p>
                      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">Бонус при оплате</p>
                        <p className="mt-1 text-xs font-semibold text-emerald-900">
                          Бесплатная настройка и привязка к Telegram-боту через менеджера.
                        </p>
                      </div>
                    </button>
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Варианты дизайна</p>
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">4 стиля одного шаблона сайта</h3>
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
                            <div className={`h-24 rounded-xl ${selected ? "bg-white/10" : template.previewTheme.softSurface} p-3`}>
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
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Конструктор секций</p>
                          <h4 className="mt-1 text-base font-bold tracking-tight text-slate-900">Соберите структуру сайта под ваш бизнес</h4>
                        </div>
                        <span className="rounded-full border border-cyan-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                          Включено: {enabledSitesSectionsCount} секций
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {orderedSitesSectionLibrary.map((section) => {
                          const enabled = sitesSections[section.key];
                          const needsGallery = section.key === "gallery" && sitesGalleryUrls.length === 0;
                          return (
                            <button
                              key={section.key}
                              draggable
                              onDragStart={() => setDraggedSitesSection(section.key)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (!draggedSitesSection) return;
                                reorderSitesSections(draggedSitesSection, section.key);
                                setDraggedSitesSection(null);
                              }}
                              onDragEnd={() => setDraggedSitesSection(null)}
                              onClick={() => toggleSitesSection(section.key)}
                              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                                enabled
                                  ? "border-cyan-300 bg-cyan-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-400">⋮⋮</span>
                                  <p className={`text-sm font-semibold ${enabled ? "text-cyan-900" : "text-slate-900"}`}>{section.title}</p>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                                    enabled ? "bg-cyan-100 text-cyan-800" : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {enabled ? "Вкл" : "Выкл"}
                                </span>
                              </div>
                              <p className={`mt-1 text-xs ${enabled ? "text-cyan-800/90" : "text-slate-500"}`}>{section.description}</p>
                              <p className="mt-1 text-[11px] text-slate-400">Перетащите карточку, чтобы изменить порядок блока на сайте.</p>
                              {needsGallery ? <p className="mt-1 text-[11px] text-slate-500">Добавьте фото, чтобы секция выглядела полноценно.</p> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Стиль сайта</p>
                      <h4 className="mt-1 text-base font-bold tracking-tight text-slate-900">Цвета и кабинет на сайте</h4>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="rounded-xl border border-slate-200 bg-white p-3">
                          <span className="block text-xs font-semibold text-slate-600">Основной цвет кнопок</span>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="color"
                              value={sitesAccentColor}
                              onChange={(event) => setSitesAccentColor(event.target.value)}
                              className="h-9 w-12 rounded border border-slate-200 bg-white p-0.5"
                            />
                            <input
                              value={sitesAccentColor}
                              onChange={(event) => setSitesAccentColor(event.target.value)}
                              className="h-9 flex-1 rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700"
                            />
                          </div>
                        </label>
                        <label className="rounded-xl border border-slate-200 bg-white p-3">
                          <span className="block text-xs font-semibold text-slate-600">Цвет фона сайта</span>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="color"
                              value={sitesBaseColor}
                              onChange={(event) => setSitesBaseColor(event.target.value)}
                              className="h-9 w-12 rounded border border-slate-200 bg-white p-0.5"
                            />
                            <input
                              value={sitesBaseColor}
                              onChange={(event) => setSitesBaseColor(event.target.value)}
                              className="h-9 flex-1 rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700"
                            />
                          </div>
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {["#0f172a", "#0369a1", "#1d4ed8", "#166534", "#7c2d12"].map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setSitesAccentColor(preset)}
                            className="h-8 w-8 rounded-full border border-white shadow"
                            style={{ backgroundColor: preset }}
                            aria-label={`Цвет ${preset}`}
                          />
                        ))}
                      </div>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Включить на сайте кнопку «Личный кабинет»</p>
                            <p className="text-xs text-slate-600">Переход с сайта в кабинет через Telegram-авторизацию.</p>
                          </div>
                          <button
                            onClick={() => setSitesCabinetEnabled((prev) => !prev)}
                            className={`rounded-full px-3 py-1 text-xs font-bold ${sitesCabinetEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {sitesCabinetEnabled ? "Включено" : "Выключено"}
                          </button>
                        </div>
                        <label className="mt-2 block">
                          <span className="text-xs font-semibold text-slate-600">Telegram бот для входа</span>
                          <input
                            value={sitesTelegramBot}
                            onChange={(event) => setSitesTelegramBot(event.target.value)}
                            placeholder="@your_business_bot"
                            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Логотип (обязательно)</p>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                            {sitesLogoUrl ? (
                              <img src={sitesLogoUrl} alt="Логотип" className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-[10px] font-semibold text-slate-400">LOGO</span>
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => sitesLogoInputRef.current?.click()}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                            >
                              Загрузить логотип
                            </button>
                            <p className="mt-1 text-[11px] text-slate-500">Без логотипа генерация недоступна.</p>
                          </div>
                        </div>
                        <input
                          ref={sitesLogoInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            void handleSitesLogoUpload(event.target.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Фотографии (до 5, по желанию)</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => sitesGalleryInputRef.current?.click()}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Добавить фото
                          </button>
                          <span className="text-[11px] text-slate-500">{sitesGalleryUrls.length}/5</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Если фото есть, на сайте автоматически появляется секция галереи. Если нет, секция не показывается.
                        </p>
                        {sitesGalleryUrls.length > 0 ? (
                          <div className="mt-2">
                            <div className="grid grid-cols-5 gap-1.5">
                              {sitesGalleryUrls.map((url, index) => (
                                <div key={`${url}-${index}`} className="overflow-hidden rounded-md border border-slate-200 bg-white">
                                  <img src={url} alt={`Фото ${index + 1}`} className="h-10 w-full object-cover" />
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => setSitesGalleryUrls([])}
                              className="mt-2 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                            >
                              Удалить все фото
                            </button>
                          </div>
                        ) : null}
                        <input
                          ref={sitesGalleryInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(event) => {
                            void handleSitesGalleryUpload(event.target.files);
                            event.currentTarget.value = "";
                          }}
                        />
                      </div>
                    </div>
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
                          setSitesSections(defaultSitesSections);
                          setSitesSectionOrder(defaultSitesSectionOrder);
                          setSitesGalleryUrls([]);
                          setSitesLogoUrl("");
                          setSitesAccentColor("#0f172a");
                          setSitesBaseColor("#f8fafc");
                          setSitesCabinetEnabled(true);
                          setSitesTelegramBot("@clientsflow_support_bot");
                          const fallback = buildFallbackSiteContent(selectedSitesTemplate, defaultSitesAnswers);
                          setSitesGeneratedContent(fallback);
                          setSitesProducts(createDefaultSitesProducts(fallback, []));
                          setSitesPreviewTab("home");
                          setSitesFaqOpen(null);
                          setSitesOpenedProductId(null);
                          setSitesProductUploadIndex(null);
                          setDraggedSitesProductId(null);
                          setSitesPublishedUrl("");
                          setSitesFlowStatus("idle");
                          setSitesGenerationProgress(0);
                          setSitesLastGenerationMode(null);
                          setSitesActionMessage("Конструктор и бриф сброшены к стартовым данным. Можно собрать новый вариант.");
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 sm:w-auto"
                      >
                        Сбросить бриф
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Редактор после генерации</p>
                      <h4 className="mt-1 text-base font-bold tracking-tight text-slate-900">Отредактируйте тексты вручную</h4>
                      <div className="mt-3 grid gap-3">
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-600">Заголовок</span>
                          <input
                            value={sitesGeneratedContent.heroTitle}
                            onChange={(event) => updateGeneratedContent("heroTitle", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-600">Подзаголовок</span>
                          <textarea
                            value={sitesGeneratedContent.heroSubtitle}
                            onChange={(event) => updateGeneratedContent("heroSubtitle", event.target.value)}
                            rows={3}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-600">About</span>
                          <textarea
                            value={sitesGeneratedContent.about}
                            onChange={(event) => updateGeneratedContent("about", event.target.value)}
                            rows={4}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {sitesGeneratedContent.valueProps.slice(0, 3).map((item, index) => (
                            <label key={`benefit-edit-${index}`} className="block">
                              <span className="text-xs font-semibold text-slate-600">Преимущество {index + 1}</span>
                              <input
                                value={item}
                                onChange={(event) => updateValueProp(index, event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                            </label>
                          ))}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Товары / услуги</p>
                          <div className="mt-2 space-y-2">
                            {sitesProducts.map((product, index) => (
                              <div
                                key={product.id}
                                draggable
                                onDragStart={() => setDraggedSitesProductId(product.id)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  if (!draggedSitesProductId) return;
                                  reorderSitesProducts(draggedSitesProductId, product.id);
                                  setDraggedSitesProductId(null);
                                }}
                                onDragEnd={() => setDraggedSitesProductId(null)}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-xs text-slate-400">⋮⋮ Перетащите для сортировки</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSitesProductUploadIndex(index);
                                      sitesProductImageInputRef.current?.click();
                                    }}
                                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                                  >
                                    Загрузить фото
                                  </button>
                                </div>
                                <div className="mb-2 h-16 overflow-hidden rounded-md border border-slate-200 bg-white">
                                  {product.images[0] ? <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-slate-100" />}
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <input
                                    value={product.title}
                                    onChange={(event) => updateSitesProduct(index, "title", event.target.value)}
                                    placeholder="Название"
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                  />
                                  <input
                                    value={product.price}
                                    onChange={(event) => updateSitesProduct(index, "price", event.target.value)}
                                    placeholder="Цена"
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                  />
                                </div>
                                <textarea
                                  value={product.description}
                                  onChange={(event) => updateSitesProduct(index, "description", event.target.value)}
                                  rows={2}
                                  placeholder="Описание товара"
                                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                                <input
                                  value={product.ctaText}
                                  onChange={(event) => updateSitesProduct(index, "ctaText", event.target.value)}
                                  placeholder="Текст кнопки"
                                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                              </div>
                            ))}
                          </div>
                          <input
                            ref={sitesProductImageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              void handleSitesProductImageUpload(event.target.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                          />
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">FAQ</p>
                          <div className="mt-2 space-y-2">
                            {sitesGeneratedContent.faq.map((item, index) => (
                              <div key={`faq-edit-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                <input
                                  value={item.q}
                                  onChange={(event) => updateFaqItem(index, "q", event.target.value)}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                                <textarea
                                  value={item.a}
                                  onChange={(event) => updateFaqItem(index, "a", event.target.value)}
                                  rows={2}
                                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
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

                    <div className={`mt-4 overflow-hidden rounded-2xl border border-slate-200 ${selectedSitesTemplate.previewTheme.surface}`} style={{ backgroundColor: sitesBaseColor }}>
                      <div className="relative h-[760px] overflow-y-auto pb-20">
                        <div className="border-b border-slate-200 bg-white px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                                {sitesLogoUrl ? (
                                  <img src={sitesLogoUrl} alt="Логотип сайта" className="h-full w-full object-contain" />
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-400">LOGO</span>
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-slate-500">{selectedSitesTemplate.name}</p>
                                <p className="text-sm font-bold text-slate-900">{sitesAnswers.businessName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                {sitesAnswers.city || "Город"}
                              </span>
                              {contactsIcons.map((icon) => (
                                <span key={icon} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-600">
                                  {icon}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="px-4 py-6" style={{ backgroundColor: sitesHeroBackground }}>
                          <p className="text-xs font-semibold text-slate-700">{selectedSitesTemplate.heroPattern}</p>
                          <h4 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">{generatedSitesHeadline}</h4>
                          <p className="mt-2 max-w-xl text-sm text-slate-700">{generatedSitesSubheadline}</p>
                          {sitesSections.about && sitesPreviewTab === "home" ? (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">About</p>
                              <p className="mt-1 text-sm leading-6 text-slate-700">{sitesGeneratedContent.about}</p>
                            </div>
                          ) : null}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <button className="rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: sitesAccentPreview }}>
                              {sitesGeneratedContent.primaryCta}
                            </button>
                            <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                              {sitesGeneratedContent.secondaryCta}
                            </button>
                            {sitesCabinetEnabled ? (
                              <button className="rounded-full border px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: sitesAccentPreview, borderColor: sitesAccentPreview }}>
                                Войти через Telegram
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            {sitesGeneratedContent.trustStats.map((item) => (
                              <div key={item.label} className="rounded-xl border border-white/60 bg-white/80 p-2.5">
                                <p className="text-[11px] text-slate-500">{item.label}</p>
                                <p className="text-sm font-bold text-slate-900">{item.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {openedSitesProduct ? (
                          <div className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-slate-900">{openedSitesProduct.title}</p>
                                <p className="text-xs text-slate-500">{openedSitesProduct.price}</p>
                              </div>
                              <button onClick={() => setSitesOpenedProductId(null)} className="text-sm font-semibold text-slate-500">✕</button>
                            </div>
                            {openedSitesProduct.images[0] ? (
                              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                                <img src={openedSitesProduct.images[0]} alt={openedSitesProduct.title} className="h-36 w-full object-cover" />
                              </div>
                            ) : null}
                            <p className="mt-2 text-sm text-slate-700">{openedSitesProduct.description}</p>
                            <button className="mt-3 rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: sitesAccentPreview }}>
                              {openedSitesProduct.ctaText}
                            </button>
                          </div>
                        ) : null}

                        <div className="space-y-3 p-4">
                          {sitesSectionOrder.map((key) => {
                            const content = renderSitesPreviewSection(key);
                            if (!content) return null;
                            return <div key={key}>{content}</div>;
                          })}
                          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                            <p className="text-sm font-semibold text-slate-900">{sitesGeneratedContent.finalCtaTitle}</p>
                            <p className="mt-1 text-xs text-slate-700">{sitesGeneratedContent.finalCtaText}</p>
                            <p className="mt-2 text-[11px] text-slate-600">{sitesGeneratedContent.contactLine}</p>
                          </div>
                        </div>

                        <div className="sticky bottom-3 z-20 flex justify-center px-4">
                          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
                            {previewTabs.map((tab) => (
                              <button
                                key={tab.id}
                                onClick={() => setSitesPreviewTab(tab.id)}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                  sitesPreviewTab === tab.id ? "text-white" : "text-slate-700"
                                }`}
                                style={sitesPreviewTab === tab.id ? { backgroundColor: sitesAccentPreview } : undefined}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {!sitesPayment.paid ? (
                        <button
                          onClick={() => {
                            setSitesPaymentModalOpen(true);
                            setSitesPaymentState("idle");
                          }}
                          className="w-full rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-900 transition hover:border-cyan-500 sm:w-auto"
                        >
                          Оплатить 3 500 ₽
                        </button>
                      ) : null}
                      <button
                        onClick={async () => {
                          if (sitesPublishing) return;
                          if (!sitesLogoUrl) {
                            setSitesActionMessage("Публикация невозможна без логотипа. Загрузите логотип в брифе.");
                            return;
                          }
                          if (!sitesPayment.paid) {
                            setSitesActionMessage("Сначала оплатите 3 500 ₽ в карточке стоимости, затем публикация станет доступна.");
                            setSitesPaymentModalOpen(true);
                            return;
                          }
                          if (!sitesAnswers.businessName.trim()) {
                            setSitesActionMessage("Укажите название бизнеса в брифе, чтобы сформировать публикацию.");
                            return;
                          }
                          setSitesPublishing(true);
                          setSitesActionMessage("Публикуем сайт на домене...");
                          try {
                            const response = await fetch("/api/sites/publish", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                businessName: sitesAnswers.businessName,
                                city: sitesAnswers.city,
                                logoUrl: sitesLogoUrl,
                                accentColor: sitesAccentColor,
                                baseColor: sitesBaseColor,
                                heroTitle: sitesGeneratedContent.heroTitle,
                                heroSubtitle: sitesGeneratedContent.heroSubtitle,
                                about: sitesGeneratedContent.about,
                                primaryCta: sitesGeneratedContent.primaryCta,
                                secondaryCta: sitesGeneratedContent.secondaryCta,
                                trustStats: sitesGeneratedContent.trustStats,
                                valueProps: sitesGeneratedContent.valueProps,
                                processSteps: sitesGeneratedContent.processSteps,
                                testimonials: sitesGeneratedContent.testimonials,
                                faq: sitesGeneratedContent.faq,
                                contactLine: sitesGeneratedContent.contactLine,
                                products: sitesProducts,
                                sections: sitesSections,
                                sectionOrder: sitesSectionOrder,
                                galleryUrls: sitesGalleryUrls,
                                cabinetEnabled: sitesCabinetEnabled,
                                telegramBot: sitesTelegramBot
                              })
                            });
                            const data = (await response.json()) as { slug?: string; url?: string; error?: string };
                            if (!response.ok || !data.url) {
                              throw new Error(data.error || "Не удалось опубликовать сайт");
                            }
                            setSitesFlowStatus("published");
                            setSitesGenerationProgress(100);
                            setSitesPublishedUrl(data.url);
                            setSitesActionMessage(`Сайт опубликован: ${data.url}`);
                            window.open(data.url, "_blank", "noopener,noreferrer");
                          } catch (error: any) {
                            setSitesActionMessage(error?.message || "Ошибка публикации сайта");
                          } finally {
                            setSitesPublishing(false);
                          }
                        }}
                        disabled={sitesPublishing}
                        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        {sitesPublishing ? "Публикуем сайт..." : "Опубликовать и передать менеджеру"}
                      </button>
                      <button
                        onClick={() => handleNavChange("Диалоги")}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500 sm:w-auto"
                      >
                        Открыть AI Inbox
                      </button>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      При оплате сайта за 3 500 ₽ менеджер бесплатно подключит и настроит привязку к Telegram-боту.
                    </p>
                    {!sitesPayment.paid ? <p className="mt-1 text-xs font-semibold text-amber-700">Публикация откроется сразу после оплаты.</p> : null}
                    {sitesPublishedUrl ? (
                      <a href={sitesPublishedUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-cyan-700 underline">
                        Открыть опубликованный сайт
                      </a>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Экосистема</p>
                  <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Как Sites работает вместе с CFlow</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-cyan-200 bg-white p-3 text-sm text-slate-700">1. Публикуете сайт за 5 минут</div>
                    <div className="rounded-xl border border-cyan-200 bg-white p-3 text-sm text-slate-700">2. Получаете входящие заявки с формы</div>
                    <div className="rounded-xl border border-cyan-200 bg-white p-3 text-sm text-slate-700">3. CFlow квалифицирует и ведет к записи</div>
                    <div className="rounded-xl border border-cyan-200 bg-white p-3 text-sm text-slate-700">4. Вся аналитика и конверсия в одном дашборде</div>
                  </div>
                </section>
                  </>
                )}
              </div>
              {sitesPaymentModalOpen ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Оплата CFlow Sites</p>
                        <h3 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">3 500 ₽ за 1 сайт</h3>
                        <p className="mt-1 text-sm text-slate-600">Оплата открывает публикацию и передачу проекта менеджеру.</p>
                      </div>
                      <button
                        onClick={() => {
                          if (sitesPaymentState === "processing") return;
                          setSitesPaymentModalOpen(false);
                        }}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-semibold text-slate-500 hover:border-slate-300"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">Бонус при оплате</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-900">
                        Бесплатная настройка и привязка к Telegram-боту через менеджера.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <label className="text-sm font-semibold text-slate-700">
                        Имя владельца карты
                        <input
                          value={sitesPaymentName}
                          onChange={(event) => setSitesPaymentName(event.target.value)}
                          className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
                          placeholder="Иван Петров"
                        />
                      </label>
                      <label className="text-sm font-semibold text-slate-700">
                        Номер карты
                        <input
                          value={sitesPaymentCard}
                          onChange={(event) => setSitesPaymentCard(event.target.value)}
                          className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
                          placeholder="4242 4242 4242 4242"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-sm font-semibold text-slate-700">
                          Срок
                          <input
                            value={sitesPaymentExpiry}
                            onChange={(event) => setSitesPaymentExpiry(event.target.value)}
                            className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
                            placeholder="12/29"
                          />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          CVV
                          <input
                            value={sitesPaymentCvv}
                            onChange={(event) => setSitesPaymentCvv(event.target.value)}
                            className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500"
                            placeholder="123"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button
                        onClick={() => {
                          if (sitesPaymentState === "processing") return;
                          setSitesPaymentModalOpen(false);
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={startSitesPayment}
                        disabled={sitesPaymentState === "processing" || sitesPaymentState === "success"}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sitesPaymentState === "processing"
                          ? "Обрабатываем..."
                          : sitesPaymentState === "success"
                          ? "Оплата прошла успешно"
                          : "Оплатить 3 500 ₽"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              </>
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
                {showSettingsSetupWizard ? (
                  <section className="relative min-h-[78vh] overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 p-4 shadow-sm sm:p-6">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_15%_15%,rgba(56,189,248,0.26),transparent_60%),radial-gradient(60%_80%_at_85%_0%,rgba(59,130,246,0.2),transparent_60%),radial-gradient(40%_60%_at_50%_100%,rgba(14,165,233,0.18),transparent_60%)]" />
                    <div className="relative mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center">
                      <div className="w-full rounded-3xl border border-slate-700 bg-slate-900/95 p-5 shadow-2xl sm:p-7">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-300">Настройка CFlow</p>
                            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Подключение и запуск</h2>
                          </div>
                          <div className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
                            Шаг {settingsSetupStep} / 4
                          </div>
                        </div>

                        {settingsSetupStep === 1 ? (
                          <div>
                            <p className="text-sm text-slate-300">Сначала подключим рабочие каналы, с которыми будет работать система.</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {["Telegram", "Instagram", "WhatsApp"].map((channel) => (
                                <button
                                  key={channel}
                                  onClick={() => setSettingsChannels((prev) => toggleChoice(prev, channel))}
                                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                                    settingsChannels.includes(channel)
                                      ? "bg-cyan-500 text-slate-950"
                                      : "border border-slate-600 bg-slate-800 text-slate-200"
                                  }`}
                                >
                                  {channel}
                                </button>
                              ))}
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2">
                              <button
                                onClick={() => {
                                  if (settingsChannels.length === 0) {
                                    triggerNotice("Выберите хотя бы один канал.");
                                    return;
                                  }
                                  setSettingsSetupStep(2);
                                }}
                                className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950"
                              >
                                Далее
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {settingsSetupStep === 2 ? (
                          <div>
                            <p className="text-sm text-slate-300">
                              Ответьте на вопросы о бизнесе, чтобы система понимала контекст и отвечала по вашей логике.
                            </p>
                            <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
                              <p className="text-xs font-bold uppercase tracking-[0.08em] text-cyan-300">
                                Вопрос {settingsQuestionIndex + 1} из {SETTINGS_QUESTIONS.length}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-white">{currentSettingsQuestion.question}</p>
                              <textarea
                                value={settingsBusinessAnswers[currentSettingsQuestion.id] || ""}
                                onChange={(event) =>
                                  setSettingsBusinessAnswers((prev) => ({ ...prev, [currentSettingsQuestion.id]: event.target.value }))
                                }
                                rows={4}
                                className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-400"
                                placeholder="Введите ответ"
                              />
                            </div>
                            <p className="mt-2 text-xs text-slate-400">Заполнено: {answeredSettingsQuestions} / {SETTINGS_QUESTIONS.length}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => {
                                  if (settingsQuestionIndex === 0) setSettingsSetupStep(1);
                                  else setSettingsQuestionIndex((prev) => Math.max(0, prev - 1));
                                }}
                                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200"
                              >
                                Назад
                              </button>
                              <button
                                onClick={() => {
                                  if (!(settingsBusinessAnswers[currentSettingsQuestion.id] || "").trim()) {
                                    triggerNotice("Нужен ответ на текущий вопрос.");
                                    return;
                                  }
                                  if (settingsQuestionIndex < SETTINGS_QUESTIONS.length - 1) {
                                    setSettingsQuestionIndex((prev) => prev + 1);
                                    return;
                                  }
                                  void goToSettingsStepThree();
                                }}
                                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
                              >
                                {settingsQuestionIndex < SETTINGS_QUESTIONS.length - 1 ? "Следующий вопрос" : "Сформировать профиль"}
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {settingsSetupStep === 3 ? (
                          <div>
                            <p className="text-sm text-slate-300">Краткая выжимка по вашему бизнесу для настройки сценариев ответов.</p>
                            <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-800 p-4">
                              {settingsSummaryLoading ? (
                                <p className="text-sm text-slate-300">Формируем профиль бизнеса...</p>
                              ) : (
                                <textarea
                                  value={settingsSummary}
                                  onChange={(event) => setSettingsSummary(event.target.value)}
                                  rows={10}
                                  className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm leading-relaxed text-slate-100"
                                />
                              )}
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => setSettingsSetupStep(2)}
                                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200"
                              >
                                Назад
                              </button>
                              <button
                                onClick={() => void generateBusinessSummaryForSetup()}
                                disabled={settingsSummaryLoading}
                                className="rounded-xl border border-cyan-400 bg-transparent px-4 py-2 text-sm font-semibold text-cyan-300 disabled:opacity-60"
                              >
                                Перегенерировать
                              </button>
                              <button
                                onClick={() => setSettingsSetupStep(4)}
                                disabled={settingsSummaryLoading || settingsSummary.trim().length < 120}
                                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                              >
                                Далее к тарифу
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {settingsSetupStep === 4 ? (
                          <div>
                            <p className="text-sm text-slate-300">Выберите тариф и завершите запуск. После этого откроется полный экран настроек.</p>
                            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                              {planDefinitions.map((plan) => (
                                <button
                                  key={`setup-${plan.id}`}
                                  onClick={() => {
                                    setCheckoutPlanId(plan.id);
                                    setCheckoutState("idle");
                                  }}
                                  className={`rounded-2xl border p-3 text-left transition ${
                                    checkoutPlanId === plan.id
                                      ? "border-cyan-400 bg-cyan-500/10"
                                      : "border-slate-700 bg-slate-800 hover:border-slate-500"
                                  }`}
                                >
                                  <p className="text-sm font-bold text-white">{plan.title}</p>
                                  <p className="mt-1 text-base font-extrabold text-slate-100">{plan.priceLabel}</p>
                                  <p className="mt-1 text-xs text-slate-300">{plan.description}</p>
                                </button>
                              ))}
                            </div>

                            {checkoutPlanId && checkoutPlanId !== "trial" ? (
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <input value={checkoutCardholder} onChange={(e) => setCheckoutCardholder(e.target.value)} placeholder="Имя держателя" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100" />
                                <input value={checkoutCardNumber} onChange={(e) => setCheckoutCardNumber(e.target.value)} placeholder="Номер карты" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100" />
                                <input value={checkoutExpiry} onChange={(e) => setCheckoutExpiry(e.target.value)} placeholder="Срок" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100" />
                                <input value={checkoutCvv} onChange={(e) => setCheckoutCvv(e.target.value)} placeholder="CVV" className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100" />
                              </div>
                            ) : null}

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => setSettingsSetupStep(3)}
                                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200"
                              >
                                Назад
                              </button>
                              <button
                                onClick={() => {
                                  if (!checkoutPlanId) {
                                    triggerNotice("Выберите тариф для продолжения.");
                                    return;
                                  }
                                  completeSettingsSetupWithPlan(checkoutPlanId);
                                }}
                                disabled={checkoutState === "processing"}
                                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                              >
                                {checkoutState === "processing" ? "Обработка оплаты..." : "Завершить запуск"}
                              </button>
                              <button
                                onClick={resetSettingsSetup}
                                className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200"
                              >
                                Начать заново
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </section>
                ) : (
                  <>
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Источник данных</p>
                  <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Подключить свой сервис</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Личный кабинет считает метрики только по вашим событиям сообщений. Поддерживается синхронизация через endpoint и импорт JSON.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Название сервиса</span>
                      <input
                        value={serviceConnection.serviceName}
                        onChange={(event) => setServiceConnection((prev) => ({ ...prev, serviceName: event.target.value }))}
                        placeholder="Например: Telegram Sales Bot"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Endpoint событий</span>
                      <input
                        value={serviceConnection.endpoint}
                        onChange={(event) => setServiceConnection((prev) => ({ ...prev, endpoint: event.target.value }))}
                        placeholder="https://your-service.com/events"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      />
                      <span className="mt-1 block text-[11px] text-slate-500">Нужен API URL, который возвращает JSON-события, а не ссылка на Telegram-канал.</span>
                    </label>
                    <label className="md:col-span-2">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">API Token (опционально)</span>
                      <input
                        value={serviceConnection.token}
                        onChange={(event) => setServiceConnection((prev) => ({ ...prev, token: event.target.value }))}
                        placeholder="Bearer token"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="md:col-span-2">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Telegram Bot Token</span>
                      <input
                        value={serviceConnection.botToken}
                        onChange={(event) => setServiceConnection((prev) => ({ ...prev, botToken: event.target.value }))}
                        placeholder="123456789:AA..."
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="md:col-span-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={serviceConnection.autoReplyEnabled}
                        onChange={(event) => setServiceConnection((prev) => ({ ...prev, autoReplyEnabled: event.target.checked }))}
                      />
                      <span className="text-sm text-slate-700">Автоответ в Telegram включен</span>
                    </label>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      onClick={() => void syncServiceEvents()}
                      disabled={serviceSyncLoading}
                      className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                    >
                      {serviceSyncLoading ? "Синхронизация..." : "Синхронизировать"}
                    </button>
                    <button
                      onClick={() => void syncTelegramBotEvents()}
                      disabled={serviceSyncLoading}
                      className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                    >
                      {serviceSyncLoading ? "Синхронизация..." : "Синхронизировать Telegram"}
                    </button>
                    <button
                      onClick={() => serviceImportRef.current?.click()}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto"
                    >
                      Импорт JSON
                    </button>
                    <button
                      onClick={() => {
                        setServiceEvents([]);
                        setServiceConnection((prev) => ({ ...prev, connectedAt: null }));
                        triggerNotice("Данные сервиса очищены.");
                      }}
                      className="w-full rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 sm:w-auto"
                    >
                      Очистить данные
                    </button>
                  </div>
                  <input
                    ref={serviceImportRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(event) => {
                      void importServiceEvents(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                  <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-xs text-cyan-900">
                    Событий в системе: <span className="font-bold">{serviceEvents.length}</span>
                    <span> • Telegram offset: {telegramOffset}</span>
                    {serviceConnection.connectedAt ? (
                      <span> • Последняя синхронизация: {new Date(serviceConnection.connectedAt).toLocaleString("ru-RU")}</span>
                    ) : (
                      <span> • Синхронизация ещё не выполнялась</span>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Профиль бизнеса</p>
                      <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Текущая выжимка для ответов</h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Профиль формируется в мастере настройки и используется в ответах по всем подключенным каналам.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSubscription((prev) => ({ ...prev, onboardingCompleted: false }));
                        resetSettingsSetup();
                        triggerNotice("Мастер настройки перезапущен.");
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      Перезапустить мастер
                    </button>
                  </div>
                  <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
                    {subscription.onboardingData?.profileSummary?.trim()
                      ? subscription.onboardingData.profileSummary
                      : "Профиль пока не сформирован. Запустите мастер настройки."}
                  </div>
                </section>

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
                    <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Запуск AI-системы CFlow</h3>
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
                          <button onClick={() => finishOnboarding()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                            Завершить запуск
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}
                  </>
                )}
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
                      {overviewLeadDays.map((d) => (
                        <span key={d}>{d}</span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Воронка лидов</p>
                    <div className="mt-4 space-y-4">
                      {overviewFunnel.map((step) => (
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
                      {recentConversationsLive.map((c) => (
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
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">CFlow Sites</p>
                      <h3 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Сайт за 5 минут + автоворонка лидов</h3>
                      <p className="mt-2 text-sm text-slate-700">
                        Клиент выбирает шаблон, заполняет данные бизнеса, получает AI-переписанный сайт и сразу передает лиды в CFlow.
                      </p>
                      <div className="mt-3 grid gap-2">
                        <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs text-slate-700">1. Шаблон + данные бизнеса</div>
                        <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs text-slate-700">2. AI генерирует контент и структуру</div>
                        <div className="rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs text-slate-700">3. Публикация и обработка входящих в AI Inbox</div>
                      </div>
                      <div className="mt-3 flex flex-col items-start justify-between gap-2 text-xs text-slate-700 sm:flex-row sm:items-center">
                        <span>Фиксированная цена: <span className="font-semibold text-slate-900">3 500 ₽</span></span>
                        <button
                          onClick={() => {
                            if (onNavigate) onNavigate("/sites");
                            else handleNavChange("CFlow Sites");
                          }}
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

          {showFullTimeline && selectedConversation ? (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-3">
              <div className="flex h-[88vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedConversation.client}</p>
                    <p className="text-xs text-slate-500">
                      {selectedConversation.channel} • Полная переписка • {selectedConversation.timeline.length} сообщений
                    </p>
                  </div>
                  <button
                    onClick={() => setShowFullTimeline(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Закрыть
                  </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
                  {selectedConversation.timeline.map((msg, idx) => (
                    <div key={`full-${msg.time}-${idx}`} className={`rounded-xl px-3 py-2 text-sm ${roleBubbleClass(msg.role)}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70">
                        {msg.role === "client" ? "Клиент" : msg.role === "ai" ? "AI" : "Менеджер"} • {msg.time}
                      </p>
                      <p className="mt-1 leading-relaxed">{msg.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

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
