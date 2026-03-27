import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import DashboardApp from "./DashboardApp";
import SitesBuilderPage from "./sites/ChatSitesBuilderPage";
import WorkbenchApp from "./WorkbenchApp";
import {
  AUTH_KEY,
  WORKBENCH_AUTH_KEY,
  clearAuthSession,
  isAuthenticatedClient,
  loginWithPassword,
  logoutCurrentSession,
  refreshSessionFromToken,
  registerWithPassword,
  requestPasswordReset,
  sendMagicLink
} from "./core/auth/context";

type RoutePath = "/" | "/login" | "/dashboard" | "/pricing" | "/workbench" | "/sites" | `/s/${string}` | `/sites/preview/${string}`;

type ChatRole = "assistant" | "user";
type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  kind?: "text" | "image" | "voice" | "cta";
  imageUrl?: string;
};

type ApiChatMessage = {
  role: "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

type WebsiteBriefPreview = {
  businessType?: string;
  city?: string;
  brandName?: string;
  primaryGoal?: string;
  primaryCTA?: string;
};

type WebsiteGenerationMeta = {
  totalMs?: number;
  canRepair?: boolean;
  promptPack?: "A" | "B";
  action?: string;
};

type WebsiteFixLogItem = {
  at: string;
  attempt: number;
  error: string;
  status: "started" | "failed" | "succeeded";
  note?: string;
};

function humanizeWebsiteUiError(raw: string) {
  const text = String(raw || "").toLowerCase();
  if (
    text.includes("function_invocation_timeout") ||
    text.includes("gateway timeout") ||
    text.includes("status 504") ||
    text.includes("openrouter timeout")
  ) {
    return "Сервис генерации временно отвечает слишком долго.";
  }
  if (
    text.includes("invalid_json_response") ||
    text.includes("json parse") ||
    text.includes("unexpected token") ||
    text.includes("code_schema_validation_failed") ||
    text.includes("brief_schema_validation_failed")
  ) {
    return "Не удалось сгенерировать сайт с первого раза. Попробуйте ещё раз.";
  }
  if (
    text.includes("build/runtime error") ||
    text.includes("component not found") ||
    text.includes("babel") ||
    text.includes("syntaxerror")
  ) {
    return "Не получилось собрать preview. Можно попробовать автоисправление.";
  }
  return "Не удалось сгенерировать сайт с первого раза. Попробуйте ещё раз.";
}

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

function SitesWordmark() {
  return <span className="font-semibold">Cflow Sites</span>;
}

const navLinks = [
  { id: "problem", label: "Результат" },
  { id: "offer", label: "Что получаете" },
  { id: "demo", label: "Демо" },
  { id: "cases", label: "Кейсы" },
  { id: "cta", label: "Запуск" }
];

const managerQuickQuestions = [
  "Что такое CFlow?",
  "Чем полезен CFlow Sites?",
  "Сколько занимает запуск?"
];


const demoOutcomes = [
  "Первый ответ клиенту за секунды",
  "Автодоведение до записи",
  "Контроль потерь в деньгах"
];

const offerTiles = [
  {
    layout: "hero",
    kicker: "Первый контакт",
    title: "AI отвечает на входящие",
    text: "Каждое новое сообщение получает быстрый и понятный ответ без ожидания. Клиент не уходит к конкуренту, пока вы заняты."
  },
  {
    layout: "compact",
    kicker: "Качество лида",
    title: "Квалифицирует лидов",
    text: "Система уточняет задачу клиента и отделяет горячие заявки от случайных обращений."
  },
  {
    layout: "wide",
    kicker: "Продажи",
    title: "Доводит до записи или заявки",
    text: "Диалог не обрывается на середине: клиент получает конкретный следующий шаг и подтверждение."
  },
  {
    layout: "compact",
    kicker: "Возврат диалогов",
    title: "Запускает follow-up",
    text: "Если клиент замолчал, CFlow аккуратно напоминает о себе и возвращает диалог в работу."
  },
  {
    layout: "focus",
    kicker: "Контроль денег",
    title: "Показывает аналитику и потери",
    text: "Вы сразу видите, где теряются деньги, какие этапы проседают и что улучшить в первую очередь."
  },
  {
    layout: "compact",
    kicker: "Передача в работу",
    title: "Передаёт лиды в CRM или менеджеру",
    text: "Готовые лиды уходят в нужный канал без ручной рутины и потерь между системами."
  }
];

const caseStories = [
  {
    business: "Салон красоты",
    problem: "Отвечали клиентам с задержкой 30–60 минут, часть заявок уходила к конкурентам.",
    action: "CFlow начал отвечать сразу, уточнять услугу и подводить клиента к записи в один диалог.",
    result: "+15% записей за 30 дней"
  },
  {
    business: "Клиника",
    problem: "Лиды спрашивали цену и пропадали без следующего шага.",
    action: "Система давала понятный ответ по стоимости и предлагала ближайшее окно для визита.",
    result: "Конверсия в запись: 18% -> 27%"
  },
  {
    business: "Онлайн-школа",
    problem: "После вопроса по тарифам пользователи зависали и не доходили до оплаты.",
    action: "CFlow запускал follow-up с нужным тарифом и закрывал частые возражения автоматически.",
    result: "+22% оплат с диалогов"
  },
  {
    business: "Агентство недвижимости",
    problem: "Менеджеры тратили время на первичный отсев нецелевых обращений.",
    action: "AI проводил первичную квалификацию и передавал в работу только релевантные лиды.",
    result: "-34% нагрузки на менеджеров"
  }
];

const faqItems = [
  {
    question: "Как быстро можно запустить CFlow?",
    answer: "Базовый запуск обычно занимает от 1 до 3 дней: подключаем каналы, согласуем сценарии ответов и включаем аналитику."
  },
  {
    question: "Какие каналы можно подключить?",
    answer: "Можно подключить Telegram, WhatsApp, Instagram Direct и другие источники входящих сообщений в единую систему."
  },
  {
    question: "Нужен ли свой менеджер или AI работает сам?",
    answer: "AI берет на себя первичные ответы, квалификацию и follow-up. Менеджер подключается на важных этапах и финальном согласовании."
  },
  {
    question: "Можно ли передавать лиды в CRM?",
    answer: "Да. Лиды и статусы можно передавать в CRM или напрямую менеджеру, чтобы команда работала в привычном процессе."
  },
  {
    question: "Как считается эффективность?",
    answer: "В кабинете видно скорость ответа, конверсию по этапам, недополученную выручку и динамику по периодам."
  },
  {
    question: "Подходит ли это для малого бизнеса?",
    answer: "Да. CFlow подходит и для небольших команд, когда важно не терять заявки при ограниченных ресурсах."
  },
  {
    question: "Можно ли настроить ответы под мою нишу?",
    answer: "Да. Мы адаптируем тон, скрипты и логику под ваш бизнес: услуги, цены, частые вопросы и сценарии продаж."
  },
  {
    question: "Что входит в демо?",
    answer: "Показываем живой сценарий обработки лидов, логику доведения до записи и дашборд с ключевыми метриками."
  }
];

const audienceSegments = [
  {
    title: "Салоны и клиники",
    request: "«Сколько стоит и когда можно записаться?»",
    loss: "Клиент уходит, если ответ пришёл поздно или без конкретного окна.",
    help: "CFlow отвечает сразу, уточняет услугу и доводит до подтвержденной записи."
  },
  {
    title: "Онлайн-школы",
    request: "«Какой тариф мне подойдет и когда старт?»",
    loss: "После вопроса о цене диалог зависает и не доходит до оплаты.",
    help: "Система подбирает оффер, закрывает частые вопросы и запускает follow-up."
  },
  {
    title: "Агентства услуг",
    request: "«Сколько стоит проект и что входит?»",
    loss: "Лиды теряются между менеджерами и долгими первыми ответами.",
    help: "CFlow проводит первичную квалификацию и передает менеджеру готовый лид."
  },
  {
    title: "Недвижимость",
    request: "«Есть ли похожий объект и какая цена?»",
    loss: "Входящий поток большой, менеджеры не успевают быстро обработать запросы.",
    help: "AI собирает базовые параметры, отсеивает нерелевантные обращения и ускоряет работу команды."
  },
  {
    title: "Локальный сервисный бизнес",
    request: "«Когда можете приехать и сколько это стоит?»",
    loss: "Заявки из мессенджеров теряются, особенно вечером и в выходные.",
    help: "CFlow принимает входящие 24/7, фиксирует лиды и ведет клиента к заявке."
  },
  {
    title: "E-commerce с входящими запросами",
    request: "«Есть ли в наличии и когда доставка?»",
    loss: "Покупатели не получают быстрый ответ и уходят на другой магазин.",
    help: "Система отвечает по наличию и доставке, возвращает молчащих клиентов повторным касанием."
  }
];

const platformModules = [
  {
    title: "AI Inbox",
    description: "Все входящие диалоги в одном окне: видно, кто написал и на каком этапе находится клиент."
  },
  {
    title: "Квалификация лидов",
    description: "Система задает нужные вопросы и отделяет целевые обращения от случайных."
  },
  {
    title: "Follow-up сценарии",
    description: "Если клиент не ответил, CFlow автоматически возвращает его в диалог аккуратными касаниями."
  },
  {
    title: "Аналитика",
    description: "Показывает динамику заявок, скорость ответа и этапы, где проседает конверсия."
  },
  {
    title: "Потерянные лиды",
    description: "Вы сразу видите, какие заявки ушли и сколько денег бизнес недополучил."
  },
  {
    title: "AI рекомендации",
    description: "Платформа подсказывает, что именно изменить в сценариях, чтобы вернуть конверсию."
  },
  {
    title: "CRM передача",
    description: "Готовые лиды передаются в CRM или менеджеру без ручного копирования данных."
  },
  {
    title: "Управление статусами",
    description: "Каждому лиду присваивается понятный статус, чтобы команда не теряла контекст."
  }
];

function normalizePath(pathname: string): RoutePath {
  if (pathname.startsWith("/sites/preview/")) return pathname as `/sites/preview/${string}`;
  if (pathname.startsWith("/s/")) return pathname as `/s/${string}`;
  if (pathname === "/login") return "/login";
  if (pathname === "/dashboard") return "/dashboard";
  if (pathname === "/pricing") return "/pricing";
  if (pathname === "/workbench") return "/workbench";
  if (pathname === "/sites") return "/sites";
  return "/";
}

type TemporaryPreviewData = {
  id: string;
  createdAt: string;
  title?: string;
  pageCode: string;
};

function loadTempPreview(id: string): TemporaryPreviewData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`clientsflow_temp_preview:${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TemporaryPreviewData;
    if (!parsed || typeof parsed !== "object" || typeof parsed.pageCode !== "string" || !parsed.pageCode.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

type PublishedSiteData = {
  slug: string;
  payload: {
    businessName: string;
    city?: string;
    logoUrl: string;
    accentColor: string;
    baseColor: string;
    heroTitle: string;
    heroSubtitle: string;
    about: string;
    primaryCta: string;
    secondaryCta: string;
    trustStats: Array<{ label: string; value: string }>;
    valueProps: string[];
    processSteps: string[];
    testimonials: Array<{ name: string; role: string; text: string }>;
    faq: Array<{ q: string; a: string }>;
    contactLine: string;
    products: Array<{ id: string; title: string; price: string; description: string; ctaText: string; images: string[] }>;
    sections: Record<string, boolean>;
    sectionOrder: string[];
    galleryUrls: string[];
    cabinetEnabled: boolean;
    telegramBot: string;
    socialLinks?: {
      telegram?: string;
      whatsapp?: string;
      instagram?: string;
    };
    theme?: {
      fontHeading?: string;
      fontBody?: string;
      density?: "airy" | "balanced" | "compact";
      radius?: "soft" | "rounded" | "sharp";
      contrast?: "soft" | "medium" | "high";
    };
    layoutSpec?: Array<{
      id?: string;
      type?: string;
      variant?: string;
      title?: string;
      subtitle?: string;
      primaryCta?: string;
      secondaryCta?: string;
      body?: string;
      line?: string;
      items?: Array<Record<string, unknown>>;
    }>;
    pageDsl?: Array<{
      id?: string;
      type?: string;
      variant?: string;
      title?: string;
      subtitle?: string;
      primaryCta?: string;
      secondaryCta?: string;
      body?: string;
      line?: string;
      items?: Array<Record<string, unknown>>;
    }>;
    pageCode?: string;
  };
};

function loadLocalPublishedSite(slug: string): PublishedSiteData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`clientsflow_local_published_site:${slug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublishedSiteData;
    if (!parsed || typeof parsed !== "object" || typeof parsed.slug !== "string" || !parsed.payload) return null;
    return parsed;
  } catch {
    return null;
  }
}

function useRoute(): [RoutePath, (path: RoutePath) => void] {
  const [path, setPath] = useState<RoutePath>(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const handlePop = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const navigate = (next: RoutePath) => {
    if (window.location.pathname !== next) {
      window.history.pushState({}, "", next);
    }
    setPath(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return [path, navigate];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatSalesReply(text: string) {
  const noMarkdown = text
    .replace(/[*#`_~]/g, "")
    .replace(/\[(.*?)\]/g, "$1")
    .replace(/[()]/g, "")
    .replace(/---+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const noTechWords = noMarkdown
    .replace(/\bAI\b/gi, "специалист")
    .replace(/\bИИ\b/gi, "специалист")
    .replace(/нейросеть/gi, "система")
    .replace(/искусственный интеллект/gi, "система")
    .replace(/чат-бот/gi, "сервис")
    .replace(/\bбот\b/gi, "сервис")
    .replace(/ассистент/gi, "специалист");

  const withoutStep = noTechWords.replace(/следующий шаг\s*:\s*.*/gi, "").trim();
  const sentences = withoutStep
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  const compact = sentences.join(" ").slice(0, 220).trim();
  const main = compact || "Понял задачу и вижу, как это улучшить в обработке входящих.";
  return main;
}

function buildDemoReply(userText: string, kind: ChatMessage["kind"]) {
  const text = userText.toLowerCase().trim();

  if (kind === "voice" || text.includes("голос") || text.includes("аудио")) {
    return "Принял голосовое. Коротко: клиент спрашивает стоимость и ближайшую запись, при этом готов записаться в ближайшие дни.";
  }

  if (kind === "image" || text.includes("фото") || text.includes("изображ") || text.includes("картин")) {
    return "По фото видно, что клиент выбирает услугу и сравнивает варианты. В таком запросе важно сразу дать понятный выбор и мягко подвести к записи.";
  }

  if (
    text.includes("покажи, как ты отвечаешь на входящий лид") ||
    text.includes("входящий лид") ||
    text.includes("представь что я лид") ||
    text.includes("как ты отвечаешь на мою заявку")
  ) {
    return "Пример ответа клиенту: Добрый день, спасибо за заявку. Подскажите, какая услуга вам нужна и в какие дни удобно прийти, чтобы я сразу предложил ближайшие свободные слоты.";
  }

  if (text.includes("бьюти") || text.includes("салон") || text.includes("барбер") || text.includes("клиник")) {
    return "Пример для бьюти-направления: Добрый день, спасибо за обращение. Подскажите, какая процедура интересует и на какое время вам удобно, чтобы я сразу предложил подходящего мастера и свободные окна.";
  }

  if (text.includes("теряю клиентов в директе") || text.includes("теряю клиентов") || text.includes("директе")) {
    return "Это типовая проблема: обращения теряются между диалогами и ответ приходит с задержкой. Мы фиксируем каждый лид, отвечаем сразу и запускаем повторное касание, если клиент не ответил.";
  }

  if (text.includes("вопрос о цене") || text.includes("покажи ответ на вопрос о цене") || text.includes("цена") || text.includes("стоимость")) {
    return "Готовый ответ на цену: Стоимость зависит от задачи и обычно составляет от 3 500 до 5 500 ₽. Чтобы точно рассчитать и подобрать время, подскажите удобный день, и я предложу ближайшие слоты.";
  }

  if (text.includes("личный кабинет") || text.includes("войти в кабинет") || text.includes("перейти в личный кабинет")) {
    return "В личном кабинете вы увидите диалоги, этапы воронки, потери и точки роста по конверсии.";
  }

  if (text.includes("аналит")) {
    return "В аналитике видно источники лидов, конверсию по этапам и причины потерь. Это позволяет быстро корректировать сценарии и возвращать выручку.";
  }

  return null;
}

function buildManagerFallbackReply(userText: string) {
  const text = userText.toLowerCase();

  if (text.includes("sites") || text.includes("сайт")) {
    return "CFlow Sites помогает быстро собрать продающий сайт под вашу нишу и подключить лиды прямо в CFlow, чтобы заявки не терялись между каналами.";
  }
  if (text.includes("цена") || text.includes("сколько стоит")) {
    return "Стоимость зависит от задачи и количества каналов. В демо покажем прогноз по выручке и подберем формат запуска под ваш бизнес.";
  }
  if (text.includes("запуск") || text.includes("как быстро")) {
    return "Базовый запуск занимает 1–3 дня: подключаем каналы, настраиваем сценарии ответов и включаем аналитику потерь.";
  }
  if (text.includes("телеграм") || text.includes("telegram")) {
    return "Telegram подключается через Bot Token. После подключения сообщения попадают в AI Inbox, а ответы и follow-up можно автоматизировать.";
  }
  if (text.includes("crm") || text.includes("менеджер")) {
    return "Готовые лиды можно передавать в CRM или менеджеру со статусом и краткой сводкой диалога.";
  }
  return "CFlow отвечает на входящие, квалифицирует лиды, запускает follow-up и показывает, где вы теряете деньги. Могу подсказать, как это будет работать именно в вашей нише.";
}

function buildWebsitePreviewDoc(appCode: string) {
  const source = String(appCode || "").trim();
  if (!source) return "";
  const escaped = source
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com; connect-src 'none'; font-src https: data:;" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body class="bg-slate-100">
  <div id="root"></div>
  <script type="text/babel" data-presets="typescript,react">
    const source = \`${escaped}\`;
    let cleaned = source.replace(/^\\s*import\\s+.*$/gm, "");
    window.__CF_WEBSITE_COMPONENT__ = null;

    if (/export\\s+default\\s+/m.test(cleaned)) {
      cleaned = cleaned.replace(/export\\s+default\\s+/m, "const __CF_WEBSITE_COMPONENT__ = ");
      cleaned += "\\nwindow.__CF_WEBSITE_COMPONENT__ = __CF_WEBSITE_COMPONENT__;";
    } else {
      const fnMatch = cleaned.match(/function\\s+([A-Z][A-Za-z0-9_]*)\\s*\\(/);
      const constMatch = cleaned.match(/const\\s+([A-Z][A-Za-z0-9_]*)\\s*=\\s*/);
      const inferred = (fnMatch && fnMatch[1]) || (constMatch && constMatch[1]) || "";
      if (inferred) cleaned += "\\nwindow.__CF_WEBSITE_COMPONENT__ = " + inferred + ";";
    }

    try {
      const transformed = Babel.transform(cleaned, {
        filename: "App.jsx",
        presets: ["typescript", "react"]
      }).code;
      eval(transformed);
    } catch (e) {
      try { window.parent.postMessage({ type: "cflow_website_preview_error", error: String(e) }, "*"); } catch {}
      document.body.innerHTML = "<pre style='padding:16px;color:#b91c1c;white-space:pre-wrap'>Build/runtime error\\n\\n" + String(e) + "</pre>";
    }

    const App = window.__CF_WEBSITE_COMPONENT__;
    if (typeof App === "function") {
      const root = ReactDOM.createRoot(document.getElementById("root"));
      root.render(React.createElement(App));
      try { window.parent.postMessage({ type: "cflow_website_preview_ok" }, "*"); } catch {}
    } else if (!document.body.innerHTML.includes("Build/runtime error")) {
      const message = "Компонент не найден. Ожидается export default function App() { ... }";
      try { window.parent.postMessage({ type: "cflow_website_preview_error", error: message }, "*"); } catch {}
      document.body.innerHTML = "<pre style='padding:16px;color:#b91c1c;white-space:pre-wrap'>" + message + "</pre>";
    }
  </script>
</body>
</html>`;
}

function HomePage({ onNavigate }: { onNavigate: (path: RoutePath) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      text: "Клиент написал в 13:12: «Сколько стоит и когда можно записаться?». Я покажу реальный сценарий: ответ на цену → снятие сомнения → подтвержденная запись.",
      kind: "text"
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showCabinetCta, setShowCabinetCta] = useState(false);
  const [chatMode, setChatMode] = useState<"openrouter" | "mock">("openrouter");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [websiteCode, setWebsiteCode] = useState("");
  const [websiteTitle, setWebsiteTitle] = useState("AI Website Preview");
  const [websiteBrief, setWebsiteBrief] = useState<WebsiteBriefPreview | null>(null);
  const [websiteGenerationMeta, setWebsiteGenerationMeta] = useState<WebsiteGenerationMeta | null>(null);
  const [websitePreviewError, setWebsitePreviewError] = useState<string | null>(null);
  const [websiteAutoFixAttempts, setWebsiteAutoFixAttempts] = useState(0);
  const [websiteAutoFixInProgress, setWebsiteAutoFixInProgress] = useState(false);
  const [websiteAutoFixFailed, setWebsiteAutoFixFailed] = useState(false);
  const [websiteFixLog, setWebsiteFixLog] = useState<WebsiteFixLogItem[]>([]);
  const [websitePromptPack, setWebsitePromptPack] = useState<"A" | "B">("A");
  const [websiteActionLoading, setWebsiteActionLoading] = useState<null | "regenerate" | "premium" | "light" | "simplify">(null);
  const [managerChatOpen, setManagerChatOpen] = useState(false);
  const [managerChatTyping, setManagerChatTyping] = useState(false);
  const [managerChatInput, setManagerChatInput] = useState("");
  const [managerChatMessages, setManagerChatMessages] = useState<Array<{ id: string; role: ChatRole; text: string }>>([
    {
      id: uid(),
      role: "assistant",
      text: "Я AI-менеджер CFlow. Подскажу по CFlow и CFlow Sites: запуск, сценарии продаж, каналы и окупаемость."
    }
  ]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const websiteFixKeyRef = useRef("");

  const interactionCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages]
  );

  const isQualifiedForCta = useMemo(() => {
    const joined = messages
      .filter((m) => m.role === "user")
      .map((m) => m.text.toLowerCase())
      .join(" ");
    const hasBusinessIntent =
      joined.includes("лид") ||
      joined.includes("заявк") ||
      joined.includes("директ") ||
      joined.includes("цена") ||
      joined.includes("запис") ||
      joined.includes("конверс");
    return interactionCount >= 3 && hasBusinessIntent;
  }, [messages, interactionCount]);

  useEffect(() => {
    if (isQualifiedForCta && !showCabinetCta) {
      setShowCabinetCta(true);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          kind: "cta",
          text: "Если хотите, покажу это уже в рабочем интерфейсе на воронке, диалогах и аналитике."
        }
      ]);
    }
  }, [isQualifiedForCta, showCabinetCta]);

  useEffect(() => {
    const onPreviewEvent = (event: MessageEvent) => {
      const payload = event.data as { type?: string; error?: string } | null;
      if (!payload || typeof payload.type !== "string") return;
      if (payload.type === "cflow_website_preview_error") {
        setWebsitePreviewError(String(payload.error || "Unknown preview error"));
      }
      if (payload.type === "cflow_website_preview_ok") {
        setWebsitePreviewError(null);
      }
    };
    window.addEventListener("message", onPreviewEvent);
    return () => window.removeEventListener("message", onPreviewEvent);
  }, []);

  const buildReply = (userText: string) => {
    const text = userText.toLowerCase();

    if (text.includes("голос") || text.includes("аудио")) {
      return "Разбираем голосовое за секунды: фиксируем запрос, выделяем ключевую задачу и сразу готовим корректный ответ с предложением записи.";
    }
    if (text.includes("фото") || text.includes("изображ") || text.includes("картин")) {
      return "По фото определяем контекст запроса и сразу подсказываем вариант ответа: консультация, прайс или запись к нужному специалисту.";
    }
    if (text.includes("цена") || text.includes("стоим") || text.includes("дорого")) {
      return "На вопрос о цене даем аккуратный сценарий: понятный диапазон, что входит в услугу и два ближайших слота на запись.";
    }
    if (text.includes("директ") || text.includes("теряю") || text.includes("лид")) {
      return "CFlow фиксирует входящий лид, отвечает без задержек, квалифицирует обращение и запускает повторное касание, если клиент замолчал.";
    }
    if (text.includes("аналит") || text.includes("ворон") || text.includes("конверс")) {
      return "В кабинете видно конверсию по каналам, причины потерь и недополученную выручку. По каждому узкому месту даем конкретные действия.";
    }
    if (text.includes("запис") || text.includes("бронь")) {
      return "После квалификации система предлагает удобные слоты, подтверждает запись и передает нестандартные кейсы менеджеру.";
    }

    return "Понял задачу. Для вашего сценария настраиваем ответы, квалификацию и маршрут клиента до записи в одной системе.";
  };

  const toApiMessages = (list: ChatMessage[]): ApiChatMessage[] =>
    list
      .filter((msg) => msg.role === "assistant" || msg.role === "user")
      .map((msg) => {
        if (msg.kind === "image" && msg.imageUrl) {
          return {
            role: msg.role,
            content: [
              { type: "text", text: msg.text || "Пользователь загрузил изображение." },
              { type: "image_url", image_url: { url: msg.imageUrl } }
            ]
          };
        }
        return { role: msg.role, content: msg.text };
      });

  const sendUserMessage = async (text: string, kind: ChatMessage["kind"] = "text", imageUrl?: string) => {
    if (!text.trim() && kind === "text") return;

    const userMessage: ChatMessage = { id: uid(), role: "user", text, kind, imageUrl };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsTyping(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let response: Response;
      try {
        response = await fetch("/api/openrouter/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: toApiMessages(nextMessages),
            interactionCount: nextMessages.filter((item) => item.role === "user").length,
            promptPack: websitePromptPack
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        throw new Error(`API status ${response.status}`);
      }
      const data = (await response.json()) as {
        reply?: string;
        mode?: "openrouter" | "mock" | "website";
        brief?: WebsiteBriefPreview;
        code?: string;
        title?: string;
        generationMeta?: WebsiteGenerationMeta;
      };
      setChatMode(data.mode === "openrouter" || data.mode === "website" ? "openrouter" : "mock");

      if (data.mode === "website" && typeof data.code === "string" && data.code.trim()) {
        setWebsiteCode(data.code);
        setWebsiteTitle(String(data.title || "AI Website Preview"));
        setWebsiteBrief(data.brief || null);
        setWebsiteGenerationMeta(data.generationMeta || null);
        setWebsitePreviewError(null);
        setWebsiteAutoFixAttempts(0);
        setWebsiteAutoFixInProgress(false);
        setWebsiteAutoFixFailed(false);
        setWebsiteFixLog([]);
        websiteFixKeyRef.current = "";
        const assistantWebsiteMessage: ChatMessage = {
          id: uid(),
          role: "assistant",
          kind: "text",
          text: "Сайт сгенерирован. Справа открыт live preview и обновляется при новых генерациях."
        };
        setMessages((prev) => [...prev, assistantWebsiteMessage]);
        return;
      }
      const deterministicReply = buildDemoReply(text, kind);
      const localFallback =
        kind === "image"
          ? "Вижу фото. По контексту это похоже на запрос по услуге. Могу сразу дать рабочий ответ по воронке."
          : kind === "voice"
            ? "Голосовое получено. Кратко: клиент уточняет стоимость и ближайшую запись. Рекомендую ответить диапазоном цены и предложить два слота на выбор."
            : buildReply(text);
      const assistantMessage: ChatMessage = {
        id: uid(),
        role: "assistant",
        text: deterministicReply || formatSalesReply(data.reply?.trim() || localFallback),
        kind: "text"
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setChatMode("mock");
      const deterministicReply = buildDemoReply(text, kind);
      const fallback =
        kind === "image"
          ? "Вижу фото. По контексту это похоже на запрос по услуге. Могу сразу дать рабочий ответ по воронке."
          : kind === "voice"
            ? "Голосовое получено. Кратко: клиент уточняет стоимость и ближайшую запись. Рекомендую ответить диапазоном цены и предложить два слота на выбор."
            : buildReply(text);
      const assistantMessage: ChatMessage = {
        id: uid(),
        role: "assistant",
        text: deterministicReply || formatSalesReply(fallback),
        kind: "text"
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const sendManagerMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || managerChatTyping) return;

    const userMessage = { id: uid(), role: "user" as const, text };
    const next = [...managerChatMessages, userMessage];
    setManagerChatMessages(next);
    setManagerChatInput("");
    setManagerChatTyping(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      let response: Response;
      try {
        response = await fetch("/api/openrouter/product-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.slice(-10).map((item) => ({ role: item.role, content: item.text }))
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw new Error(`API status ${response.status}`);
      const data = (await response.json()) as { reply?: string };
      const reply = formatSalesReply(String(data.reply || "").trim() || buildManagerFallbackReply(text));
      setManagerChatMessages((prev) => [...prev, { id: uid(), role: "assistant", text: reply }]);
    } catch {
      setManagerChatMessages((prev) => [...prev, { id: uid(), role: "assistant", text: buildManagerFallbackReply(text) }]);
    } finally {
      setManagerChatTyping(false);
    }
  };

  const runWebsiteAction = async (action: "regenerate" | "premium" | "light" | "simplify") => {
    if (!websiteCode.trim()) return;
    setWebsiteActionLoading(action);
    setIsTyping(true);
    try {
      const response = await fetch("/api/openrouter/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: toApiMessages(messages),
          websiteAction: action,
          currentCode: websiteCode,
          currentBrief: websiteBrief || {},
          promptPack: websitePromptPack
        })
      });
      if (!response.ok) throw new Error(`API status ${response.status}`);
      const data = (await response.json()) as {
        mode?: "website" | "openrouter" | "mock";
        brief?: WebsiteBriefPreview;
        code?: string;
        title?: string;
        generationMeta?: WebsiteGenerationMeta;
      };
      if (data.mode === "website" && typeof data.code === "string" && data.code.trim()) {
        setWebsiteCode(data.code);
        setWebsiteTitle(String(data.title || websiteTitle));
        setWebsiteBrief(data.brief || websiteBrief);
        setWebsiteGenerationMeta(data.generationMeta || null);
        setWebsitePreviewError(null);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            kind: "text",
            text:
              action === "regenerate"
                ? "Собрал альтернативный вариант сайта."
                : action === "premium"
                  ? "Усилил дизайн до более премиальной версии."
                  : action === "light"
                    ? "Сделал светлую версию дизайна."
                    : "Упростил композицию и структуру сайта."
          }
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", kind: "text", text: "Не удалось выполнить действие для сайта. Попробуйте еще раз." }
      ]);
    } finally {
      setWebsiteActionLoading(null);
      setIsTyping(false);
    }
  };

  const onImagePick = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      sendUserMessage("Загрузил изображение", "image", url);
    };
    reader.readAsDataURL(file);
  };

  const websitePreviewDoc = useMemo(() => buildWebsitePreviewDoc(websiteCode), [websiteCode]);

  const runWebsiteFixAttempt = async (errorText: string, manual = false) => {
    if (!websiteCode.trim()) return;
    if (!manual && websiteAutoFixInProgress) return;

    const maxAttempts = 3;
    if (!manual && websiteAutoFixAttempts >= maxAttempts) {
      setWebsiteAutoFixFailed(true);
      return;
    }

    const attempt = manual ? websiteAutoFixAttempts + 1 : websiteAutoFixAttempts + 1;
    setWebsiteAutoFixInProgress(true);
    setWebsiteAutoFixFailed(false);
    setWebsiteFixLog((prev) => [
      ...prev,
      { at: new Date().toISOString(), attempt, error: errorText, status: "started", note: manual ? "manual" : "auto" }
    ]);

    try {
      const response = await fetch("/api/sites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "fix",
          guidance: "Repair website preview runtime/build issue",
          currentComponentCode: websiteCode,
          errorText,
          promptPack: websitePromptPack,
          round: attempt,
          profile: {
            businessName: websiteBrief?.brandName || "",
            niche: websiteBrief?.businessType || "",
            city: websiteBrief?.city || "",
            goal: websiteBrief?.primaryGoal || ""
          }
        })
      });
      const body = (await response.json()) as {
        error?: string;
        draft?: { componentCode?: string };
      };
      if (!response.ok) throw new Error(body.error || `fix_failed_status_${response.status}`);
      const fixedCode = String(body?.draft?.componentCode || "").trim();
      if (!fixedCode) throw new Error("fix_missing_component_code");
      if (fixedCode === websiteCode.trim()) throw new Error("fix_returned_same_code");

      setWebsiteCode(fixedCode);
      setWebsitePreviewError(null);
      setWebsiteAutoFixAttempts(attempt);
      setWebsiteAutoFixFailed(false);
      setWebsiteFixLog((prev) => [...prev, { at: new Date().toISOString(), attempt, error: errorText, status: "succeeded" }]);
    } catch (error: any) {
      const reason = String(error?.message || "unknown_fix_error");
      console.error("Website auto-fix failed:", reason);
      setWebsiteAutoFixAttempts(attempt);
      setWebsiteFixLog((prev) => [...prev, { at: new Date().toISOString(), attempt, error: errorText, status: "failed", note: reason }]);
      if (attempt >= maxAttempts) setWebsiteAutoFixFailed(true);
    } finally {
      setWebsiteAutoFixInProgress(false);
    }
  };

  useEffect(() => {
    if (!websitePreviewError || !websiteCode.trim()) return;
    if (websiteAutoFixInProgress || websiteAutoFixFailed) return;
    if (!websiteGenerationMeta?.canRepair) return;

    const key = `${websiteCode.slice(0, 120)}::${websitePreviewError}`;
    if (websiteFixKeyRef.current === key) return;
    websiteFixKeyRef.current = key;
    void runWebsiteFixAttempt(websitePreviewError, false);
  }, [websitePreviewError, websiteCode, websiteAutoFixInProgress, websiteAutoFixFailed, websiteGenerationMeta?.canRepair]);

  return (
    <div className="landing-luxe bg-[var(--ds-bg)] text-slate-900">
      <header className="landing-header sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button onClick={() => onNavigate("/")} className="text-lg font-extrabold tracking-tight">
            <BrandWordmark />
          </button>
          <nav className="hidden items-center gap-4 text-xs font-semibold uppercase tracking-[0.06em] text-slate-500 lg:flex">
            {navLinks.map((link) => (
              <a key={link.id} href={`#${link.id}`} className="transition hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="landing-top-actions flex items-center gap-2">
            <button
              onClick={() => onNavigate("/sites")}
              className="landing-sites-entry inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-slate-800"
            >
              <span>Sites</span>
            </button>
            <button onClick={() => onNavigate("/login")} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:px-4 sm:text-sm">
              Кабинет
            </button>
            <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="landing-cta-main rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm">
              Попробовать демо
            </button>
          </div>
        </div>
      </header>

      <main className="landing-flow">
        <section id="problem" className="landing-hero landing-order-problem landing-transition-shell landing-transition-problem relative border-b border-slate-200">
          <div className="landing-shell landing-shell-hero">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <h1 className="mt-7 max-w-4xl text-5xl font-extrabold leading-[0.98] tracking-tight sm:text-7xl">
                Превращайте каждый входящий диалог в клиента.
              </h1>
              <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
                AI отвечает за секунды и доводит лид до записи без потерь.
              </p>
              <div className="mt-9">
                <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="landing-cta-main rounded-full px-8 py-3.5 text-sm font-semibold sm:text-base">
                  Посмотреть демо
                </button>
              </div>
              <div className="landing-hero-asym mt-10">
                <div className="landing-money-signal rounded-2xl border border-rose-200 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-700">Потери в деньгах</p>
                  <p className="mt-1 text-lg font-extrabold leading-tight text-slate-900 sm:text-xl">
                    Вы теряете до 30% заявок, это около 120 000 ₽ в месяц.
                  </p>
                </div>
                <div className="landing-hero-orbit" aria-hidden="true" />
              </div>
            </motion.div>
          </div>
        </section>

        <section id="offer" className="landing-order-offer border-b border-slate-200">
          <div className="landing-shell landing-shell-section">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.42 }}
            >
              <div className="landing-section-intro">
                <p className="landing-section-kicker">После подключения CFlow</p>
                <h2 className="landing-section-title max-w-5xl">Что мы предлагаем бизнесу</h2>
                <p className="landing-section-lead max-w-2xl">Простая система, которая ведёт клиента от первого сообщения до оплаты и показывает, где вы теряете выручку.</p>
              </div>
              <div className="landing-offer-composition">
                {offerTiles.map((tile, idx) => (
                  <motion.article
                    key={tile.title}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.24 }}
                    transition={{ duration: 0.34, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
                    className={`offer-tile offer-tile--${tile.layout} rounded-2xl border border-slate-200 bg-white p-5 sm:p-6`}
                  >
                    <p className="offer-tile-index text-[11px] font-semibold tracking-[0.09em] text-slate-500">{String(idx + 1).padStart(2, "0")}</p>
                    <p className="offer-tile-kicker mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-700">{tile.kicker}</p>
                    <h3 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{tile.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{tile.text}</p>
                  </motion.article>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="audience" className="landing-order-audience border-b border-slate-200">
          <div className="landing-shell landing-shell-section">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.42 }}
            >
              <div className="landing-section-intro">
                <p className="landing-section-kicker">Применение по сегментам</p>
                <h2 className="landing-section-title max-w-5xl">Для кого CFlow</h2>
                <p className="landing-section-lead max-w-3xl">Если вы узнаете свой сценарий ниже, продукт уже решает вашу задачу по входящим лидам.</p>
              </div>

              <div className="landing-audience-list">
                {audienceSegments.map((segment, index) => (
                  <article key={segment.title} className="audience-row">
                    <div className="audience-head">
                      <p className="audience-number">{String(index + 1).padStart(2, "0")}</p>
                      <h3 className="audience-title">{segment.title}</h3>
                    </div>
                    <div className="audience-body">
                      <div>
                        <p className="audience-label">Типовой запрос</p>
                        <p className="audience-text">{segment.request}</p>
                      </div>
                      <div>
                        <p className="audience-label">Где теряются лиды</p>
                        <p className="audience-text">{segment.loss}</p>
                      </div>
                      <div>
                        <p className="audience-label">Как помогает CFlow</p>
                        <p className="audience-text audience-text-strong">{segment.help}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="platform" className="landing-order-platform border-b border-slate-200">
          <div className="landing-shell landing-shell-section">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.42 }}
              className="landing-platform-shell"
            >
              <div className="landing-platform-intro">
                <p className="landing-section-kicker">Возможности CFlow</p>
                <h2 className="landing-section-title max-w-4xl">Что входит в платформу</h2>
                <p className="landing-section-lead max-w-xl">Набор модулей, который закрывает полный цикл работы с входящими лидами: от первого ответа до передачи в продажу.</p>
              </div>

              <div className="landing-platform-list">
                {platformModules.map((module, index) => (
                  <article key={module.title} className="platform-item">
                    <p className="platform-number">{String(index + 1).padStart(2, "0")}</p>
                    <div>
                      <h3 className="platform-title">{module.title}</h3>
                      <p className="platform-description">{module.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="cases" className="landing-order-cases border-b border-slate-200">
          <div className="landing-shell landing-shell-section">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.44 }}
            >
              <div className="landing-section-intro">
                <p className="landing-section-kicker">Результаты клиентов</p>
                <h2 className="landing-section-title max-w-5xl">Кейсы: как CFlow работает в разных бизнесах</h2>
                <p className="landing-section-lead max-w-3xl">Реальные сценарии: от первого сообщения до измеримого результата в деньгах, записях и загрузке команды.</p>
              </div>

              <div className="landing-cases-layout">
                <motion.article
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -3 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className="case-panel case-panel--featured rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"
                >
                  <p className="case-label text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700">{caseStories[0].business}</p>
                  <p className="case-kicker mt-6 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Результат</p>
                  <h3 className="case-result-main mt-2 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">{caseStories[0].result}</h3>
                  <div className="mt-6 space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Проблема</p>
                      <p className="mt-1 text-sm text-slate-700">{caseStories[0].problem}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Что сделал CFlow</p>
                      <p className="mt-1 text-sm text-slate-700">{caseStories[0].action}</p>
                    </div>
                  </div>
                </motion.article>

                <div className="case-panel case-panel--stack">
                  {caseStories.slice(1).map((story, index) => (
                    <motion.article
                      key={story.business}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -2 }}
                      viewport={{ once: true, amount: 0.22 }}
                      transition={{ duration: 0.3, delay: 0.03 * index, ease: [0.22, 1, 0.36, 1] }}
                      className="case-item rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="case-label text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700">{story.business}</p>
                      </div>
                      <p className="case-kicker mt-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Результат</p>
                      <p className="case-result mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{story.result}</p>
                      <div className="mt-4 space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Проблема</p>
                          <p className="mt-1 text-sm text-slate-700">{story.problem}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Что сделал CFlow</p>
                          <p className="mt-1 text-sm text-slate-700">{story.action}</p>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="demo" className="landing-order-demo landing-transition-shell landing-transition-demo border-b border-slate-200">
          <div className="landing-shell landing-shell-section">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45 }}
            >
              <div className="landing-section-intro">
                <p className="landing-section-kicker">Рабочий сценарий</p>
                <h2 className="landing-section-title max-w-4xl">Демо в реальном интерфейсе</h2>
                <p className="landing-section-lead max-w-2xl">Сообщение клиента → ответ AI → запись.</p>
              </div>

              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }} className="landing-demo-stage luxe-panel rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">AI ведет диалог до целевого действия</h3>
                  <p className="text-xs font-semibold text-slate-500">{chatMode === "openrouter" ? "Онлайн" : "Демо-режим"}</p>
                </div>
                <div className="mt-4 h-[340px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:h-[370px]">
                  {messages.map((message) => (
                    <div key={message.id} className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm ${message.role === "assistant" ? "border-slate-200 bg-white text-slate-800" : "ml-auto border-cyan-200 bg-cyan-50 text-cyan-950"}`}>
                      {message.imageUrl ? <img src={message.imageUrl} alt="upload" className="mb-2 h-28 w-full rounded-xl object-cover" /> : null}
                      <p>{message.text}</p>
                      {message.kind === "cta" && showCabinetCta ? (
                        <button onClick={() => onNavigate("/login")} className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                          Перейти в кабинет
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {isTyping ? (
                    <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                    </div>
                  ) : null}
                </div>
                <div className="landing-demo-composer mt-3 flex items-end gap-2">
                  <div className="landing-demo-tools flex items-end gap-2">
                    <button onClick={() => fileRef.current?.click()} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Фото</button>
                    <button onClick={() => sendUserMessage("Голосовое сообщение", "voice")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Голос</button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImagePick(e.target.files?.[0])} />
                  <div className="landing-demo-input flex-1">
                    <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Введите сообщение..." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </div>
                  <button onClick={() => sendUserMessage(input)} className="landing-demo-send rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Отправить</button>
                </div>
              </motion.div>

              <div className="landing-outcome-strip mt-6 grid gap-3 sm:grid-cols-3">
                {demoOutcomes.map((item, idx) => (
                  <div key={item} className={`asym-outcome-card asym-outcome-${idx + 1} rounded-2xl border border-slate-200 bg-white p-4`}>
                    <p className="text-sm font-semibold text-slate-900">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="faq" className="landing-order-faq border-b border-slate-200">
          <div className="landing-shell landing-shell-section">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.42 }}
            >
              <div className="landing-faq-shell">
                <div className="landing-faq-intro">
                  <p className="landing-section-kicker">Перед запуском</p>
                  <h2 className="landing-section-title max-w-4xl">FAQ: ответы на ключевые вопросы</h2>
                  <p className="landing-section-lead max-w-xl">Коротко и по делу: как работает система, что входит в запуск и какую пользу вы получите для бизнеса.</p>
                </div>

                <div className="landing-faq-list">
                  {faqItems.map((item, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <motion.article
                        key={item.question}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.22 }}
                        transition={{ duration: 0.28, delay: index * 0.02, ease: [0.22, 1, 0.36, 1] }}
                        className={`faq-item ${isOpen ? "is-open" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenFaq(isOpen ? null : index)}
                          className="faq-trigger"
                        >
                          <span className="faq-question-wrap">
                            <span className="faq-number">{String(index + 1).padStart(2, "0")}</span>
                            <span className="faq-question">{item.question}</span>
                          </span>
                          <span className={`faq-indicator ${isOpen ? "open" : ""}`} aria-hidden="true">
                            <span className="faq-indicator-line faq-indicator-line-h" />
                            <span className="faq-indicator-line faq-indicator-line-v" />
                          </span>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen ? (
                            <motion.div
                              key="answer"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                            className="faq-answer-wrap"
                          >
                              <motion.p
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -2 }}
                                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                className="faq-answer"
                              >
                                {item.answer}
                              </motion.p>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      </motion.article>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="cta" className="landing-order-cta">
          <div className="landing-shell landing-shell-section">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.42 }}
              className="landing-final-cta rounded-3xl border px-6 py-10 sm:px-10 sm:py-14"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan-700">Финальный шаг</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                Запустите CFlow и верните потерянные заявки в выручку
              </h2>
              <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
                Подключение занимает несколько минут: после запуска вы сразу видите, где теряются лиды и сколько денег можно вернуть.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="landing-cta-main rounded-full px-8 py-4 text-base font-extrabold">
                  Запустить демо сейчас
                </button>
                <button onClick={() => onNavigate("/login")} className="rounded-full border border-slate-300 bg-white px-7 py-3 text-sm font-semibold text-slate-700">
                  Перейти в кабинет
                </button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-5 right-4 z-50 sm:bottom-6 sm:right-6">
        {managerChatOpen ? (
          <div className="w-[min(92vw,360px)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_48px_rgba(15,23,42,0.2)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">AI-менеджер CFlow</p>
                <p className="text-xs text-slate-500">Ответы про CFlow и CFlow Sites</p>
              </div>
              <button onClick={() => setManagerChatOpen(false)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                Закрыть
              </button>
            </div>
            <div className="h-64 space-y-2 overflow-y-auto bg-slate-50 p-3">
              {managerChatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl border px-3 py-2 text-sm ${
                    message.role === "assistant"
                      ? "border-slate-200 bg-white text-slate-800"
                      : "ml-auto border-cyan-200 bg-cyan-50 text-cyan-950"
                  }`}
                >
                  {message.text}
                </div>
              ))}
              {managerChatTyping ? (
                <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                </div>
              ) : null}
            </div>
            <div className="border-t border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {managerQuickQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => sendManagerMessage(question)}
                    className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    {question}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <input
                  value={managerChatInput}
                  onChange={(e) => setManagerChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void sendManagerMessage(managerChatInput);
                    }
                  }}
                  placeholder="Задайте вопрос..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                />
                <button
                  onClick={() => void sendManagerMessage(managerChatInput)}
                  className="landing-cta-main rounded-xl px-3 py-2 text-sm font-semibold"
                >
                  Отправить
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setManagerChatOpen(true)}
            className="landing-cta-main rounded-full px-5 py-3 text-sm font-semibold"
          >
            Чат с AI-менеджером
          </button>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-600 sm:px-6">
          <p className="font-bold text-slate-900"><BrandWordmark /></p>
          <div className="flex flex-wrap items-center gap-4 leading-none">
            <button onClick={() => onNavigate("/sites")} className="inline-flex items-center hover:text-slate-900"><SitesWordmark /></button>
            <button onClick={() => onNavigate("/login")} className="inline-flex items-center hover:text-slate-900">Личный кабинет</button>
            <button onClick={() => onNavigate("/pricing")} className="inline-flex items-center hover:text-slate-900">Тарифы</button>
            <span className="inline-flex items-center">Контакты</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LoginPage({ onNavigate }: { onNavigate: (path: RoutePath) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const inviteToken = useMemo(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("invite") || "";
  }, []);

  const acceptInviteIfNeeded = async () => {
    if (!inviteToken) return;
    const response = await fetch("/api/workspace/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: inviteToken })
    });
    const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; workspaceId?: string };
    if (!response.ok || !data?.ok) {
      throw new Error(data?.error || "invite_accept_failed");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      await loginWithPassword(email, password);
      await acceptInviteIfNeeded();
      await refreshSessionFromToken();
      setError(null);
      onNavigate("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Не удалось войти.");
    } finally {
      setLoading(false);
    }
  };

  const runRegister = async () => {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const result = await registerWithPassword(email, password);
      if (result.requiresEmailConfirmation) {
        setHint("Проверьте почту и подтвердите регистрацию через письмо.");
      } else {
        await acceptInviteIfNeeded();
        await refreshSessionFromToken();
        onNavigate("/dashboard");
      }
    } catch (err: any) {
      setError(err?.message || "Не удалось зарегистрироваться.");
    } finally {
      setLoading(false);
    }
  };

  const runMagicLink = async () => {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      await sendMagicLink(email);
      setHint("Ссылка для входа отправлена на email.");
    } catch (err: any) {
      setError(err?.message || "Не удалось отправить magic link.");
    } finally {
      setLoading(false);
    }
  };

  const runResetPassword = async () => {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      await requestPasswordReset(email);
      setHint("Письмо для восстановления пароля отправлено.");
    } catch (err: any) {
      setError(err?.message || "Не удалось отправить письмо для восстановления.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-cyan-700">
          <BrandWordmark cClass="text-cyan-600" flowClass="text-slate-900" />
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Вход в CFlow</h1>
        <p className="mt-2 text-sm text-slate-600">Supabase Auth: email/password, magic link, восстановление пароля.</p>
        {inviteToken ? <p className="mt-2 text-sm font-semibold text-cyan-700">У вас приглашение в команду workspace. Войдите, чтобы принять его.</p> : null}
        <label className="mt-5 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Пароль</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <button disabled={loading} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {loading ? "Подождите..." : "Войти"}
        </button>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runRegister()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Зарегистрироваться
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runMagicLink()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Magic link
          </button>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void runResetPassword()}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Восстановить пароль
        </button>
        {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
        {hint ? <p className="mt-3 text-sm font-semibold text-emerald-700">{hint}</p> : null}
        <button type="button" onClick={() => onNavigate("/")} className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">На главную</button>
      </form>
    </div>
  );
}

function PricingPage({ onNavigate }: { onNavigate: (path: RoutePath) => void }) {
  const plans = [
    { name: "Free Trial", price: "0 ₽", note: "7 дней", features: ["1 канал", "Базовый Inbox"] },
    { name: "Basic", price: "3 000 ₽", note: "в месяц", features: ["AI-ответы", "Базовая аналитика"] },
    { name: "Pro", price: "6 500 ₽", note: "в месяц", features: ["Мультиканальность", "Recovery", "AI рекомендации"], featured: true },
    { name: "Business", price: "10 000 ₽", note: "в месяц", features: ["Все функции Pro", "Приоритетная поддержка"] }
  ];

  return (
    <div className="min-h-screen bg-[#f7f8f6] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-[1160px]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight">Тарифы CFlow</h1>
          <button onClick={() => onNavigate("/")} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">На главную</button>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-3xl border p-5 shadow-sm ${plan.featured ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"}`}>
              <p className="text-lg font-bold text-slate-900">{plan.name}</p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{plan.price}</p>
              <p className="text-sm text-slate-500">{plan.note}</p>
              <div className="mt-4 space-y-1 text-sm text-slate-700">
                {plan.features.map((f) => <p key={f}>• {f}</p>)}
              </div>
              <button onClick={() => onNavigate("/login")} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Начать</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SitesPage({ onNavigate }: { onNavigate: (path: RoutePath) => void }) {
  return (
    <SitesBuilderPage onNavigate={onNavigate as (path: string) => void} />
  );
}

function PublishedSitePage({ path, onNavigate }: { path: `/s/${string}`; onNavigate: (path: RoutePath) => void }) {
  const slug = path.replace("/s/", "");
  const [data, setData] = useState<PublishedSiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "services" | "reviews" | "cabinet">("home");
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [openedProductId, setOpenedProductId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/sites/get?slug=${encodeURIComponent(slug)}`);
        const body = (await response.json()) as PublishedSiteData | { error?: string };
        if (!response.ok || !("payload" in body)) {
          const localSite = loadLocalPublishedSite(slug);
          if (localSite) {
            if (!cancelled) setData(localSite);
            return;
          }
          throw new Error((body as { error?: string }).error || "Сайт не найден");
        }
        if (!cancelled) setData(body as PublishedSiteData);
      } catch (e: any) {
        const localSite = loadLocalPublishedSite(slug);
        if (localSite) {
          if (!cancelled) setData(localSite);
          return;
        }
        if (!cancelled) setError(e?.message || "Ошибка загрузки сайта");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6] text-sm font-semibold text-slate-600">Загружаем сайт...</div>;
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Сайт не найден</h1>
          <p className="mt-2 text-sm text-slate-600">{error || "Проверьте ссылку публикации."}</p>
          <button onClick={() => onNavigate("/")} className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">На главную</button>
        </div>
      </div>
    );
  }

  const p = data.payload;
  if (typeof p.pageCode === "string" && p.pageCode.trim()) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">{p.businessName || "Published Site"}</p>
          <button onClick={() => onNavigate("/sites")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
            Back to Builder
          </button>
        </div>
        <iframe title="Published generated site" sandbox="allow-scripts allow-forms allow-popups allow-modals" srcDoc={p.pageCode} className="h-[calc(100vh-52px)] w-full border-0" />
      </div>
    );
  }
  const openedProduct = p.products.find((item) => item.id === openedProductId) || null;
  const socialLinks = p.socialLinks || {};
  const tabs: Array<{ id: "home" | "services" | "reviews" | "cabinet"; label: string }> = [
    { id: "home", label: "Дом" },
    { id: "services", label: "Услуги" },
    { id: "reviews", label: "Отзывы" },
    { id: "cabinet", label: "Личный кабинет" }
  ];
  const toHref = (value?: string) => {
    const raw = (value || "").trim();
    if (!raw) return "";
    if (/^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(raw)) return raw;
    if (raw.startsWith("@")) return `https://t.me/${raw.slice(1)}`;
    return `https://${raw}`;
  };
  const socialButtons = [
    { key: "telegram", label: "TG", href: toHref(socialLinks.telegram) },
    { key: "whatsapp", label: "WA", href: toHref(socialLinks.whatsapp) },
    { key: "instagram", label: "IG", href: toHref(socialLinks.instagram) }
  ] as const;
  const tabIntro = {
    home: { title: p.heroTitle, subtitle: p.heroSubtitle },
    services: { title: "Услуги и направления", subtitle: "Выберите подходящую услугу, формат работы и удобный способ записи." },
    reviews: { title: "Отзывы и ответы на вопросы", subtitle: "Реальные впечатления клиентов и ключевая информация перед обращением." },
    cabinet: { title: "Личный кабинет клиента", subtitle: "Доступ к записям, статусам и персональной коммуникации." }
  } as const;
  const theme = p.theme || {};
  const fontHeading = theme.fontHeading || '"Inter", "Segoe UI", sans-serif';
  const fontBody = theme.fontBody || '"Inter", "Segoe UI", sans-serif';
  const radius = theme.radius === "rounded" ? 24 : theme.radius === "sharp" ? 10 : 16;
  const cardBorder = theme.contrast === "high" ? "rgba(15,23,42,0.24)" : "rgba(148,163,184,0.28)";
  const blockPadding = theme.density === "compact" ? "12px" : theme.density === "airy" ? "22px" : "16px";
  const layoutBlocks = Array.isArray(p.pageDsl) && p.pageDsl.length ? p.pageDsl : Array.isArray(p.layoutSpec) ? p.layoutSpec : [];
  const hasDynamicLayout = layoutBlocks.length > 0;
  const runtimeBlocks = hasDynamicLayout
    ? layoutBlocks
    : [
        { id: "fallback-services", type: "services", variant: "cards", items: p.products.map((item) => ({ title: item.title, price: item.price, duration: "", emoji: "•" })) },
        { id: "fallback-reviews", type: "reviews", variant: "cards", items: p.testimonials.map((item) => ({ author: item.name, text: item.text })) },
        { id: "fallback-faq", type: "faq", variant: "accordion", items: p.faq.map((item) => ({ q: item.q, a: item.a })) },
        { id: "fallback-contacts", type: "contacts", variant: "panel", line: p.contactLine }
      ];

  return (
    <div className="min-h-screen text-slate-900" style={{ backgroundColor: p.baseColor || "#f8fafc", fontFamily: fontBody }}>
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
              {p.logoUrl ? <img src={p.logoUrl} alt={p.businessName} className="h-full w-full object-contain" /> : null}
            </div>
            <p className="text-sm font-bold" style={{ fontFamily: fontHeading }}>{p.businessName}</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1">{p.city || "Город"}</span>
            {socialButtons.map((item) =>
              item.href ? (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white font-bold text-slate-700 transition hover:border-slate-500"
                >
                  {item.label}
                </a>
              ) : (
                <span
                  key={item.key}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 font-bold text-slate-400"
                >
                  {item.label}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-5">
        {activeTab === "home" ? (
          <div className="border px-4 py-6" style={{ backgroundColor: p.baseColor || "#f8fafc", borderColor: cardBorder, borderRadius: radius }}>
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: fontHeading }}>{tabIntro.home.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-700">{tabIntro.home.subtitle}</p>
            <div className="mt-3 border bg-white" style={{ borderColor: cardBorder, borderRadius: Math.max(10, radius - 4), padding: blockPadding }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">About</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">{p.about}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: p.accentColor }}>{p.primaryCta}</button>
              <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">{p.secondaryCta}</button>
              {p.cabinetEnabled ? <button className="rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: p.accentColor }}>Войти через Telegram</button> : null}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {p.trustStats?.slice(0, 3).map((item) => (
                <div key={item.label} className="border bg-white p-2.5" style={{ borderColor: cardBorder, borderRadius: Math.max(10, radius - 4) }}>
                  <p className="text-[11px] text-slate-500">{item.label}</p>
                  <p className="text-sm font-bold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border bg-white px-4 py-6" style={{ borderColor: cardBorder, borderRadius: radius }}>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: fontHeading }}>{tabIntro[activeTab].title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">{tabIntro[activeTab].subtitle}</p>
          </div>
        )}

        {openedProduct ? (
          <div className="mt-4 border bg-white p-4 shadow-sm" style={{ borderColor: cardBorder, borderRadius: radius }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">{openedProduct.title}</p>
                <p className="text-xs text-slate-500">{openedProduct.price}</p>
              </div>
              <button onClick={() => setOpenedProductId(null)} className="text-sm font-semibold text-slate-500">✕</button>
            </div>
            {openedProduct.images?.[0] ? <img src={openedProduct.images[0]} alt={openedProduct.title} className="mt-2 h-44 w-full rounded-xl border border-slate-200 object-cover" /> : null}
            <p className="mt-2 text-sm text-slate-700">{openedProduct.description}</p>
            <button className="mt-3 rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: p.accentColor }}>{openedProduct.ctaText}</button>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {runtimeBlocks.map((block: any) => {
            if (block.type === "hero") {
              return (
                <div key={block.id || uid()} className={block.variant === "split" ? "grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2" : "rounded-xl border bg-white p-4 text-center"} style={{ borderColor: cardBorder, borderRadius: Math.max(10, radius - 4) }}>
                  <div>
                    <h3 className="text-3xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: fontHeading }}>{String(block.title || p.heroTitle)}</h3>
                    <p className="mt-2 text-sm text-slate-600">{String(block.subtitle || p.heroSubtitle)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: p.accentColor }}>{String(block.primaryCta || p.primaryCta)}</button>
                      <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">{String(block.secondaryCta || p.secondaryCta)}</button>
                    </div>
                  </div>
                  {block.variant === "split" ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Layout под этот проект сгенерирован динамически.</div> : null}
                </div>
              );
            }
            if (block.type === "services") {
              const items: any[] = Array.isArray(block.items) ? block.items : [];
              return (
                <div key={block.id || uid()} className="border bg-white p-3" style={{ borderColor: cardBorder, borderRadius: Math.max(10, radius - 4) }}>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Услуги</p>
                  <div className={block.variant === "rows" ? "mt-2 space-y-2" : "mt-2 grid gap-2 sm:grid-cols-3"}>
                    {items.map((item: any, idx: number) => (
                      <div key={`${idx}-${String(item.title || "")}`} className="border bg-slate-50 p-2" style={{ borderColor: cardBorder, borderRadius: Math.max(8, radius - 6) }}>
                        <p className="text-xs font-semibold text-slate-900">{String(item.title || "")}</p>
                        <p className="text-xs text-slate-600">{String(item.price || "")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (block.type === "faq") {
              const items: any[] = Array.isArray(block.items) ? block.items : [];
              return (
                <div key={block.id || uid()} className="border bg-white p-4" style={{ borderColor: cardBorder, borderRadius: Math.max(10, radius - 4) }}>
                  <h4 className="text-3xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: fontHeading }}>Частые вопросы</h4>
                  <div className="mt-2">
                    {items.map((item: any, idx: number) => {
                      const q = String(item.q || "");
                      const isOpen = openFaq === q;
                      return (
                        <div key={`${q}-${idx}`} className="border-t border-slate-200 py-3">
                          <button onClick={() => setOpenFaq(isOpen ? null : q)} className="flex w-full items-center justify-between gap-2 text-left">
                            <span className="text-base font-semibold text-slate-900">{q}</span>
                            <span className="text-xl text-slate-500">{isOpen ? "−" : "+"}</span>
                          </button>
                          {isOpen ? <p className="mt-2 text-sm text-slate-600">{String(item.a || "")}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
            if (block.type === "reviews") {
              const items: any[] = Array.isArray(block.items) ? block.items : [];
              return (
                <div key={block.id || uid()} className="border bg-white p-3" style={{ borderColor: cardBorder, borderRadius: Math.max(10, radius - 4) }}>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Отзывы</p>
                  <div className={block.variant === "quotes" ? "mt-2 space-y-2" : "mt-2 grid gap-2 sm:grid-cols-3"}>
                    {items.map((item: any, idx: number) => (
                      <div key={`${idx}-${String(item.author || "")}`} className="border bg-slate-50 p-2" style={{ borderColor: cardBorder, borderRadius: Math.max(8, radius - 6) }}>
                        <p className="text-xs font-semibold text-slate-900">{String(item.author || "Клиент")}</p>
                        <p className="mt-1 text-xs text-slate-700">{String(item.text || "")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            if (block.type === "stats") {
              const items: any[] = Array.isArray(block.items) ? block.items : [];
              return (
                <div key={block.id || uid()} className="grid gap-2 sm:grid-cols-3">
                  {items.map((item: any, idx: number) => (
                    <div key={`${idx}-${String(item.label || "")}`} className="border bg-white p-3 text-center" style={{ borderColor: cardBorder, borderRadius: Math.max(10, radius - 4) }}>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{String(item.label || "Метрика")}</p>
                      <p className="mt-1 text-xl font-semibold text-slate-900" style={{ fontFamily: fontHeading }}>{String(item.value || "—")}</p>
                    </div>
                  ))}
                </div>
              );
            }
            if (block.type === "cta") {
              return (
                <div key={block.id || uid()} className="border bg-white p-4 text-center" style={{ borderColor: cardBorder, borderRadius: Math.max(10, radius - 4) }}>
                  <h4 className="text-2xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: fontHeading }}>{String(block.title || "Готовы начать?")}</h4>
                  <p className="mt-2 text-sm text-slate-600">{String(block.subtitle || "Оставьте заявку, и мы свяжемся с вами.")}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button className="rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: p.accentColor }}>{String(block.primaryCta || p.primaryCta)}</button>
                    <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">{String(block.secondaryCta || p.secondaryCta)}</button>
                  </div>
                </div>
              );
            }
            if (block.type === "text") {
              return (
                <div key={block.id || uid()} className="border bg-white p-4" style={{ borderColor: cardBorder, borderRadius: Math.max(10, radius - 4) }}>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{String(block.title || "Блок")}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{String(block.body || "")}</p>
                </div>
              );
            }
            if (block.type === "contacts") {
              return (
                <div key={block.id || uid()} className="rounded-xl border border-cyan-200 bg-cyan-50 p-3" style={{ borderRadius: Math.max(10, radius - 4) }}>
                  <p className="text-sm font-semibold text-slate-900">{String(block.line || p.contactLine)}</p>
                </div>
              );
            }
            return null;
          })}
        </div>

        {!runtimeBlocks.some((block: any) => block.type === "contacts") ? (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
            <p className="text-sm font-semibold text-slate-900">{p.contactLine}</p>
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${activeTab === tab.id ? "text-white" : "text-slate-700"}`}
              style={activeTab === tab.id ? { backgroundColor: p.accentColor } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FullPreviewPage({ path, onNavigate }: { path: `/sites/preview/${string}`; onNavigate: (path: RoutePath) => void }) {
  const id = path.replace("/sites/preview/", "");
  const [data, setData] = useState<TemporaryPreviewData | null>(null);

  useEffect(() => {
    setData(loadTempPreview(id));
  }, [id]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Preview не найден</h1>
          <p className="mt-2 text-sm text-slate-600">Сгенерируй сайт снова и открой full preview ещё раз.</p>
          <button onClick={() => onNavigate("/sites")} className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            Вернуться в Builder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{data.title || "Full Preview"}</p>
          <p className="text-[11px] text-slate-500">Полноэкранный просмотр сгенерированного сайта</p>
        </div>
        <button onClick={() => onNavigate("/sites")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
          Back to Builder
        </button>
      </div>
      <iframe title="Generated full preview" sandbox="allow-scripts allow-forms allow-popups allow-modals" srcDoc={data.pageCode} className="h-[calc(100vh-56px)] w-full border-0 bg-white" />
    </div>
  );
}

function DashboardRoute({ onNavigate }: { onNavigate: (path: RoutePath) => void }) {
  const isAuth = useMemo(() => isAuthenticatedClient(), []);
  const isWorkbenchAuth = useMemo(() => {
    try {
      const raw = localStorage.getItem(WORKBENCH_AUTH_KEY);
      return raw ? JSON.parse(raw).isAuth === true : false;
    } catch {
      return false;
    }
  }, []);

  if (!isAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Личный кабинет</h1>
          <p className="mt-2 text-sm text-slate-600">Требуется авторизация через Supabase Auth.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button onClick={() => onNavigate("/login")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Войти</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <DashboardApp onNavigate={onNavigate} />
      <button
        onClick={() => {
          void logoutCurrentSession().finally(() => {
            clearAuthSession();
            onNavigate("/login");
            window.location.reload();
          });
        }}
        className="fixed bottom-4 left-4 z-50 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm"
      >
        Logout
      </button>
      {isWorkbenchAuth ? (
        <button
          onClick={() => onNavigate("/workbench")}
          className="fixed bottom-4 right-4 z-50 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-800 shadow-sm"
        >
          Рабочий контур
        </button>
      ) : null}
    </div>
  );
}

function WorkbenchRoute({ onNavigate }: { onNavigate: (path: RoutePath) => void }) {
  const isAuth = useMemo(() => {
    try {
      const raw = localStorage.getItem(WORKBENCH_AUTH_KEY);
      return raw ? JSON.parse(raw).isAuth === true : false;
    } catch {
      return false;
    }
  }, []);

  if (!isAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Рабочий контур закрыт</h1>
          <p className="mt-2 text-sm text-slate-600">Перейдите во вход и авторизуйтесь через email/password или magic link.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button onClick={() => onNavigate("/login")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Перейти ко входу</button>
            <button onClick={() => onNavigate("/")} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">На главную</button>
          </div>
        </div>
      </div>
    );
  }

  return <WorkbenchApp onNavigate={onNavigate} />;
}

export default function App() {
  const [path, navigate] = useRoute();
  const isFullPreviewPath = path.startsWith("/sites/preview/");
  const isPublishedSitePath = path.startsWith("/s/");

  return (
    <>
      {path === "/" ? <HomePage onNavigate={navigate} /> : null}
      {path === "/login" ? <LoginPage onNavigate={navigate} /> : null}
      {path === "/pricing" ? <PricingPage onNavigate={navigate} /> : null}
      {path === "/sites" ? <SitesPage onNavigate={navigate} /> : null}
      {path === "/dashboard" ? <DashboardRoute onNavigate={navigate} /> : null}
      {path === "/workbench" ? <WorkbenchRoute onNavigate={navigate} /> : null}
      {isFullPreviewPath ? <FullPreviewPage path={path as `/sites/preview/${string}`} onNavigate={navigate} /> : null}
      {isPublishedSitePath ? <PublishedSitePage path={path as `/s/${string}`} onNavigate={navigate} /> : null}
    </>
  );
}
