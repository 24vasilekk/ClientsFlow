import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import DashboardApp from "./DashboardApp";
import WorkbenchApp from "./WorkbenchApp";

type RoutePath = "/" | "/login" | "/dashboard" | "/pricing" | "/workbench" | "/sites";

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

const AUTH_KEY = "clientsflow_demo_auth_v1";
const WORKBENCH_AUTH_KEY = "clientsflow_workbench_auth_v1";

const navLinks = [
  { id: "how", label: "Как работает" },
  { id: "features", label: "Возможности" },
  { id: "integrations", label: "Интеграции" },
  { id: "cases", label: "Кейсы" },
  { id: "faq", label: "FAQ" }
];

const promptChips = [
  "Я теряю клиентов в директе",
  "Покажи, как ты отвечаешь на входящий лид",
  "Как ты работаешь с голосовыми?",
  "Можешь понять, что на фото?",
  "Мне нужна автоматическая запись",
  "Хочу видеть аналитику по лидам"
];

const integrations = ["Telegram", "WhatsApp", "Instagram", "Website Chat", "CRM", "Email"];

const powerCards = [
  {
    title: "Всегда отвечает",
    text: "ClientsFlow даёт стабильный первый ответ за секунды, даже в пиковые часы и ночью.",
    chip: "24/7"
  },
  {
    title: "Доводит до действия",
    text: "Система не просто переписывается, а переводит клиента к записи, оплате или звонку.",
    chip: "Action"
  },
  {
    title: "Помнит контекст",
    text: "История диалога, намерение клиента и этап воронки сохраняются между касаниями.",
    chip: "Context"
  },
  {
    title: "Работает в реальных процессах",
    text: "Квалификация, follow-up, эскалация менеджеру и отчётность в одном потоке.",
    chip: "Ops"
  }
];

const useCaseCards = [
  "Лиды, которые не остывают",
  "Моментальный первый ответ",
  "Доведение до записи",
  "Реактивация потерянных клиентов",
  "AI читает голосовые",
  "AI понимает изображения",
  "Работа с прайс-вопросами",
  "Передача менеджеру",
  "Суммаризация диалогов",
  "Оценка вероятности покупки",
  "Авто-напоминания",
  "Контроль SLA ответа"
];

const modules = [
  "AI Inbox",
  "Квалификация лидов",
  "Воронка и статусы",
  "Потерянные лиды",
  "Аналитика",
  "AI рекомендации"
];

const faqItems = [
  {
    q: "Что умеет AI-ассистент в демо?",
    a: "В демо можно протестировать ответы на входящие, квалификацию, обработку возражений и переход к записи."
  },
  {
    q: "Как он работает с голосовыми?",
    a: "Демо показывает распознавание и краткую выжимку голосового сообщения с предложением следующего шага."
  },
  {
    q: "Может ли он понимать изображения?",
    a: "Да, в MVP-режиме ассистент симулирует разбор изображения и объясняет, как применить это в коммуникации."
  },
  {
    q: "Это чат-бот или полноценная система?",
    a: "ClientsFlow — это платформа клиентских операций: каналы, воронка, аналитика, recovery и рекомендации."
  },
  {
    q: "Что будет в личном кабинете?",
    a: "AI Inbox, лиды, аналитика, блок потерянной выручки, AI-рекомендации и модуль ClientsFlow Sites."
  },
  {
    q: "Можно ли подключить Telegram и WhatsApp?",
    a: "Да, в целевой версии подключаются популярные каналы общения и CRM."
  },
  {
    q: "Как проходит тестовый доступ?",
    a: "В демо-режиме вы входите с любыми данными и сразу видите рабочий кабинет с мок-данными."
  }
];

function normalizePath(pathname: string): RoutePath {
  if (pathname === "/login") return "/login";
  if (pathname === "/dashboard") return "/dashboard";
  if (pathname === "/pricing") return "/pricing";
  if (pathname === "/workbench") return "/workbench";
  if (pathname === "/sites") return "/sites";
  return "/";
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

function HomePage({ onNavigate }: { onNavigate: (path: RoutePath) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      text: "Здравствуйте, на связи команда ClientsFlow. Покажу, как выстроить стабильную обработку входящих и доведение до записи.\nСледующий шаг: выберите один из вариантов ниже.",
      kind: "text"
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(faqItems[0].q);
  const [showCabinetCta, setShowCabinetCta] = useState(false);
  const [chatMode, setChatMode] = useState<"openrouter" | "mock">("openrouter");
  const fileRef = useRef<HTMLInputElement | null>(null);

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
      return "ClientsFlow фиксирует входящий лид, отвечает без задержек, квалифицирует обращение и запускает повторное касание, если клиент замолчал.";
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
            interactionCount: nextMessages.filter((item) => item.role === "user").length
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        throw new Error(`API status ${response.status}`);
      }
      const data = (await response.json()) as { reply?: string; mode?: "openrouter" | "mock" };
      setChatMode(data.mode === "openrouter" ? "openrouter" : "mock");
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

  const onImagePick = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      sendUserMessage("Загрузил изображение", "image", url);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-[#f7f8f6] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button onClick={() => onNavigate("/")} className="text-lg font-extrabold tracking-tight">
            ClientsFlow
          </button>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 lg:flex">
            {navLinks.map((link) => (
              <a key={link.id} href={`#${link.id}`} className="transition hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate("/sites")} className="hidden rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 sm:block">
              ClientsFlow Sites
            </button>
            <button onClick={() => onNavigate("/login")} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Войти
            </button>
            <button onClick={() => onNavigate("/dashboard")} className="hidden rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 sm:block">
              Личный кабинет
            </button>
            <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Попробовать демо
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200">
          <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_15%_100%,rgba(125,211,252,0.24),transparent_70%),radial-gradient(40%_40%_at_90%_65%,rgba(99,102,241,0.18),transparent_70%)]" />
          <div className="relative mx-auto grid max-w-[1240px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">
                AI Client Operations Platform
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Перестаньте терять лиды. ClientsFlow отвечает, квалифицирует и доводит до записи.
              </h1>
              <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
                Платформа автоматизирует входящие обращения, обрабатывает текст, голосовые и изображения, управляет follow-up и даёт прозрачную аналитику по конверсии.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white sm:text-base">
                  Попробовать демо
                </button>
                <button onClick={() => onNavigate("/dashboard")} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 sm:text-base">
                  Войти в кабинет
                </button>
              </div>
              <p className="mt-4 text-sm text-slate-500">Включает AI Inbox, аналитику, воронку лидов, recovery-сценарии и AI-рекомендации.</p>
            </motion.div>

            <motion.div id="demo" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Интерактивный демо-диалог</p>
                  <p className="text-xs text-slate-500">{chatMode === "openrouter" ? "Онлайн-режим" : "Резервный демо-режим"}</p>
                </div>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">Сообщения • Голосовые • Фото</span>
              </div>
              <div className="h-[360px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:h-[410px]">
                {messages.map((message) => (
                  <div key={message.id} className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm ${message.role === "assistant" ? "border-slate-200 bg-white text-slate-800" : "ml-auto border-cyan-200 bg-cyan-50 text-cyan-950"}`}>
                    {message.imageUrl ? <img src={message.imageUrl} alt="upload" className="mb-2 h-28 w-full rounded-xl object-cover" /> : null}
                    <p>{message.text}</p>
                    {message.kind === "cta" && showCabinetCta ? (
                      <button onClick={() => onNavigate("/dashboard")} className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">
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
            </motion.div>
          </div>
        </section>

        <section id="integrations" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">ClientsFlow работает там, где уже приходят ваши обращения</h2>
          <p className="mt-3 max-w-3xl text-slate-600">Подключайте привычные каналы и управляйте всей клиентской коммуникацией в одной операционной системе.</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {integrations.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-sm font-semibold text-slate-700 shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-white/60">
          <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Сильные стороны платформы</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {powerCards.map((card) => (
                <motion.div whileHover={{ y: -2 }} key={card.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <span className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-cyan-700">{card.chip}</span>
                  <h3 className="mt-4 text-xl font-bold tracking-tight text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="cases" className="mx-auto max-w-[1240px] overflow-hidden px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Реальные кейсы в работе ClientsFlow</h2>
          <p className="mt-3 max-w-3xl text-slate-600">Мини-сцены показывают, как система ведёт клиента от первого сообщения до записи и оплаты.</p>
          <div className="relative mt-8">
            <motion.div animate={{ x: ["0%", "-50%"] }} transition={{ duration: 28, ease: "linear", repeat: Infinity }} className="flex w-[200%] gap-3">
              {[...useCaseCards, ...useCaseCards].map((title, i) => (
                <div key={`${title}-${i}`} className="w-[280px] shrink-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="h-36 rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_30%_20%,rgba(125,211,252,0.28),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(251,146,60,0.2),transparent_55%),#f8fafc]" />
                  <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">Пример сценария в интерфейсе продукта.</p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="how" className="border-y border-slate-200 bg-white/60">
          <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Как это работает</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {["Подключаете каналы", "Настраиваете сценарии", "ClientsFlow обрабатывает обращения", "Вы управляете ростом по аналитике"].map((step, i) => (
                <div key={step} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Шаг {i + 1}</p>
                  <p className="mt-3 text-lg font-bold tracking-tight text-slate-900">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Модули платформы</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => (
              <div key={mod} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="font-semibold text-slate-900">{mod}</p>
                <p className="mt-1 text-sm text-slate-600">Полноценный операционный модуль с рабочими сценариями.</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6">
          <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1fr_1.1fr] lg:p-8">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Личный кабинет ClientsFlow</h2>
              <p className="mt-3 text-slate-600">Внутри: AI Inbox, статусы лидов, аналитика по каналам, потерянная выручка и AI-рекомендации.</p>
              <button onClick={() => onNavigate("/dashboard")} className="mt-5 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white">
                Открыть личный кабинет
              </button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {["Входящие лиды", "Записано", "Конверсия"].map((k) => (
                  <div key={k} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">{k}</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-900">{k === "Конверсия" ? "36.5%" : k === "Записано" ? "176" : "482"}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-600">Потерянная выручка: <span className="font-bold text-slate-900">54 000 ₽ / 7 дней</span></p>
              </div>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-cyan-700">AI рекомендации</p>
                <p className="mt-1 text-sm text-slate-700">Скорректируйте ответ на вопрос о цене и запустите follow-up для 12 лидов.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="border-y border-slate-200 bg-white/70">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <h2 className="text-5xl font-extrabold leading-none tracking-tight">Частые вопросы</h2>
            <div>
              {faqItems.map((item) => {
                const isOpen = openFaq === item.q;
                return (
                  <div key={item.q} className="border-t border-slate-200 py-5 last:border-b">
                    <button onClick={() => setOpenFaq(isOpen ? null : item.q)} className="flex w-full items-center justify-between text-left text-2xl font-semibold tracking-tight text-slate-900">
                      <span>{item.q}</span>
                      <span className="text-3xl text-slate-500">{isOpen ? "−" : "+"}</span>
                    </button>
                    <AnimatePresence>
                      {isOpen ? (
                        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden text-base leading-relaxed text-slate-600">
                          {item.a}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6">
          <div className="rounded-3xl border border-slate-900 bg-slate-900 px-6 py-10 text-white sm:px-10 sm:py-14">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Покажите бизнесу, как должен выглядеть современный AI для работы с клиентами</h2>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900">Попробовать демо</button>
              <button onClick={() => onNavigate("/dashboard")} className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white">Перейти в кабинет</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-600 sm:px-6">
          <p className="font-bold text-slate-900">ClientsFlow</p>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => onNavigate("/sites")} className="hover:text-slate-900">ClientsFlow Sites</button>
            <button onClick={() => onNavigate("/login")} className="hover:text-slate-900">Войти</button>
            <button onClick={() => onNavigate("/dashboard")} className="hover:text-slate-900">Личный кабинет</button>
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
        <p className="text-sm font-semibold text-cyan-700">ClientsFlow</p>
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
          <h1 className="text-4xl font-extrabold tracking-tight">Тарифы ClientsFlow</h1>
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
    <div className="min-h-screen bg-[radial-gradient(70%_80%_at_10%_10%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(50%_60%_at_90%_0%,rgba(59,130,246,0.2),transparent_60%),#020617]">
      <div className="sticky top-0 z-40 border-b border-blue-900/50 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button onClick={() => onNavigate("/")} className="text-lg font-extrabold tracking-tight text-white">
            ClientsFlow
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate("/")} className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200">
              Главная
            </button>
            <button onClick={() => onNavigate("/dashboard")} className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
              Личный кабинет
            </button>
          </div>
        </div>
      </div>
      <DashboardApp standaloneSites onNavigate={onNavigate} />
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

  return (
    <>
      {path === "/" ? <HomePage onNavigate={navigate} /> : null}
      {path === "/login" ? <LoginPage onNavigate={navigate} /> : null}
      {path === "/pricing" ? <PricingPage onNavigate={navigate} /> : null}
      {path === "/sites" ? <SitesPage onNavigate={navigate} /> : null}
      {path === "/dashboard" ? <DashboardRoute onNavigate={navigate} /> : null}
      {path === "/workbench" ? <WorkbenchRoute onNavigate={navigate} /> : null}
    </>
  );
}
