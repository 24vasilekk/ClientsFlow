import { FormEvent, useMemo, useState } from "react";

type ChatSitesBuilderPageProps = {
  onNavigate: (path: string) => void;
};

type BuilderStatus = "idle" | "loading" | "success" | "error";
type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  time: string;
  tone?: "default" | "soft";
};

type ServiceItem = {
  id: string;
  emoji: string;
  title: string;
  duration: string;
  price: string;
};

type FaqItem = {
  id: string;
  q: string;
  a: string;
};

type DraftState = {
  businessName: string;
  city: string;
  niche: string;
  accentColor: string;
  pageBg: string;
  surfaceBg: string;
  headlineStyle: "serif" | "sans";
  styleLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutBody: string;
  primaryCta: string;
  secondaryCta: string;
  contactLine: string;
  navItems: string[];
  services: ServiceItem[];
  faq: FaqItem[];
  summaryPoints: string[];
  socialLinks: { telegram?: string; whatsapp?: string; instagram?: string };
};

type AgentProfile = {
  businessName: string;
  niche: string;
  city: string;
  goal: string;
  style: string;
  mustHave: string[];
};

type DesignPreset = {
  id: string;
  label: string;
  accent: string;
  pageBg: string;
  surfaceBg: string;
  headlineStyle: "serif" | "sans";
};

type PublishPayload = {
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
  socialLinks?: { telegram?: string; whatsapp?: string; instagram?: string };
};

const LOCAL_PUBLISHED_SITE_PREFIX = "clientsflow_local_published_site:";
const PUBLISH_REDIRECT_DELAY_MS = 1200;

const navItems = [
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "brain", label: "Brain", icon: "🧠" },
  { key: "tasks", label: "Tasks", icon: "🕒" },
  { key: "artifacts", label: "Artifacts", icon: "◻︎" },
  { key: "files", label: "Files", icon: "📁" },
  { key: "settings", label: "Settings", icon: "⚙︎" }
];

const quickPrompts = [
  "Сайт для салона красоты в Москве",
  "Сделай дорогой минималистичный стиль",
  "Добавь акцент на онлайн-запись",
  "Собери блок услуг с ценами"
];

const suggestions = [
  "Сделай блок отзывов",
  "Добавь команду мастеров",
  "Усиль оффер первого экрана"
];

const channelPills = [
  { id: "wa", label: "WhatsApp", tone: "text-emerald-600" },
  { id: "tg", label: "Telegram", tone: "text-sky-600" }
];

const designPresets: DesignPreset[] = [
  {
    id: "editorial-rose",
    label: "Editorial Rose",
    accent: "#c77a7a",
    pageBg: "#f6f2f3",
    surfaceBg: "#fffafb",
    headlineStyle: "serif"
  },
  {
    id: "noir-modern",
    label: "Noir Modern",
    accent: "#334155",
    pageBg: "#f3f5f8",
    surfaceBg: "#f8fafc",
    headlineStyle: "sans"
  },
  {
    id: "deep-indigo",
    label: "Deep Indigo",
    accent: "#4f46e5",
    pageBg: "#f4f4ff",
    surfaceBg: "#f8f8ff",
    headlineStyle: "sans"
  },
  {
    id: "forest-premium",
    label: "Forest Premium",
    accent: "#0f766e",
    pageBg: "#f2f7f6",
    surfaceBg: "#f8fdfc",
    headlineStyle: "serif"
  }
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function toHref(raw: string) {
  const value = (raw || "").trim();
  if (!value) return "";
  if (/^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith("@")) return `https://t.me/${value.slice(1)}`;
  return `https://${value}`;
}

function statusClass(status: BuilderStatus) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "loading") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function seeded(seed: number) {
  let value = seed || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function pick<T>(items: T[], rnd: () => number) {
  return items[Math.floor(rnd() * items.length)];
}

function detectRegenerateIntent(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("перегенер") ||
    lower.includes("новый вариант") ||
    lower.includes("с нуля") ||
    lower.includes("другой дизайн") ||
    lower.includes("переделай полностью")
  );
}

function normalizeBusinessName(raw: string) {
  return raw
    .replace(/["«»']/g, "")
    .replace(/\b(остальное|сделай|заполни|сам|и)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractBusinessName(text: string) {
  const byName = text.match(/(?:названи[ея]|name)\s*[:\-]?\s*["«]?([a-zа-я0-9][^"»\n,.]{1,42})["»]?/i);
  if (byName?.[1]) {
    const candidate = normalizeBusinessName(byName[1]);
    if (candidate.length >= 2) return candidate;
  }
  const quoted = text.match(/["«]([^"»]{2,42})["»]/);
  if (quoted?.[1]) {
    const candidate = normalizeBusinessName(quoted[1]);
    if (candidate.length >= 2) return candidate;
  }
  return "";
}

function extractCity(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("моск")) return "Москва";
  if (lower.includes("спб") || lower.includes("питер") || lower.includes("санкт")) return "Санкт-Петербург";
  if (lower.includes("казан")) return "Казань";
  if (lower.includes("екб") || lower.includes("екатерин")) return "Екатеринбург";
  return "";
}

function extractNiche(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("барбер")) return "Barbershop";
  if (lower.includes("салон") || lower.includes("nails") || lower.includes("маник")) return "Nail Studio";
  if (lower.includes("клиник") || lower.includes("стомат")) return "Clinic";
  if (lower.includes("юрист") || lower.includes("адвокат")) return "Legal";
  return "";
}

function extractGoal(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("заяв")) return "Больше заявок";
  if (lower.includes("запис")) return "Больше онлайн-записей";
  if (lower.includes("звон")) return "Больше звонков";
  if (lower.includes("продаж")) return "Больше продаж";
  return "";
}

function extractStyle(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("преми") || lower.includes("дорог")) return "Премиальный";
  if (lower.includes("минимал")) return "Минимализм";
  if (lower.includes("строг")) return "Строгий";
  if (lower.includes("дружелюб")) return "Дружелюбный";
  return "";
}

function extractMustHave(text: string) {
  const lower = text.toLowerCase();
  const must: string[] = [];
  if (lower.includes("онлайн") && lower.includes("запис")) must.push("Онлайн-запись");
  if (lower.includes("прайс") || lower.includes("цены")) must.push("Прайс");
  if (lower.includes("галер")) must.push("Галерея работ");
  if (lower.includes("отзыв")) must.push("Отзывы");
  if (lower.includes("команд") || lower.includes("мастер")) must.push("Команда");
  if (lower.includes("контакт")) must.push("Контакты");
  return must;
}

function parseProfileFromMessage(text: string): Partial<AgentProfile> {
  const businessName = extractBusinessName(text);
  const niche = extractNiche(text);
  const city = extractCity(text);
  const goal = extractGoal(text);
  const style = extractStyle(text);
  const mustHave = extractMustHave(text);
  return {
    businessName,
    niche,
    city,
    goal,
    style,
    mustHave
  };
}

function mergeProfile(current: AgentProfile, patch: Partial<AgentProfile>): AgentProfile {
  const next: AgentProfile = { ...current };
  if (patch.businessName) next.businessName = patch.businessName;
  if (patch.niche) next.niche = patch.niche;
  if (patch.city) next.city = patch.city;
  if (patch.goal) next.goal = patch.goal;
  if (patch.style) next.style = patch.style;
  if (patch.mustHave?.length) {
    next.mustHave = Array.from(new Set([...next.mustHave, ...patch.mustHave]));
  }
  return next;
}

function getMissingProfileFields(profile: AgentProfile) {
  const missing: Array<"businessName" | "niche" | "city"> = [];
  if (!profile.businessName.trim()) missing.push("businessName");
  if (!profile.niche.trim()) missing.push("niche");
  if (!profile.city.trim()) missing.push("city");
  return missing;
}

function nextClarifyingQuestion(profile: AgentProfile) {
  const missing = getMissingProfileFields(profile);
  const first = missing[0];
  if (first === "businessName") return "Как называется бизнес? Напиши: «название <имя>».";
  if (first === "niche") return "Какая ниша? Например: барбершоп, салон, клиника, юр. услуги.";
  if (first === "city") return "В каком городе работаете?";
  return "";
}

function shouldForceGenerate(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("сделай сам") ||
    lower.includes("заполни сам") ||
    lower.includes("остальное сам") ||
    lower.includes("сам заполни")
  );
}

function createDraftFromProfile(profile: AgentProfile, guidance = "", round = 1): DraftState {
  const normalizedNiche = profile.niche || "Service";
  const isBarber = normalizedNiche.toLowerCase().includes("barber") || normalizedNiche.toLowerCase().includes("барбер");
  const isNails = normalizedNiche.toLowerCase().includes("nail") || normalizedNiche.toLowerCase().includes("салон");
  const isClinic = normalizedNiche.toLowerCase().includes("clinic") || normalizedNiche.toLowerCase().includes("клиник");

  const seed = hashString(`${profile.businessName}|${profile.niche}|${profile.city}|${profile.goal}|${profile.style}|${guidance}|${round}`);
  const rnd = seeded(seed);
  const preset = pick(designPresets, rnd);

  const businessName = profile.businessName || (isBarber ? "Noe Barbershop" : isNails ? "Nails Beauty" : "Studio Name");
  const nav = isBarber
    ? ["О нас", "Услуги", "Барберы", "Отзывы", "Запись"]
    : isNails
    ? ["О нас", "Услуги", "Команда", "Отзывы", "Запись"]
    : ["О нас", "Услуги", "Отзывы", "FAQ", "Контакты"];

  const barberServices = [
    { emoji: "✂️", title: "Стрижка мужская", duration: "60 мин", price: "1 800 ₽" },
    { emoji: "🧔", title: "Стрижка + борода", duration: "90 мин", price: "2 500 ₽" },
    { emoji: "💈", title: "Оформление бороды", duration: "45 мин", price: "1 200 ₽" },
    { emoji: "🔥", title: "Премиум-комплекс", duration: "120 мин", price: "3 500 ₽" }
  ];
  const nailsServices = [
    { emoji: "💅", title: "Маникюр классический", duration: "60 мин", price: "1 200 ₽" },
    { emoji: "✨", title: "Маникюр с покрытием", duration: "90 мин", price: "1 800 ₽" },
    { emoji: "🦶", title: "Педикюр", duration: "80 мин", price: "2 100 ₽" },
    { emoji: "💎", title: "Комплекс VIP", duration: "120 мин", price: "3 500 ₽" }
  ];
  const clinicServices = [
    { emoji: "🩺", title: "Первичная консультация", duration: "40 мин", price: "2 000 ₽" },
    { emoji: "🧪", title: "Диагностика", duration: "50 мин", price: "3 500 ₽" },
    { emoji: "📋", title: "План лечения", duration: "30 мин", price: "1 500 ₽" },
    { emoji: "✅", title: "Контрольный прием", duration: "25 мин", price: "1 200 ₽" }
  ];
  const base = isBarber ? barberServices : isNails ? nailsServices : isClinic ? clinicServices : nailsServices;
  const services = base.map((item) => ({
    id: uid(),
    emoji: item.emoji,
    title: item.title,
    duration: item.duration,
    price: item.price
  }));

  const heroVariants = isBarber
    ? [
        "Место, где стиль и сервис работают на тебя",
        "Барбершоп, куда возвращаются за уровнем и атмосферой",
        "Точная стрижка, сильный образ, сервис без компромиссов"
      ]
    : isNails
    ? [
        "Место, где сервис - это искусство",
        "Салон, где каждый визит выглядит как забота о себе",
        "Тонкая эстетика и высокий сервис в каждом касании"
      ]
    : [
        "Сервис, где качество чувствуется в каждой детали",
        "Точный процесс, понятный результат, сильная подача",
        "Современный сайт, который превращает интерес в запись"
      ];

  const heroSubtitle = [
    `Собрали индивидуальный сайт для ${businessName} в ${profile.city || "вашем городе"}.`,
    profile.goal ? `Фокус: ${profile.goal.toLowerCase()}.` : "Фокус на конверсии из первого экрана.",
    profile.style ? `Визуальный стиль: ${profile.style.toLowerCase()}.` : `Дизайн-концепт: ${preset.label}.`
  ].join(" ");

  const mustHave = profile.mustHave.length ? profile.mustHave : ["Прайс", "Отзывы", "Онлайн-запись"];
  const summaryPoints = [
    "Индивидуальный первый экран с оффером и CTA",
    `Навигация под нишу: ${nav.join(", ")}`,
    `Секции под задачу: ${mustHave.join(", ")}`,
    `Дизайн-вариант: ${preset.label}`,
    "Готов к публикации и дальнейшей перегенерации"
  ];

  return {
    businessName,
    city: profile.city || "Москва",
    niche: normalizedNiche,
    accentColor: preset.accent,
    pageBg: preset.pageBg,
    surfaceBg: preset.surfaceBg,
    headlineStyle: preset.headlineStyle,
    styleLabel: preset.label,
    heroTitle: pick(heroVariants, rnd),
    heroSubtitle,
    aboutTitle: "О нас",
    aboutBody:
      "Мы собрали структуру под ваш бизнес: понятный оффер, логичный путь к записи и контент, который работает на доверие и конверсию.",
    primaryCta: profile.goal.includes("звон") ? "Позвонить сейчас" : "Записаться",
    secondaryCta: "Открыть прайс",
    contactLine: `${businessName}, ${profile.city || "Москва"}`,
    navItems: nav,
    services,
    faq: [
      {
        id: uid(),
        q: "Как быстро можно записаться?",
        a: "Обычно на ближайшие слоты можно попасть в день обращения или на следующий день."
      },
      {
        id: uid(),
        q: "Можно поменять структуру и стиль?",
        a: "Да, можно перегенерировать дизайн и переписать контент под новый запрос в этом же чате."
      }
    ],
    summaryPoints,
    socialLinks: {}
  };
}

function draftToPayload(draft: DraftState): PublishPayload {
  return {
    businessName: draft.businessName,
    city: draft.city,
    logoUrl: "",
    accentColor: draft.accentColor,
    baseColor: "#f8fafc",
    heroTitle: draft.heroTitle,
    heroSubtitle: draft.heroSubtitle,
    about: `${draft.aboutTitle}. ${draft.aboutBody}`,
    primaryCta: draft.primaryCta,
    secondaryCta: draft.secondaryCta,
    trustStats: [
      { label: "Скорость ответа", value: "< 2 мин" },
      { label: "Конверсия", value: "+28%" },
      { label: "Записей/мес", value: "200+" }
    ],
    valueProps: [],
    processSteps: ["Запрос", "Подбор", "Запись"],
    testimonials: [{ name: "Клиент", role: "Отзыв", text: "Очень удобно: быстро ответили и сразу предложили удобный слот." }],
    faq: draft.faq.map((item) => ({ q: item.q, a: item.a })),
    contactLine: draft.contactLine,
    products: draft.services.map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      description: `${item.duration}. Услуга с понятным результатом и аккуратной подачей.`,
      ctaText: draft.primaryCta,
      images: []
    })),
    sections: {
      about: true,
      valueProps: false,
      services: true,
      process: true,
      gallery: false,
      testimonials: false,
      faq: true,
      cabinet: true,
      contacts: true,
      map: false
    },
    sectionOrder: ["about", "services", "faq", "cabinet", "contacts"],
    galleryUrls: [],
    cabinetEnabled: true,
    telegramBot: "@clientsflow_support_bot",
    socialLinks: draft.socialLinks
  };
}

export default function ChatSitesBuilderPage({ onNavigate }: ChatSitesBuilderPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      text: "Окей, сайт соберу прямо в чате. Напиши нишу, город и что важно на первом экране.",
      time: nowTime(),
      tone: "default"
    }
  ]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [generationStatus, setGenerationStatus] = useState<BuilderStatus>("idle");
  const [paymentStatus, setPaymentStatus] = useState<BuilderStatus>("idle");
  const [publishStatus, setPublishStatus] = useState<BuilderStatus>("idle");
  const [publishPath, setPublishPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [workingText, setWorkingText] = useState("Saving in my memory...");
  const [publishingOverlay, setPublishingOverlay] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("Публикуем сайт...");
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [generationRound, setGenerationRound] = useState(1);
  const [profile, setProfile] = useState<AgentProfile>({
    businessName: "",
    niche: "",
    city: "",
    goal: "",
    style: "",
    mustHave: []
  });

  const canPublish = paymentStatus === "success" && publishStatus !== "loading" && !!draft;

  const addMessage = (role: ChatRole, text: string, tone: "default" | "soft" = "default") => {
    setMessages((prev) => [...prev, { id: uid(), role, text, time: nowTime(), tone }]);
  };

  const applyEditPrompt = (text: string) => {
    const lower = text.toLowerCase();
    const profilePatch = parseProfileFromMessage(text);
    setProfile((prev) => mergeProfile(prev, profilePatch));
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev };

      if (lower.includes("короче")) {
        next.heroSubtitle = next.heroSubtitle.split(".")[0] + ".";
      }
      if (lower.includes("преми") || lower.includes("дорог")) {
        next.accentColor = "#c77a7a";
        next.heroTitle = "Сервис премиум-уровня для тех, кто ценит детали";
      }
      if (lower.includes("запис") || lower.includes("лид")) {
        next.primaryCta = "Записаться онлайн";
        next.secondaryCta = "Выбрать время";
      }
      if (lower.includes("прайс")) {
        next.navItems = ["О нас", "Прайс", "Команда", "Отзывы", "Запись"];
      }
      if (lower.includes("отзыв")) {
        next.aboutBody = `${next.aboutBody} Отдельно усилили социальное доказательство через блок отзывов.`;
      }
      if (profilePatch.businessName) {
        next.businessName = profilePatch.businessName;
        next.contactLine = `${profilePatch.businessName}, ${profilePatch.city || next.city}`;
      }
      if (profilePatch.city) {
        next.city = profilePatch.city;
        next.contactLine = `${next.businessName}, ${profilePatch.city}`;
      }
      if (profilePatch.niche) {
        next.niche = profilePatch.niche;
      }

      return next;
    });
  };

  const generateFromProfile = (nextProfile: AgentProfile, guidance: string, nextRound: number) => {
    setError(null);
    setGenerationStatus("loading");
    setPaymentStatus("idle");
    setPublishStatus("idle");
    setPublishPath("");
    setIsWorking(true);
    setWorkingText("Saving in my memory...");

    window.setTimeout(() => {
      addMessage("assistant", "Окей, понял задачу. Делаю структуру и дизайн под твой запрос.", "soft");
      setWorkingText("Updating pages...");
    }, 260);

    window.setTimeout(() => {
      const nextDraft = createDraftFromProfile(nextProfile, guidance, nextRound);
      setDraft(nextDraft);
      setGenerationRound(nextRound);
      setProfile(nextProfile);
      const summary = nextDraft.summaryPoints.map((point) => `• ${point}`).join("\n");
      addMessage(
        "assistant",
        `Готово. Собрал индивидуальный вариант #${nextRound} для «${nextDraft.businessName}».\n\nЧто уже есть:\n${summary}\n\nЕсли нужно, напиши «перегенерируй» — сделаю новый дизайн с нуля под тот же бриф.`
      );
      setGenerationStatus("success");
      setIsWorking(false);
    }, 1100);
  };

  const onSend = (raw: string) => {
    const text = raw.trim();
    if (!text) return;

    addMessage("user", text);
    setInput("");
    setError(null);

    const profilePatch = parseProfileFromMessage(text);
    const mergedProfile = mergeProfile(profile, profilePatch);
    const needsClarification = getMissingProfileFields(mergedProfile).length > 0;
    const forceGenerate = shouldForceGenerate(text);

    if (!draft) {
      if (needsClarification && !forceGenerate) {
        setProfile(mergedProfile);
        const question = nextClarifyingQuestion(mergedProfile);
        addMessage("assistant", question || "Уточни, пожалуйста, пару деталей и сразу соберу сайт.", "soft");
        return;
      }
      generateFromProfile(mergedProfile, text, 1);
      return;
    }

    if (detectRegenerateIntent(text)) {
      generateFromProfile(mergedProfile, text, generationRound + 1);
      return;
    }

    setGenerationStatus("loading");
    setIsWorking(true);
    setWorkingText("Updating pages...");

    window.setTimeout(() => {
      applyEditPrompt(text);
      addMessage("assistant", "Обновил. Проверяй справа preview, если нужно - сделаю еще варианты.", "soft");
      setGenerationStatus("success");
      setIsWorking(false);
    }, 520);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSend(input);
  };

  const handleMockPayment = () => {
    if (!draft) {
      setError("Сначала создай сайт через чат.");
      return;
    }
    setPaymentStatus("loading");
    window.setTimeout(() => {
      setPaymentStatus("success");
      addMessage("assistant", "Оплата подтверждена. Теперь можно публиковать.", "soft");
    }, 700);
  };

  const handlePublish = async () => {
    if (!draft) {
      setError("Сначала создай сайт через чат.");
      return;
    }
    if (paymentStatus !== "success") {
      setError("Перед публикацией нужно оплатить.");
      return;
    }

    setError(null);
    setPublishStatus("loading");
    setPublishingOverlay(true);
    setOverlayMessage("Публикуем сайт в облаке...");

    const payload = draftToPayload(draft);

    try {
      const response = await fetch("/api/sites/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as { path?: string; slug?: string; error?: string };
      const path = body.path || (body.slug ? `/s/${body.slug}` : "");
      if (!response.ok || !path) throw new Error(body.error || "Не удалось опубликовать");

      setPublishPath(path);
      setPublishStatus("success");
      setOverlayMessage("Сайт опубликован. Открываем...");
      window.setTimeout(() => {
        setPublishingOverlay(false);
        onNavigate(path);
      }, PUBLISH_REDIRECT_DELAY_MS);
    } catch {
      try {
        setOverlayMessage("Облако недоступно. Включаем локальную публикацию...");
        const localSlug = `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        localStorage.setItem(`${LOCAL_PUBLISHED_SITE_PREFIX}${localSlug}`, JSON.stringify({ slug: localSlug, payload }));
        const localPath = `/s/${localSlug}`;
        setPublishPath(localPath);
        setPublishStatus("success");
        setOverlayMessage("Локальная ссылка готова. Открываем...");
        window.setTimeout(() => {
          setPublishingOverlay(false);
          onNavigate(localPath);
        }, PUBLISH_REDIRECT_DELAY_MS);
      } catch {
        setPublishStatus("error");
        setPublishingOverlay(false);
        setError("Публикация не удалась. Попробуйте снова.");
      }
    }
  };

  const previewPanel = (
    <div className="flex h-full flex-col">
      <div className="rounded-[22px] border border-slate-200/90 bg-white p-4 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-slate-900">Published Home</p>
          <button
            type="button"
            onClick={() => setPreviewExpanded((prev) => !prev)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            {previewExpanded ? "⌃ Hide preview" : "⌄ Show preview"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (publishPath) onNavigate(publishPath);
            }}
            className="rounded-xl bg-[#f97316] px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            ↗ Open App
          </button>
          <button type="button" className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200/70">
            ✎ Edit
          </button>
          <button type="button" className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200/70">
            ⟳ Refresh
          </button>
          <span className={`ml-auto rounded-full border px-2 py-1 text-xs ${statusClass(generationStatus)}`}>Build</span>
          <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(paymentStatus)}`}>Pay</span>
          <span className={`rounded-full border px-2 py-1 text-xs ${statusClass(publishStatus)}`}>Publish</span>
        </div>

        {previewExpanded ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-[#eef1f6] px-4 py-2 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                <span className="ml-2 truncate">https://preview.clientsflow.app/Home</span>
              </div>
              <span>↗</span>
            </div>

            <div style={{ backgroundColor: draft?.pageBg || "#f6f2f3" }}>
              <div className="flex items-center justify-between border-b border-[#e8d8da] bg-white/80 px-6 py-4">
                <p className="text-3xl font-semibold" style={{ color: draft?.accentColor || "#c77a7a" }}>
                  ✿ {draft?.businessName || "Studio"}
                </p>
                <div className="hidden items-center gap-6 text-base text-slate-700 2xl:flex">
                  {(draft?.navItems || ["О нас", "Услуги", "Отзывы", "Запись"]).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>

              <div className="mx-auto max-w-[980px] px-6 py-8">
                <div className="mb-2 flex justify-center">
                  <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {draft?.styleLabel || "Generated"}
                  </span>
                </div>
                <p className="text-center text-xs uppercase tracking-[0.35em]" style={{ color: draft?.accentColor || "#c77a7a" }}>
                  {draft?.aboutTitle || "О нас"}
                </p>
                <h3 className={`mt-3 text-center text-4xl leading-tight text-slate-800 md:text-5xl ${draft?.headlineStyle === "serif" ? "font-serif" : "font-semibold"}`}>
                  {draft?.heroTitle || "Место, где сервис - это искусство"}
                </h3>
                <p className="mx-auto mt-4 max-w-[820px] text-center text-lg leading-[1.55] text-slate-600">
                  {draft?.heroSubtitle || "Собери сайт из чата и управляй контентом в одном интерфейсе."}
                </p>

                <div className="mt-8 grid gap-3 lg:grid-cols-2">
                  {(draft?.services || []).slice(0, 4).map((service) => (
                    <div key={service.id} className="rounded-2xl border border-[#efe4e6] bg-white/90 px-4 py-3" style={{ backgroundColor: draft?.surfaceBg || "#fffafb" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-2xl">{service.emoji}</p>
                          <p className="mt-1 text-xl font-semibold leading-snug text-slate-800">{service.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{service.duration}</p>
                        </div>
                        <p className="pt-2 text-2xl font-semibold" style={{ color: draft?.accentColor || "#c77a7a" }}>
                          {service.price}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleMockPayment}
          disabled={paymentStatus === "loading" || paymentStatus === "success" || !draft}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {paymentStatus === "loading" ? "Оплата..." : paymentStatus === "success" ? "Оплачено" : "Оплатить 3 500 ₽"}
        </button>
        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!canPublish}
          className="rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-200/70 disabled:opacity-50"
        >
          {publishStatus === "loading" ? "Публикуем..." : "Опубликовать"}
        </button>
      </div>
      {publishPath ? (
        <button
          type="button"
          onClick={() => onNavigate(publishPath)}
          className="mt-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
        >
          Открыть опубликованный сайт
        </button>
      ) : null}
    </div>
  );

  const timeline = useMemo(() => {
    const rows: Array<{ key: string; node: JSX.Element }> = [];

    messages.forEach((message) => {
      if (message.role === "assistant") {
        rows.push({
          key: message.id,
          node: (
            <div className="flex gap-3">
              <div className="mt-2 h-3.5 w-3.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 shadow-[0_0_0_3px_rgba(56,189,248,.14)]" />
              <div className={`rounded-3xl border px-5 py-3 shadow-[0_22px_50px_-40px_rgba(15,23,42,.45)] transition ${message.tone === "soft" ? "border-slate-200 bg-white/85" : "border-slate-200 bg-white"}`}>
                <p className="text-base leading-[1.35] text-slate-800">{message.text}</p>
                <p className="mt-2 text-xs text-slate-500">{message.time}</p>
              </div>
            </div>
          )
        });
      } else {
        rows.push({
          key: message.id,
          node: (
            <div className="ml-auto max-w-[78%]">
              <div className="mb-1 flex items-center justify-end gap-2 text-sm font-semibold text-slate-500">
                <span>You</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-700">U</span>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white px-5 py-3 shadow-[0_22px_50px_-40px_rgba(15,23,42,.45)] transition">
                <p className="text-base leading-[1.35] text-slate-900">{message.text}</p>
                <p className="mt-2 text-xs text-slate-500">{message.time}</p>
              </div>
            </div>
          )
        });
      }
    });

    if (isWorking) {
      rows.push({
        key: "working",
        node: (
          <div className="flex gap-3">
            <div className="mt-2 h-3.5 w-3.5 shrink-0 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 shadow-[0_0_0_3px_rgba(56,189,248,.14)]" />
            <div>
              <p className="flex items-center gap-1 text-base font-medium text-slate-500">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
                Working...
              </p>
              <div className="mt-1 rounded-3xl border border-slate-200 bg-white/80 px-5 py-3 shadow-[0_20px_50px_-42px_rgba(15,23,42,.45)]">
                <p className="text-sm text-slate-500">{workingText}</p>
              </div>
            </div>
          </div>
        )
      });
    }

    return rows;
  }, [messages, isWorking, workingText]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f3f3f4]">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(circle at 20% 8%, rgba(148,163,184,.18), transparent 24%), radial-gradient(circle at 80% 80%, rgba(99,102,241,.12), transparent 26%)" }} />
      <div className="mx-auto flex min-h-screen w-full max-w-[1820px]">
        <aside className="relative hidden w-[290px] border-r border-slate-200/80 bg-white/78 p-4 backdrop-blur md:flex md:flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-orange-500 to-orange-600 text-white">▤</div>
              <div>
                <p className="text-lg font-semibold text-slate-900">Agent</p>
                <p className="text-sm text-slate-500">My Workspace</p>
              </div>
            </div>
            <button type="button" className="rounded-lg p-2 text-sm text-slate-600 transition hover:bg-slate-100">◫</button>
          </div>

          <div className="mt-5 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                  item.key === "chat"
                    ? "bg-gradient-to-r from-slate-100 to-slate-50 shadow-[inset_0_0_0_1px_rgba(148,163,184,.25)]"
                    : "hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2 text-base text-slate-800">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                {item.key !== "chat" ? <span className="text-base text-slate-500">›</span> : null}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <p className="text-sm text-slate-500">Channels</p>
            <div className="mt-2 space-y-1">
              <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-base text-slate-800 transition hover:bg-slate-50">🟢 Continue on WhatsApp</button>
              <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-base text-slate-800 transition hover:bg-slate-50">🔵 Continue on Telegram</button>
            </div>
          </div>

          <div className="mt-auto pt-4">
            <button type="button" className="flex items-center gap-2 text-base text-slate-700 hover:text-slate-900">💬 Leave feedback</button>
          </div>
        </aside>

        <main className="relative flex min-h-screen flex-1 flex-col">
          <div className="mx-auto w-full max-w-[980px] px-4 pb-44 pt-7 sm:px-8">
            <div className="mb-6 flex items-center gap-4 text-xs font-semibold text-slate-500">
              <div className="h-px flex-1 bg-slate-300" />
              <span>Today</span>
              <div className="h-px flex-1 bg-slate-300" />
            </div>

            <div className="space-y-4">{timeline.map((row) => <div key={row.key}>{row.node}</div>)}</div>

            <div className="mt-6 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSend(prompt)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
          </div>

          <div className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-1rem)] max-w-[980px] -translate-x-1/2 sm:bottom-6">
            <div className="mb-2 flex items-center justify-center">
              <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-500 shadow-[0_12px_30px_-24px_rgba(15,23,42,.45)]">
                Chat with me from an app you already use ·{" "}
                {channelPills.map((item) => (
                  <span key={item.id} className={`mr-2 font-semibold ${item.tone}`}>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <form
              onSubmit={onSubmit}
              className="flex items-center gap-2 rounded-[22px] border border-[#b7c0ff] bg-white/96 px-3 py-2 shadow-[0_24px_65px_-44px_rgba(15,23,42,.45)] backdrop-blur transition focus-within:shadow-[0_28px_70px_-40px_rgba(99,102,241,.5)]"
            >
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-xl text-slate-700 transition hover:bg-slate-100">+</button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="h-11 flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg text-slate-700 transition hover:bg-slate-100">◉</button>
              <button type="submit" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-300 text-sm text-slate-700 transition hover:bg-slate-400">➤</button>
            </form>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-semibold">Suggestions</span>
              {suggestions.map((item) => (
                <button key={item} type="button" onClick={() => onSend(item)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 transition hover:border-slate-300 hover:bg-slate-50">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </main>

        <aside className="hidden w-[760px] border-l border-slate-200/80 bg-[#f5f5f6] p-4 xl:block">{previewPanel}</aside>
      </div>

      <button
        type="button"
        onClick={() => setShowPreviewMobile(true)}
        className="fixed bottom-24 right-4 z-40 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg xl:hidden"
      >
        Open preview
      </button>

      {showPreviewMobile ? (
        <div className="fixed inset-0 z-50 bg-slate-950/40 p-3 xl:hidden">
          <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f5f5f6]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              <button type="button" onClick={() => setShowPreviewMobile(false)} className="rounded border border-slate-300 px-2 py-1 text-sm font-semibold text-slate-700">
                Закрыть
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">{previewPanel}</div>
          </div>
        </div>
      ) : null}

      {publishingOverlay ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-300" />
            <p className="mt-4 text-sm font-semibold text-white">{overlayMessage}</p>
            <p className="mt-2 text-xs text-slate-300">Подготавливаем ссылку для вашего сайта.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
