import { motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import DashboardApp from "./DashboardApp";
import SitesBuilderPage from "./sites/ChatSitesBuilderPage";
import WorkbenchApp from "./WorkbenchApp";

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

const AUTH_KEY = "clientsflow_demo_auth_v1";
const WORKBENCH_AUTH_KEY = "clientsflow_workbench_auth_v1";

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
  { id: "problem", label: "Проблема" },
  { id: "solution", label: "Решение" },
  { id: "how", label: "Как работает" },
  { id: "cases", label: "Кейсы" },
  { id: "integrations", label: "Интеграции" }
];

const promptChips = [
  "Я теряю клиентов в директе",
  "Покажи, как ты отвечаешь на входящий лид",
  "Как ты работаешь с голосовыми?",
  "Можешь понять, что на фото?",
  "Мне нужна автоматическая запись",
  "Хочу видеть аналитику по лидам"
];

const integrations = [
  { name: "Telegram", note: "Входящие и follow-up", status: "Live" },
  { name: "WhatsApp", note: "Быстрые ответы и запись", status: "Live" },
  { name: "Instagram", note: "Direct и комментарии", status: "Beta" },
  { name: "Website Chat", note: "Форма и онлайн-чат", status: "Live" },
  { name: "CRM", note: "Передача квалифицированных лидов", status: "Sync" },
  { name: "Email", note: "Уведомления и отчёты", status: "Live" }
];

const powerCards = [
  {
    title: "Отвечайте первыми",
    text: "Первый ответ за секунды, даже ночью.",
    chip: "⚡ Скорость",
    meta: "До 60 сек"
  },
  {
    title: "Закрывайте в запись",
    text: "AI ведет диалог к конкретному действию.",
    chip: "🎯 Продажа",
    meta: "Запись / оплата"
  },
  {
    title: "Не теряйте контекст",
    text: "История клиента и этап воронки всегда под рукой.",
    chip: "🧠 Контекст",
    meta: "Единая карточка"
  },
  {
    title: "Возвращайте потерянных",
    text: "Follow-up поднимает лиды, которые уже остыли.",
    chip: "💰 Выручка",
    meta: "Recovery-сценарии"
  }
];

const useCaseStories = [
  {
    title: "Салон красоты: возврат потерянных лидов",
    scenario: "Клиенты спрашивали цену, уходили «подумать» и не возвращались.",
    beforeLabel: "Было",
    beforeValue: "24% доходили до записи",
    afterLabel: "Стало",
    afterValue: "39% доходят до записи",
    metric: "+15 п.п. к конверсии за 30 дней",
    money: "+126 000 ₽ дополнительной выручки в месяц"
  },
  {
    title: "Клиника: быстрый первый ответ",
    scenario: "Часть заявок терялась из-за ответа через 20–40 минут.",
    beforeLabel: "Было",
    beforeValue: "Средний ответ: 18 минут",
    afterLabel: "Стало",
    afterValue: "Средний ответ: 54 секунды",
    metric: "x20 быстрее первый контакт",
    money: "+31% квалифицированных лидов"
  },
  {
    title: "Онлайн-школа: дожим до оплаты",
    scenario: "После вопросов по тарифам лиды зависали без следующего шага.",
    beforeLabel: "Было",
    beforeValue: "11 оплат из 100 лидов",
    afterLabel: "Стало",
    afterValue: "19 оплат из 100 лидов",
    metric: "+8 оплат на каждые 100 лидов",
    money: "+184 000 ₽ к выручке за месяц"
  }
];


const demoSalesScenario = [
  {
    stage: "Первый контакт",
    client: "Клиент: «Сколько стоит окрашивание и есть ли окно на этой неделе?»",
    ai: "AI: «Диапазон 4 500–6 000 ₽, в цену входит консультация и подбор оттенка. Могу предложить два ближайших окна: ср 18:30 или чт 11:00.»"
  },
  {
    stage: "Снятие сомнений",
    client: "Клиент: «Дорого, я подумаю.»",
    ai: "AI: «Понимаю. Чтобы было проще сравнить, отправлю 2 фото-результата и что именно входит в процедуру. Зафиксировать текущую цену до пятницы?»"
  },
  {
    stage: "Закрытие",
    client: "Клиент: «Да, давайте четверг 11:00.»",
    ai: "AI: «Отлично, записал вас на четверг 11:00. За день отправлю напоминание и инструкцию перед визитом.»"
  }
];

const howItWorksSlides = [
  {
    title: "Подключаете каналы",
    text: "Telegram, WhatsApp, Instagram и сайт объединяются в одну операционную ленту.",
    badge: "Шаг 1"
  },
  {
    title: "Настраиваете сценарии",
    text: "Определяете правила ответа, квалификацию лидов и условия передачи менеджеру.",
    badge: "Шаг 2"
  },
  {
    title: "CFlow обрабатывает обращения",
    text: "Система отвечает, уточняет задачу, ведет к записи и не теряет контекст клиента.",
    badge: "Шаг 3"
  },
  {
    title: "Управляете ростом по аналитике",
    text: "Видите конверсию, причины потерь и действия, которые улучшают результат.",
    badge: "Шаг 4"
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

function pickNextStep(context: string) {
  const text = context.toLowerCase();
  if (text.includes("личный кабинет") || text.includes("войти")) {
    return "Нажмите кнопку Перейти в личный кабинет ниже.";
  }
  if (text.includes("входящ") || text.includes("заявк")) {
    return "Напишите нишу бизнеса, и я адаптирую ответ под ваш поток обращений.";
  }
  if (text.includes("бьюти") || text.includes("салон") || text.includes("барбер") || text.includes("клиник")) {
    return "Укажите услугу и средний чек, и я соберу готовый сценарий под запись.";
  }
  if (text.includes("голос") || text.includes("аудио")) {
    return "Отправьте голосовое, и я покажу готовый ответ клиенту.";
  }
  if (text.includes("фото") || text.includes("изображ") || text.includes("картин")) {
    return "Загрузите фото запроса, и я предложу корректный сценарий ответа.";
  }
  if (text.includes("цена") || text.includes("стоим") || text.includes("дорог")) {
    return "Дайте тип услуги, и я подготовлю мягкий ответ с диапазоном цены.";
  }
  if (text.includes("аналит") || text.includes("ворон") || text.includes("конверс") || text.includes("выруч")) {
    return "Перейдите в личный кабинет и откройте раздел аналитики.";
  }
  if (text.includes("запис") || text.includes("брон") || text.includes("слот") || text.includes("календар")) {
    return "Напишите: Нужен сценарий доведения до записи.";
  }
  if (text.includes("директ") || text.includes("лид") || text.includes("входящ") || text.includes("клиент")) {
    return "Напишите сферу бизнеса, и я предложу стартовый сценарий первого ответа.";
  }
  return "Опишите задачу в одном предложении, и я предложу рабочий сценарий.";
}

function formatSalesReply(text: string, context = "") {
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
  return `${main}\nСледующий шаг: ${pickNextStep(context)}`;
}

function buildDemoReply(userText: string, kind: ChatMessage["kind"]) {
  const text = userText.toLowerCase().trim();

  if (kind === "voice" || text.includes("голос") || text.includes("аудио")) {
    return "Принял голосовое. Коротко: клиент спрашивает стоимость и ближайшую запись, при этом готов записаться в ближайшие дни.\nСледующий шаг: показать готовый ответ на это голосовое.";
  }

  if (kind === "image" || text.includes("фото") || text.includes("изображ") || text.includes("картин")) {
    return "По фото видно, что клиент выбирает услугу и сравнивает варианты. В таком запросе важно сразу дать понятный выбор и мягко подвести к записи.\nСледующий шаг: загрузите ещё одно фото, и я покажу второй вариант ответа.";
  }

  if (
    text.includes("покажи, как ты отвечаешь на входящий лид") ||
    text.includes("входящий лид") ||
    text.includes("представь что я лид") ||
    text.includes("как ты отвечаешь на мою заявку")
  ) {
    return "Пример ответа клиенту: Добрый день, спасибо за заявку. Подскажите, какая услуга вам нужна и в какие дни удобно прийти, чтобы я сразу предложил ближайшие свободные слоты.\nСледующий шаг: напишите нишу бизнеса, и я адаптирую этот ответ под ваш формат.";
  }

  if (text.includes("бьюти") || text.includes("салон") || text.includes("барбер") || text.includes("клиник")) {
    return "Пример для бьюти-направления: Добрый день, спасибо за обращение. Подскажите, какая процедура интересует и на какое время вам удобно, чтобы я сразу предложил подходящего мастера и свободные окна.\nСледующий шаг: укажите услугу и средний чек, и я дам готовый сценарий до записи.";
  }

  if (text.includes("теряю клиентов в директе") || text.includes("теряю клиентов") || text.includes("директе")) {
    return "Это типовая проблема: обращения теряются между диалогами и ответ приходит с задержкой. Мы фиксируем каждый лид, отвечаем сразу и запускаем повторное касание, если клиент не ответил.\nСледующий шаг: напишите, через сколько минут вы обычно отвечаете сейчас.";
  }

  if (text.includes("вопрос о цене") || text.includes("покажи ответ на вопрос о цене") || text.includes("цена") || text.includes("стоимость")) {
    return "Готовый ответ на цену: Стоимость зависит от задачи и обычно составляет от 3 500 до 5 500 ₽. Чтобы точно рассчитать и подобрать время, подскажите удобный день, и я предложу ближайшие слоты.\nСледующий шаг: хотите вариант ответа для премиум-сегмента или для массового потока.";
  }

  if (text.includes("личный кабинет") || text.includes("войти в кабинет") || text.includes("перейти в личный кабинет")) {
    return "В личном кабинете вы увидите диалоги, этапы воронки, потери и точки роста по конверсии.\nСледующий шаг: нажмите кнопку Перейти в личный кабинет.";
  }

  if (text.includes("аналит")) {
    return "В аналитике видно источники лидов, конверсию по этапам и причины потерь. Это позволяет быстро корректировать сценарии и возвращать выручку.\nСледующий шаг: перейти в личный кабинет и открыть раздел Аналитика.";
  }

  return null;
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
  const [howStepIndex, setHowStepIndex] = useState(0);
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
      return "По фото определяем контекст запроса и подсказываем следующий шаг: консультация, прайс или запись к нужному специалисту.";
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
          ? "Вижу фото. По контексту это похоже на запрос по услуге. Могу сразу дать рабочий ответ и предложить следующий шаг по воронке."
          : kind === "voice"
            ? "Голосовое получено. Кратко: клиент уточняет стоимость и ближайшую запись. Рекомендую ответить диапазоном цены и предложить два слота на выбор."
            : buildReply(text);
      const assistantMessage: ChatMessage = {
        id: uid(),
        role: "assistant",
        text: deterministicReply || formatSalesReply(data.reply?.trim() || localFallback, text),
        kind: "text"
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setChatMode("mock");
      const deterministicReply = buildDemoReply(text, kind);
      const fallback =
        kind === "image"
          ? "Вижу фото. По контексту это похоже на запрос по услуге. Могу сразу дать рабочий ответ и предложить следующий шаг по воронке."
          : kind === "voice"
            ? "Голосовое получено. Кратко: клиент уточняет стоимость и ближайшую запись. Рекомендую ответить диапазоном цены и предложить два слота на выбор."
            : buildReply(text);
      const assistantMessage: ChatMessage = {
        id: uid(),
        role: "assistant",
        text: deterministicReply || formatSalesReply(fallback, text),
        kind: "text"
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
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
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button onClick={() => onNavigate("/")} className="text-lg font-extrabold tracking-tight">
            <BrandWordmark />
          </button>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex">
            {navLinks.map((link) => (
              <a key={link.id} href={`#${link.id}`} className="transition hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate("/sites")}
              className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-slate-800"
            >
              <span className="sm:hidden">Sites</span>
              <span className="hidden sm:inline"><SitesWordmark /></span>
            </button>
            <button onClick={() => onNavigate("/login")} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Личный кабинет
            </button>
            <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="landing-cta-main rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Попробовать демо
            </button>
          </div>
        </div>
      </header>

      <main className="landing-flow">
        <section id="problem" className="landing-hero landing-order-problem relative overflow-hidden border-b border-slate-200">
          <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_15%_100%,rgba(125,211,252,0.24),transparent_70%),radial-gradient(40%_40%_at_90%_65%,rgba(99,102,241,0.18),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">
                AI Client Operations Platform
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Вы теряете лиды, пока команда не успевает отвечать.
              </h1>
              <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
                Каждый пропущенный диалог превращается в потерянную выручку. CFlow показывает это в цифрах и закрывает разрыв.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="landing-cta-main rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white sm:text-base">
                  Попробовать демо
                </button>
                <button onClick={() => onNavigate("/login")} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 sm:text-base">
                  Личный кабинет
                </button>
              </div>
              <p className="mt-4 text-sm text-slate-500">Включает AI Inbox, аналитику, воронку лидов, recovery-сценарии и AI-рекомендации.</p>
            </motion.div>

            <motion.div
              id="demo"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="landing-demo-grid grid gap-4 lg:grid-cols-2"
            >
              <div className="luxe-panel rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Интерактивный демо-диалог</p>
                    <p className="text-xs text-slate-500">{chatMode === "openrouter" ? "Онлайн-режим" : "Резервный демо-режим"}</p>
                  </div>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">Чат • Website Builder</span>
                </div>
                <div className="h-[340px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:h-[380px]">
                  {messages.map((message) => (
                    <div key={message.id} className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm ${message.role === "assistant" ? "border-slate-200 bg-white text-slate-800" : "ml-auto border-cyan-200 bg-cyan-50 text-cyan-950"}`}>
                      {message.imageUrl ? <img src={message.imageUrl} alt="upload" className="mb-2 h-28 w-full rounded-xl object-cover" /> : null}
                      <p>{message.text}</p>
                      {message.kind === "cta" && showCabinetCta ? (
                        <button onClick={() => onNavigate("/login")} className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
                          Перейти в личный кабинет
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {promptChips.slice(0, 4).map((chip) => (
                    <button key={chip} onClick={() => sendUserMessage(chip)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-500">
                      {chip}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <button onClick={() => fileRef.current?.click()} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Фото</button>
                  <button onClick={() => sendUserMessage("Голосовое сообщение", "voice")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Голос</button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onImagePick(e.target.files?.[0])} />
                  <div className="flex-1">
                    <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Введите сообщение..." className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </div>
                  <button onClick={() => sendUserMessage(input)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Отправить</button>
                </div>
              </div>

              <div className="luxe-panel rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Как AI реально продаёт</p>
                    <p className="text-xs text-slate-500">Сценарий: цена → сомнение → подтверждённая запись</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Результат в CRM</span>
                </div>

                <div className="space-y-3">
                  {demoSalesScenario.map((step) => (
                    <div key={step.stage} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-700">{step.stage}</p>
                      <p className="mt-1 text-sm text-slate-700">{step.client}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{step.ai}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">Итог сделки</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2">
                      <p className="text-[11px] text-slate-500">Статус</p>
                      <p className="text-sm font-bold text-slate-900">Лид квалифицирован</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2">
                      <p className="text-[11px] text-slate-500">Цель</p>
                      <p className="text-sm font-bold text-slate-900">Запись подтверждена</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2">
                      <p className="text-[11px] text-slate-500">Ожидаемая выручка</p>
                      <p className="text-sm font-bold text-slate-900">≈ 6 000 ₽</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onNavigate("/login")}
                  className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Посмотреть это в личном кабинете
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="solution" className="landing-order-solution luxe-band border-y border-slate-200 bg-white/60">
          <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Решение: AI, который закрывает в запись</h2>
            <p className="mt-3 max-w-3xl text-slate-600">Каждый блок ниже напрямую влияет на продажи и скорость обработки заявок.</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {powerCards.map((card) => (
                <motion.div whileHover={{ y: -2 }} key={card.title} className="feature-sell-card rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="feature-chip inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-800">
                      {card.chip}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                      {card.meta}
                    </span>
                  </div>
                  <h3 className="mt-5 text-2xl font-extrabold leading-tight tracking-tight text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">{card.text}</p>
                  <div className="mt-4 h-1.5 w-16 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="landing-order-how luxe-band border-y border-slate-200 bg-white/60">
          <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Как это работает</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHowStepIndex((prev) => (prev - 1 + howItWorksSlides.length) % howItWorksSlides.length)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                >
                  ←
                </button>
                <button
                  onClick={() => setHowStepIndex((prev) => (prev + 1) % howItWorksSlides.length)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                >
                  →
                </button>
              </div>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
              <motion.div
                key={`how-visual-${howStepIndex}`}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="h-64 rounded-2xl border border-slate-200 bg-[radial-gradient(80%_70%_at_15%_20%,rgba(125,211,252,0.32),transparent_62%),radial-gradient(55%_60%_at_90%_100%,rgba(59,130,246,0.22),transparent_58%),#f8fafc] p-4 sm:h-72">
                  <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{howItWorksSlides[howStepIndex].badge}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{howItWorksSlides[howStepIndex].title}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="h-20 rounded-xl border border-slate-200 bg-white/80" />
                    <div className="h-20 rounded-xl border border-slate-200 bg-white/80" />
                    <div className="h-20 rounded-xl border border-slate-200 bg-white/80" />
                    <div className="h-20 rounded-xl border border-slate-200 bg-white/80" />
                  </div>
                </div>
              </motion.div>
              <motion.div
                key={`how-copy-${howStepIndex}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-cyan-700">
                  {howItWorksSlides[howStepIndex].badge}
                </span>
                <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">{howItWorksSlides[howStepIndex].title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{howItWorksSlides[howStepIndex].text}</p>
                <div className="mt-6 flex items-center gap-2">
                  {howItWorksSlides.map((_, i) => (
                    <span key={`dot-${i}`} className={`h-1.5 rounded-full transition-all ${i === howStepIndex ? "w-8 bg-slate-900" : "w-3 bg-slate-300"}`} />
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="cases" className="landing-order-cases luxe-section mx-auto max-w-[1240px] overflow-hidden px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Кейсы, где CFlow дал измеримый рост</h2>
          <p className="mt-3 max-w-3xl text-slate-600">Не “красивые обещания”, а конкретные сценарии с цифрами: что было до, что стало после внедрения.</p>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {useCaseStories.map((item) => (
              <div key={item.title} className="case-story-card rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-700">Живой сценарий</p>
                <h3 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.scenario}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-rose-700">{item.beforeLabel}</p>
                    <p className="mt-1 text-sm font-semibold text-rose-900">{item.beforeValue}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">{item.afterLabel}</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-900">{item.afterValue}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold text-slate-900">{item.metric}</p>
                  <p className="mt-1 text-xs font-semibold text-cyan-800">{item.money}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="integrations" className="landing-order-integrations luxe-section mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Все заявки в одном месте</h2>
          <p className="mt-3 max-w-3xl text-slate-600">Telegram, WhatsApp, Instagram и сайт сходятся в единый CFlow Inbox, где AI доводит клиента до записи или передачи в CRM.</p>
          <div className="integrations-system mt-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {integrations.map((item) => {
                const visual =
                  item.name === "Telegram"
                    ? { icon: "TG", tone: "from-sky-100 to-sky-50 text-sky-700 border-sky-200" }
                    : item.name === "WhatsApp"
                      ? { icon: "WA", tone: "from-emerald-100 to-emerald-50 text-emerald-700 border-emerald-200" }
                      : item.name === "Instagram"
                        ? { icon: "IG", tone: "from-fuchsia-100 to-rose-50 text-fuchsia-700 border-fuchsia-200" }
                        : item.name === "Website Chat"
                          ? { icon: "WEB", tone: "from-indigo-100 to-indigo-50 text-indigo-700 border-indigo-200" }
                          : item.name === "CRM"
                            ? { icon: "CRM", tone: "from-slate-200 to-slate-50 text-slate-700 border-slate-300" }
                            : { icon: "MAIL", tone: "from-amber-100 to-amber-50 text-amber-700 border-amber-200" };

                return (
                  <div key={item.name} className="channel-node rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`inline-flex min-w-[50px] items-center justify-center rounded-xl border bg-gradient-to-br px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] ${visual.tone}`}>
                        {visual.icon}
                      </div>
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-cyan-700">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-3 text-base font-bold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                  </div>
                );
              })}
            </div>

            <div className="flow-chain mt-5 flex flex-col items-stretch gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flow-box rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                Входящие из всех каналов
              </div>
              <div className="flow-arrow text-center text-xl font-bold text-slate-400">→</div>
              <div className="flow-hub rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cyan-700">Единый центр</p>
                <p className="text-sm font-extrabold text-slate-900">CFlow AI Inbox</p>
              </div>
              <div className="flow-arrow text-center text-xl font-bold text-slate-400">→</div>
              <div className="flow-box rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                Запись, сделка или передача в CRM
              </div>
            </div>
          </div>
        </section>

        <section id="cta" className="landing-order-cta mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <div className="rounded-3xl border border-slate-900 bg-slate-900 px-6 py-10 text-white sm:px-10 sm:py-14">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-300">Запуск сегодня</p>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Начните получать заявки уже сегодня, а не «когда-нибудь»</h2>
            <p className="mt-3 max-w-3xl text-sm text-slate-300 sm:text-base">
              CFlow берет входящие в работу сразу: отвечает за секунды, доводит до записи и возвращает часть потерянной выручки уже в первый месяц.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-cyan-100">Ответ клиенту &lt; 60 сек</span>
              <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-emerald-100">Follow-up без ручной рутины</span>
              <span className="rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-rose-100">Контроль потерь в ₽</span>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-slate-900">Запустить демо и получить первых лидов</button>
              <button onClick={() => onNavigate("/login")} className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white">Перейти в кабинет</button>
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-300">Чем дольше откладываете запуск, тем больше заявок уходит конкурентам.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-600 sm:px-6">
          <p className="font-bold text-slate-900"><BrandWordmark /></p>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => onNavigate("/sites")} className="hover:text-slate-900"><SitesWordmark /></button>
            <button onClick={() => onNavigate("/login")} className="hover:text-slate-900">Личный кабинет</button>
            <button onClick={() => onNavigate("/pricing")} className="hover:text-slate-900">Тарифы</button>
            <span>Контакты</span>
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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (email === "111" && password === "111") {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ isAuth: true, email }));
      localStorage.setItem(WORKBENCH_AUTH_KEY, JSON.stringify({ isAuth: true, email }));
      setError(null);
      onNavigate("/dashboard");
      return;
    }
    setError("Неверный логин или пароль. Для рабочего входа используйте 111 / 111.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f6] px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-cyan-700">
          <BrandWordmark cClass="text-cyan-600" flowClass="text-slate-900" />
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Рабочий вход</h1>
        <p className="mt-2 text-sm text-slate-600">Доступ в рабочий контур: логин `111`, пароль `111`.</p>
        <label className="mt-5 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Пароль</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
        </label>
        <button className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Войти</button>
        {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
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
  const isAuth = useMemo(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw).isAuth === true : false;
    } catch {
      return false;
    }
  }, []);
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
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Личный кабинет в демо-режиме</h1>
          <p className="mt-2 text-sm text-slate-600">Для входа используйте любую пару email/пароль или перейдите сразу в демо-панель.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button onClick={() => onNavigate("/login")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Войти</button>
            <button
              onClick={() => {
                localStorage.setItem(AUTH_KEY, JSON.stringify({ isAuth: true, email: "demo@clientsflow.ai" }));
                onNavigate("/dashboard");
                window.location.reload();
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Продолжить как демо-пользователь
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <DashboardApp onNavigate={onNavigate} />
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
          <p className="mt-2 text-sm text-slate-600">Перейдите во вход и авторизуйтесь с учётными данными 111 / 111.</p>
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
