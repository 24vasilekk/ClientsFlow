import { FormEvent, useEffect, useMemo, useState } from "react";
import SitesPageShell from "./PageShell";
import { sitesTokens } from "./tokens";

type ChatSitesBuilderPageProps = {
  onNavigate: (path: string) => void;
};

type BuilderStatus = "idle" | "loading" | "success" | "error";
type Phase = "interview" | "concepts" | "editor" | "publish";
type ChatRole = "assistant" | "user";
type ChatMessage = { id: string; role: ChatRole; text: string };
type SectionKey = "about" | "services" | "faq";

type BriefKey =
  | "business_name"
  | "niche"
  | "city"
  | "audience"
  | "main_offer"
  | "goal"
  | "tone"
  | "difference"
  | "cta"
  | "avg_check"
  | "faq_1"
  | "faq_2"
  | "contacts"
  | "telegram_link"
  | "instagram_link"
  | "style_hint";

type BriefState = Record<BriefKey, string>;

type InterviewQuestion = {
  id: BriefKey;
  label: string;
  required: boolean;
  placeholder?: string;
  helper?: string;
};

type StructuredBrief = {
  businessBrief: string;
  offerBrief: string;
  styleBrief: string;
  contentBrief: string;
  sectionPlan: string;
  visualConstraints: string;
};

type ProductCard = {
  id: string;
  title: string;
  price: string;
  description: string;
  ctaText: string;
  images: string[];
};

type SiteConcept = {
  id: string;
  name: "Premium" | "Conversion" | "Trust" | "Minimal";
  description: string;
  palette: { accent: string; base: string; hero: string };
  hero: { title: string; subtitle: string; primaryCta: string; secondaryCta: string };
  about: string;
  services: ProductCard[];
  testimonials: Array<{ name: string; role: string; text: string }>;
  faq: Array<{ q: string; a: string }>;
};

type DraftState = {
  conceptId: string;
  businessName: string;
  city: string;
  logoUrl: string;
  palette: { accent: string; base: string; hero: string };
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta: string;
  about: string;
  products: ProductCard[];
  testimonials: Array<{ name: string; role: string; text: string }>;
  faq: Array<{ q: string; a: string }>;
  contactLine: string;
  socialLinks: { telegram?: string; whatsapp?: string; instagram?: string };
  galleryUrls: string[];
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
  products: ProductCard[];
  sections: Record<string, boolean>;
  sectionOrder: string[];
  galleryUrls: string[];
  cabinetEnabled: boolean;
  telegramBot: string;
  socialLinks?: { telegram?: string; whatsapp?: string; instagram?: string };
};

type PersistedState = {
  phase: Phase;
  messages: ChatMessage[];
  currentQuestionIndex: number;
  brief: BriefState;
  logoUrl: string;
  photos: string[];
  references: Array<{ id: string; url: string; likesStyle: boolean; likesStructure: boolean; likesOffer: boolean }>;
  structuredBrief: StructuredBrief | null;
  concepts: SiteConcept[];
  selectedConceptId: string;
  draft: DraftState | null;
  generationStatus: BuilderStatus;
  paymentStatus: BuilderStatus;
  publishStatus: BuilderStatus;
  publishPath: string;
  sectionOrder: SectionKey[];
  sectionsEnabled: Record<SectionKey, boolean>;
  selectedSection: SectionKey | null;
};

const STORAGE_KEY = "clientsflow_sites_chat_builder_v2";
const LOCAL_PUBLISHED_SITE_PREFIX = "clientsflow_local_published_site:";
const PUBLISH_REDIRECT_DELAY_MS = 1300;
const generationStages = [
  "Анализируем нишу и оффер",
  "Подбираем структуру секций",
  "Собираем визуальный стиль",
  "Генерируем тексты и витрину услуг"
];

const phaseMeta: Array<{ id: Phase; label: string }> = [
  { id: "interview", label: "Интервью" },
  { id: "concepts", label: "Концепты" },
  { id: "editor", label: "Редактор" },
  { id: "publish", label: "Публикация" }
];

const baseQuestions: InterviewQuestion[] = [
  { id: "business_name", label: "Как называется ваш бизнес?", required: true },
  { id: "niche", label: "Какая ниша бизнеса?", required: true, placeholder: "например: салон, клиника, ремонт" },
  { id: "city", label: "В каком городе вы работаете?", required: true },
  { id: "audience", label: "Кто ваш основной клиент?", required: true },
  { id: "main_offer", label: "Какая ключевая услуга/оффер на первой секции?", required: true },
  { id: "goal", label: "Главная цель сайта: заявки, записи, звонки, продажи?", required: true },
  { id: "tone", label: "Тон сайта: премиальный, строгий, дружелюбный, минимальный?", required: true },
  { id: "difference", label: "Чем вы отличаетесь от конкурентов?", required: true },
  { id: "cta", label: "Какой основной призыв на кнопке?", required: true, placeholder: "Оставить заявку / Записаться" },
  { id: "avg_check", label: "Средний чек или диапазон цен (по желанию)?", required: false },
  { id: "faq_1", label: "Частый вопрос клиента №1", required: true },
  { id: "faq_2", label: "Частый вопрос клиента №2", required: true },
  { id: "contacts", label: "Контакт для связи (телефон/email)", required: true },
  { id: "telegram_link", label: "Ссылка на Telegram (опционально)", required: false },
  { id: "instagram_link", label: "Ссылка на Instagram (опционально)", required: false },
  { id: "style_hint", label: "На что должен быть похож сайт визуально?", required: true, helper: "Опишите 2-3 ориентира: настроение, плотность, цвета." }
];

const nicheQuestions: Record<string, InterviewQuestion[]> = {
  beauty: [
    { id: "main_offer", label: "Какая услуга должна быть в фокусе: окрашивание, стрижка, уход?", required: true },
    { id: "cta", label: "Какой CTA важнее: Записаться / Получить консультацию?", required: true }
  ],
  clinic: [
    { id: "difference", label: "Какой фактор доверия важен: опыт врачей, лицензии, оборудование?", required: true },
    { id: "faq_1", label: "Какой медицинский вопрос клиенты задают чаще всего?", required: true }
  ],
  service: [
    { id: "goal", label: "Что важнее на первом экране: скорость выезда или стоимость?", required: true },
    { id: "faq_2", label: "Какой вопрос о сроках/гарантии задают чаще всего?", required: true }
  ]
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function detectNicheBucket(niche: string) {
  const n = niche.toLowerCase();
  if (n.includes("салон") || n.includes("барбер") || n.includes("beauty")) return "beauty";
  if (n.includes("клиник") || n.includes("стомат") || n.includes("мед")) return "clinic";
  return "service";
}

function toHref(raw: string) {
  const value = (raw || "").trim();
  if (!value) return "";
  if (/^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith("@")) return `https://t.me/${value.slice(1)}`;
  return `https://${value}`;
}

function parsePromptIntoDraft(input: string): Partial<BriefState> {
  const text = input.toLowerCase();
  const patch: Partial<BriefState> = {};
  if (text.includes("салон")) patch.niche = "салон красоты";
  if (text.includes("стом") || text.includes("клиник")) patch.niche = "клиника";
  if (text.includes("авто")) patch.niche = "автосервис";
  if (text.includes("юрист") || text.includes("адвокат")) patch.niche = "юридические услуги";
  if (text.includes("моск")) patch.city = "Москва";
  if (text.includes("преми")) patch.tone = "премиальный";
  if (text.includes("строг")) patch.tone = "строгий";
  if (text.includes("заяв")) patch.goal = "больше заявок";
  if (text.includes("запис")) patch.goal = "больше записей";
  return patch;
}

function buildStructuredBrief(brief: BriefState, referencesCount: number, photosCount: number): StructuredBrief {
  const business = brief.business_name || "Бизнес";
  const niche = brief.niche || "сервис";
  const city = brief.city || "город";
  return {
    businessBrief: `${business} работает в нише «${niche}» в городе ${city}. Целевая аудитория: ${brief.audience || "локальные клиенты"}.`,
    offerBrief: `Ключевой оффер: ${brief.main_offer || "основная услуга"}. Отличие: ${brief.difference || "понятный сервис"}.`,
    styleBrief: `Тон: ${brief.tone || "премиальный"}. Визуальный ориентир: ${brief.style_hint || "чистый современный стиль"}.`,
    contentBrief: `Основной CTA: ${brief.cta || "Оставить заявку"}. FAQ: ${brief.faq_1 || "вопрос 1"}; ${brief.faq_2 || "вопрос 2"}.`,
    sectionPlan: `Hero -> About -> Services -> Testimonials -> FAQ -> Contacts. Референсов: ${referencesCount}. Фото: ${photosCount}.`,
    visualConstraints: "Без визуального шума, аккуратная типографика, крупные отступы, мягкие тени, тонкие бордеры."
  };
}

function createServices(brief: BriefState, photos: string[]): ProductCard[] {
  const offer = brief.main_offer || "Ключевая услуга";
  const avg = (brief.avg_check || "").trim();
  return [
    {
      id: uid(),
      title: offer,
      price: avg ? `от ${avg}` : "от 3 500 ₽",
      description: "Основная услуга с четким оффером и понятным следующим шагом.",
      ctaText: brief.cta || "Оставить заявку",
      images: photos[0] ? [photos[0]] : []
    },
    {
      id: uid(),
      title: "Консультация",
      price: "бесплатно",
      description: "Короткий диалог для уточнения задачи и предложения подходящего решения.",
      ctaText: "Записаться",
      images: photos[1] ? [photos[1]] : []
    },
    {
      id: uid(),
      title: "Пакетное решение",
      price: "по запросу",
      description: "Комплексная работа по этапам с прогнозируемым результатом.",
      ctaText: "Получить расчет",
      images: photos[2] ? [photos[2]] : []
    }
  ];
}

function generateConcepts(brief: BriefState, sb: StructuredBrief | null, logoUrl: string, photos: string[]): SiteConcept[] {
  const business = brief.business_name || "Ваш бизнес";
  const city = brief.city || "Россия";
  const niche = brief.niche || "сервис";
  const cta = brief.cta || "Оставить заявку";
  const services = createServices(brief, photos);
  const faq = [
    { q: brief.faq_1 || "Сколько стоит услуга?", a: "Стоимость зависит от задачи, точный расчет даем после уточнения деталей." },
    { q: brief.faq_2 || "Как быстро можно начать?", a: "В большинстве случаев старт возможен в ближайшие дни." },
    { q: "Можно ли адаптировать под мой формат?", a: "Да, сценарий и структура настраиваются под ваш процесс." }
  ];

  return [
    {
      id: "premium",
      name: "Premium",
      description: "Премиальная подача с акцентом на доверие и качество сервиса.",
      palette: { accent: "#0f172a", base: "#f7f8fb", hero: "#eaf1ff" },
      hero: {
        title: `${business} — сервис, который выбирают по качеству`,
        subtitle: `${niche}, ${city}. ${sb?.offerBrief || "Акцент на понятном оффере и аккуратной коммуникации."}`,
        primaryCta: cta,
        secondaryCta: "Смотреть услуги"
      },
      about: sb?.businessBrief || `${business} — надежный партнер в нише ${niche}.`,
      services,
      testimonials: [
        { name: "Алина", role: "клиент", text: "Очень понятная подача и быстрый ответ после заявки." },
        { name: "Игорь", role: "руководитель", text: "Сайт выглядит дорого и при этом не перегружен." },
        { name: "Мария", role: "администратор", text: "Клиенты стали чаще доходить до записи." }
      ],
      faq
    },
    {
      id: "conversion",
      name: "Conversion",
      description: "Плотная структура с фокусом на заявки и действия.",
      palette: { accent: "#1d4ed8", base: "#f4f8ff", hero: "#dde9ff" },
      hero: {
        title: `${business}: быстрый путь от запроса к записи`,
        subtitle: `Фокус на конверсии: ${brief.goal || "больше заявок"}. ${sb?.contentBrief || "Короткий путь к целевому действию."}`,
        primaryCta: cta,
        secondaryCta: "Получить расчет"
      },
      about: sb?.businessBrief || `${business} в ${city} с быстрым первым контактом.`,
      services,
      testimonials: [
        { name: "Ольга", role: "маркетолог", text: "Стало проще вести трафик на конкретное действие." },
        { name: "Сергей", role: "собственник", text: "Меньше случайных обращений, больше целевых." },
        { name: "Наталья", role: "менеджер", text: "Наконец понятная структура, которую легко объяснить клиенту." }
      ],
      faq
    },
    {
      id: "trust",
      name: "Trust",
      description: "Спокойный экспертный стиль для ниш, где важна репутация.",
      palette: { accent: "#334155", base: "#f8fafc", hero: "#edf2f7" },
      hero: {
        title: `${business} — экспертный подход без лишнего шума`,
        subtitle: `${sb?.styleBrief || "Акцент на ясных формулировках и доверии."}`,
        primaryCta: cta,
        secondaryCta: "Задать вопрос"
      },
      about: sb?.businessBrief || `${business} предоставляет услуги с прозрачным процессом и понятными этапами.`,
      services,
      testimonials: [
        { name: "Виктор", role: "клиент", text: "Все объяснили спокойно и по делу." },
        { name: "Елена", role: "клиент", text: "Понравилась прозрачность и предсказуемый процесс." },
        { name: "Роман", role: "партнер", text: "Хорошая репутационная подача, без маркетингового шума." }
      ],
      faq
    },
    {
      id: "minimal",
      name: "Minimal",
      description: "Минималистичный интерфейс с чистой типографикой.",
      palette: { accent: "#111827", base: "#ffffff", hero: "#f3f4f6" },
      hero: {
        title: `${business} — просто, быстро, по делу`,
        subtitle: `Короткая структура и четкий CTA. ${brief.main_offer || "Главная услуга"}.`,
        primaryCta: cta,
        secondaryCta: "Подробнее"
      },
      about: sb?.businessBrief || `${business} в нише ${niche}.`,
      services,
      testimonials: [
        { name: "Антон", role: "клиент", text: "Лаконично и удобно, сразу нашел нужную услугу." },
        { name: "Юлия", role: "клиент", text: "Все выглядит аккуратно и современно." },
        { name: "Павел", role: "руководитель", text: "Минимум отвлекающих элементов, максимум пользы." }
      ],
      faq
    }
  ];
}

function createDraftFromConcept(concept: SiteConcept, brief: BriefState, logoUrl: string, photos: string[]): DraftState {
  return {
    conceptId: concept.id,
    businessName: brief.business_name || "Ваш бизнес",
    city: brief.city || "",
    logoUrl,
    palette: concept.palette,
    heroTitle: concept.hero.title,
    heroSubtitle: concept.hero.subtitle,
    primaryCta: concept.hero.primaryCta,
    secondaryCta: concept.hero.secondaryCta,
    about: concept.about,
    products: concept.services.map((item, index) => ({ ...item, images: item.images.length ? item.images : photos[index] ? [photos[index]] : [] })),
    testimonials: concept.testimonials,
    faq: concept.faq,
    contactLine: brief.contacts || `${brief.business_name || "Бизнес"}, ${brief.city || "город"}`,
    socialLinks: {
      telegram: brief.telegram_link,
      instagram: brief.instagram_link,
      whatsapp: ""
    },
    galleryUrls: photos
  };
}

function draftToPayload(draft: DraftState): PublishPayload {
  return {
    businessName: draft.businessName,
    city: draft.city,
    logoUrl: draft.logoUrl,
    accentColor: draft.palette.accent,
    baseColor: draft.palette.base,
    heroTitle: draft.heroTitle,
    heroSubtitle: draft.heroSubtitle,
    about: draft.about,
    primaryCta: draft.primaryCta,
    secondaryCta: draft.secondaryCta,
    trustStats: [
      { label: "Скорость ответа", value: "< 2 мин" },
      { label: "Конверсия", value: "+28%" },
      { label: "Заявок/мес", value: "200+" }
    ],
    valueProps: [],
    processSteps: ["Заявка", "Уточнение", "Запись"],
    testimonials: draft.testimonials,
    faq: draft.faq,
    contactLine: draft.contactLine,
    products: draft.products,
    sections: {
      about: true,
      valueProps: false,
      services: true,
      process: true,
      gallery: draft.galleryUrls.length > 0,
      testimonials: false,
      faq: true,
      cabinet: true,
      contacts: true,
      map: false
    },
    sectionOrder: ["about", "services", "faq", "cabinet", "contacts"],
    galleryUrls: draft.galleryUrls,
    cabinetEnabled: true,
    telegramBot: "@clientsflow_support_bot",
    socialLinks: draft.socialLinks
  };
}

function statusChipClass(status: BuilderStatus) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "loading") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

const initialBrief: BriefState = {
  business_name: "",
  niche: "",
  city: "",
  audience: "",
  main_offer: "",
  goal: "",
  tone: "",
  difference: "",
  cta: "",
  avg_check: "",
  faq_1: "",
  faq_2: "",
  contacts: "",
  telegram_link: "",
  instagram_link: "",
  style_hint: ""
};

const quickPrompts = [
  "Сделай сайт для салона красоты в Москве",
  "Нужен строгий сайт для клиники с акцентом на доверие",
  "Хочу современный сайт для автосервиса",
  "Сайт для юриста с фокусом на заявки"
];

export default function ChatSitesBuilderPage({ onNavigate }: ChatSitesBuilderPageProps) {
  const [phase, setPhase] = useState<Phase>("interview");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      text: "Опишите задачу. Я сам проведу вас по вопросам и соберу сайт с предпросмотром справа."
    }
  ]);
  const [input, setInput] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [brief, setBrief] = useState<BriefState>(initialBrief);
  const [logoUrl, setLogoUrl] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [references, setReferences] = useState<Array<{ id: string; url: string; likesStyle: boolean; likesStructure: boolean; likesOffer: boolean }>>([
    { id: uid(), url: "", likesStyle: true, likesStructure: false, likesOffer: false }
  ]);
  const [structuredBrief, setStructuredBrief] = useState<StructuredBrief | null>(null);
  const [concepts, setConcepts] = useState<SiteConcept[]>([]);
  const [selectedConceptId, setSelectedConceptId] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [generationStatus, setGenerationStatus] = useState<BuilderStatus>("idle");
  const [paymentStatus, setPaymentStatus] = useState<BuilderStatus>("idle");
  const [publishStatus, setPublishStatus] = useState<BuilderStatus>("idle");
  const [publishPath, setPublishPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publishingOverlay, setPublishingOverlay] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState("Публикуем сайт...");
  const [generationStageIndex, setGenerationStageIndex] = useState(0);
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(["about", "services", "faq"]);
  const [sectionsEnabled, setSectionsEnabled] = useState<Record<SectionKey, boolean>>({
    about: true,
    services: true,
    faq: true
  });
  const [dragSection, setDragSection] = useState<SectionKey | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionKey | null>(null);
  const [dragFaqIndex, setDragFaqIndex] = useState<number | null>(null);

  const questions = useMemo(() => {
    const bucket = detectNicheBucket(brief.niche);
    const extra = nicheQuestions[bucket] || [];
    const merged = [...baseQuestions];
    for (const q of extra) {
      const index = merged.findIndex((item) => item.id === q.id);
      if (index >= 0) merged[index] = q;
    }
    return merged;
  }, [brief.niche]);

  const currentQuestion = questions[Math.min(currentQuestionIndex, Math.max(questions.length - 1, 0))] || null;
  const requiredQuestions = useMemo(() => questions.filter((q) => q.required), [questions]);
  const requiredAnsweredCount = useMemo(
    () => requiredQuestions.filter((q) => (brief[q.id] || "").trim().length > 0).length,
    [requiredQuestions, brief]
  );
  const interviewProgress = useMemo(() => Math.round((requiredAnsweredCount / Math.max(requiredQuestions.length, 1)) * 100), [requiredAnsweredCount, requiredQuestions.length]);
  const referencesCount = useMemo(() => references.filter((r) => r.url.trim().length > 0).length, [references]);
  const canBuildStructuredBrief = requiredQuestions.every((q) => (brief[q.id] || "").trim().length > 0) && referencesCount >= 1;
  const canGenerateConcepts = canBuildStructuredBrief;

  useEffect(() => {
    if (messages.length === 1 && currentQuestion) {
      setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: currentQuestion.label }]);
    }
  }, [messages.length, currentQuestion]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedState;
      setPhase(parsed.phase || "interview");
      if (parsed.messages?.length) setMessages(parsed.messages);
      setCurrentQuestionIndex(parsed.currentQuestionIndex || 0);
      setBrief(parsed.brief || initialBrief);
      setLogoUrl(parsed.logoUrl || "");
      setPhotos(parsed.photos || []);
      setReferences(parsed.references?.length ? parsed.references : [{ id: uid(), url: "", likesStyle: true, likesStructure: false, likesOffer: false }]);
      setStructuredBrief(parsed.structuredBrief || null);
      setConcepts(parsed.concepts || []);
      setSelectedConceptId(parsed.selectedConceptId || "");
      setDraft(parsed.draft || null);
      setGenerationStatus(parsed.generationStatus || "idle");
      setPaymentStatus(parsed.paymentStatus || "idle");
      setPublishStatus(parsed.publishStatus || "idle");
      setPublishPath(parsed.publishPath || "");
      setSectionOrder(parsed.sectionOrder?.length ? parsed.sectionOrder : ["about", "services", "faq"]);
      setSectionsEnabled(parsed.sectionsEnabled || { about: true, services: true, faq: true });
      setSelectedSection(parsed.selectedSection || null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const payload: PersistedState = {
      phase,
      messages,
      currentQuestionIndex,
      brief,
      logoUrl,
      photos,
      references,
      structuredBrief,
      concepts,
      selectedConceptId,
      draft,
      generationStatus,
      paymentStatus,
      publishStatus,
      publishPath,
      sectionOrder,
      sectionsEnabled,
      selectedSection
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [phase, messages, currentQuestionIndex, brief, logoUrl, photos, references, structuredBrief, concepts, selectedConceptId, draft, generationStatus, paymentStatus, publishStatus, publishPath, sectionOrder, sectionsEnabled, selectedSection]);

  const addMessage = (role: ChatRole, text: string) => {
    setMessages((prev) => [...prev, { id: uid(), role, text }]);
  };

  const fileToData = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Ошибка чтения")));
      reader.onerror = () => reject(new Error("Ошибка чтения"));
      reader.readAsDataURL(file);
    });

  const onUploadLogo = async (files: FileList | null) => {
    if (!files?.[0]) return;
    try {
      const data = await fileToData(files[0]);
      setLogoUrl(data);
      addMessage("assistant", "Логотип получен. Добавлю его в шапку и фирменные блоки.");
    } catch {
      setError("Не удалось загрузить логотип.");
    }
  };

  const onUploadPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const data = await Promise.all(Array.from(files).slice(0, 10).map((file) => fileToData(file)));
      setPhotos(data);
      addMessage("assistant", `Принял фото: ${data.length}. Учту в превью и секциях.`);
    } catch {
      setError("Не удалось загрузить фотографии.");
    }
  };

  const handleUserText = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setError(null);
    addMessage("user", clean);

    const patch = parsePromptIntoDraft(clean);
    if (Object.keys(patch).length > 0) setBrief((prev) => ({ ...prev, ...patch }));

    if (phase === "interview" && currentQuestion) {
      setBrief((prev) => ({ ...prev, [currentQuestion.id]: clean }));
      const next = currentQuestionIndex + 1;
      setCurrentQuestionIndex(next);
      if (next < questions.length) {
        addMessage("assistant", questions[next].label);
      } else {
        addMessage("assistant", "Бриф заполнен. Добавьте логотип, фото и минимум один сайт-пример, потом нажмите «Собрать бриф».");
      }
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleUserText(input);
    setInput("");
  };

  const buildBriefAndConcepts = () => {
    if (!canBuildStructuredBrief) {
      setError("Заполните обязательные вопросы и добавьте минимум 1 сайт-пример.");
      return;
    }
    setError(null);
    setGenerationStatus("loading");
    setGenerationStageIndex(0);
    const stageTimer = window.setInterval(() => {
      setGenerationStageIndex((prev) => (prev + 1) % generationStages.length);
    }, 260);
    window.setTimeout(() => {
      const sb = buildStructuredBrief(brief, referencesCount, photos.length);
      const generated = generateConcepts(brief, sb, logoUrl, photos);
      const first = generated[0];
      setStructuredBrief(sb);
      setConcepts(generated);
      setSelectedConceptId(first.id);
      setDraft(createDraftFromConcept(first, brief, logoUrl, photos));
      setGenerationStatus("success");
      setPhase("concepts");
      addMessage("assistant", "Готово. Я собрал 4 концепта. Выберите подходящий и откройте редактор.");
      window.clearInterval(stageTimer);
    }, 950);
  };

  const selectConcept = (id: string) => {
    setSelectedConceptId(id);
    const concept = concepts.find((item) => item.id === id);
    if (!concept) return;
    setDraft(createDraftFromConcept(concept, brief, logoUrl, photos));
  };

  const applyAiEdit = (mode: "short" | "premium" | "trust" | "booking") => {
    if (!draft) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      if (mode === "short") {
        next.heroSubtitle = next.heroSubtitle.split(".")[0] + ".";
        next.about = next.about.split(".").slice(0, 2).join(".") + ".";
      }
      if (mode === "premium") {
        next.heroTitle = `${next.businessName} — премиальный уровень сервиса`;
      }
      if (mode === "trust") {
        next.testimonials = next.testimonials.map((t) => ({ ...t, text: `${t.text} Всё по этапам и с понятными условиями.` }));
      }
      if (mode === "booking") {
        next.primaryCta = "Записаться сейчас";
        next.secondaryCta = "Выбрать время";
      }
      return next;
    });
  };

  const moveService = (index: number, direction: -1 | 1) => {
    if (!draft) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.products.length) return;
    setDraft((prev) => {
      if (!prev) return prev;
      const items = [...prev.products];
      const [moved] = items.splice(index, 1);
      items.splice(nextIndex, 0, moved);
      return { ...prev, products: items };
    });
  };

  const handleMockPayment = () => {
    setPaymentStatus("loading");
    window.setTimeout(() => {
      setPaymentStatus("success");
      setPhase("publish");
      addMessage("assistant", "Оплата подтверждена. Теперь можно публиковать сайт.");
    }, 900);
  };

  const handlePublish = async () => {
    if (!draft) {
      setError("Сначала сгенерируйте и выберите концепт.");
      return;
    }
    if (paymentStatus !== "success") {
      setError("Сначала оплатите 3 500 ₽.");
      return;
    }
    setError(null);
    setPublishStatus("loading");
    setPublishingOverlay(true);
    setOverlayMessage("Публикуем сайт в облаке...");

    const payload = draftToPayload(draft);
    payload.sectionOrder = [...sectionOrder, "cabinet", "contacts"];
    payload.sections = {
      ...payload.sections,
      about: sectionsEnabled.about,
      services: sectionsEnabled.services,
      faq: sectionsEnabled.faq
    };

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
    } catch (e) {
      try {
        setOverlayMessage("Облако недоступно. Включаем локальную публикацию...");
        const localSlug = `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        localStorage.setItem(`${LOCAL_PUBLISHED_SITE_PREFIX}${localSlug}`, JSON.stringify({ slug: localSlug, payload }));
        const localPath = `/s/${localSlug}`;
        setPublishPath(localPath);
        setPublishStatus("success");
        setOverlayMessage("Локальная публикация готова. Открываем...");
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

  const moveSection = (key: SectionKey, direction: -1 | 1) => {
    const sourceIndex = sectionOrder.findIndex((item) => item === key);
    const targetIndex = sourceIndex + direction;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= sectionOrder.length) return;
    const next = [...sectionOrder];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setSectionOrder(next);
  };

  const duplicateSection = (key: SectionKey) => {
    if (!draft) return;
    if (key === "about") {
      setDraft((prev) => (prev ? { ...prev, about: `${prev.about}\n\n${prev.about}` } : prev));
      return;
    }
    if (key === "services") {
      setDraft((prev) => {
        if (!prev || prev.products.length === 0) return prev;
        const source = prev.products[Math.max(prev.products.length - 1, 0)];
        const clone: ProductCard = {
          ...source,
          id: uid(),
          title: `${source.title} (копия)`
        };
        return { ...prev, products: [...prev.products, clone] };
      });
      return;
    }
    setDraft((prev) => {
      if (!prev || prev.faq.length === 0) return prev;
      const source = prev.faq[Math.max(prev.faq.length - 1, 0)];
      const clone = { ...source, q: `${source.q} (копия)` };
      return { ...prev, faq: [...prev.faq, clone] };
    });
  };

  return (
    <SitesPageShell onNavigate={onNavigate}>
      <div className="mt-2 rounded-3xl border border-slate-200/90 bg-white/85 p-2 shadow-[0_14px_40px_-28px_rgba(15,23,42,.45)] backdrop-blur">
      <div className="flex flex-wrap gap-2">
        {phaseMeta.map((item) => (
          <button
            key={item.id}
            onClick={() => setPhase(item.id)}
            className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
              phase === item.id
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${phase === item.id ? "bg-white/20" : "bg-slate-100"}`}>
              {phaseMeta.findIndex((p) => p.id === item.id) + 1}
            </span>
            {item.label}
          </button>
        ))}
      </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className={sitesTokens.surface}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className={sitesTokens.title}>Чат-конструктор CFlow Sites</h2>
              <p className="mt-1 text-sm text-slate-600">Простой сценарий для любого пользователя: отвечаете на вопросы, выбираете концепт, правите и публикуете.</p>
            </div>
            <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">Обязательные ответы: {requiredAnsweredCount}/{requiredQuestions.length}</span>
          </div>

          {phase === "interview" ? (
            <>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Прогресс интервью</span>
                  <span>{interviewProgress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-2 rounded-full bg-gradient-to-r from-slate-900 via-slate-700 to-cyan-600 transition-all" style={{ width: `${Math.max(5, interviewProgress)}%` }} />
                </div>
              </div>

              <div className="mt-3 h-[460px] overflow-y-auto rounded-[24px] border border-slate-200 bg-[#f9fafb] p-3">
                <div className="space-y-2">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm ${
                        message.role === "assistant"
                          ? "border border-slate-200 bg-white text-slate-800"
                          : "ml-auto bg-slate-900 text-white"
                      }`}
                    >
                      {message.text}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button key={prompt} onClick={() => handleUserText(prompt)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {prompt}
                  </button>
                ))}
              </div>

              <form onSubmit={onSubmit} className="mt-3 flex gap-2">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={currentQuestion?.placeholder || "Напишите ответ..."} className="h-11 flex-1 rounded-xl border border-slate-300 px-3 text-sm" />
                <button type="submit" className="rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">Ответить</button>
              </form>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  Логотип
                  <input type="file" accept="image/*" onChange={(event) => void onUploadLogo(event.target.files)} className="mt-2 block w-full text-[11px]" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  Фото (до 10)
                  <input type="file" multiple accept="image/*" onChange={(event) => void onUploadPhotos(event.target.files)} className="mt-2 block w-full text-[11px]" />
                </label>
              </div>

              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Сайты-примеры (1-5)</p>
                <div className="mt-2 space-y-2">
                  {references.map((ref) => (
                    <div key={ref.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <input value={ref.url} onChange={(e) => setReferences((prev) => prev.map((item) => (item.id === ref.id ? { ...item, url: e.target.value } : item)))} placeholder="https://example.com" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => setReferences((prev) => prev.map((item) => (item.id === ref.id ? { ...item, likesStyle: !item.likesStyle } : item)))} className={`rounded-full border px-2 py-1 text-[11px] ${ref.likesStyle ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`}>Стиль</button>
                        <button onClick={() => setReferences((prev) => prev.map((item) => (item.id === ref.id ? { ...item, likesStructure: !item.likesStructure } : item)))} className={`rounded-full border px-2 py-1 text-[11px] ${ref.likesStructure ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`}>Структура</button>
                        <button onClick={() => setReferences((prev) => prev.map((item) => (item.id === ref.id ? { ...item, likesOffer: !item.likesOffer } : item)))} className={`rounded-full border px-2 py-1 text-[11px] ${ref.likesOffer ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`}>Оффер</button>
                        {references.length > 1 ? <button onClick={() => setReferences((prev) => prev.filter((item) => item.id !== ref.id))} className="rounded-full border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700">Удалить</button> : null}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setReferences((prev) => (prev.length >= 5 ? prev : [...prev, { id: uid(), url: "", likesStyle: true, likesStructure: false, likesOffer: false }]))} className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  Добавить пример
                </button>
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={buildBriefAndConcepts} disabled={!canGenerateConcepts || generationStatus === "loading"} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {generationStatus === "loading" ? "Собираем..." : "Собрать бриф и концепты"}
                </button>
                {!canGenerateConcepts ? <p className="text-xs font-semibold text-amber-700">Нужны обязательные ответы + минимум 1 референс.</p> : null}
              </div>
              {generationStatus === "loading" ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Generation Canvas</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-700">{generationStages[generationStageIndex]}</p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-slate-900 via-slate-700 to-cyan-600 transition-all"
                          style={{ width: `${((generationStageIndex + 1) / generationStages.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="h-3 w-20 animate-pulse rounded-full bg-slate-200" />
                      <div className="mt-2 h-3 w-36 animate-pulse rounded-full bg-slate-200" />
                      <div className="mt-4 h-20 animate-pulse rounded-lg bg-slate-200" />
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {phase === "concepts" ? (
            <>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {concepts.map((concept) => (
                  <button
                    key={concept.id}
                    onClick={() => selectConcept(concept.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selectedConceptId === concept.id
                        ? "border-slate-900 bg-slate-900 text-white shadow-[0_16px_45px_-30px_rgba(15,23,42,.9)]"
                        : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <p className="font-semibold">{concept.name}</p>
                    <p className={`mt-1 text-sm ${selectedConceptId === concept.id ? "text-slate-200" : "text-slate-600"}`}>{concept.description}</p>
                  </button>
                ))}
              </div>
              {structuredBrief ? (
                <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-cyan-700">Structured brief</p>
                  <p className="mt-1 text-xs text-slate-700">{structuredBrief.businessBrief}</p>
                  <p className="mt-1 text-xs text-slate-700">{structuredBrief.offerBrief}</p>
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button onClick={() => setPhase("editor")} disabled={!draft} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Открыть редактор</button>
                <button onClick={() => setPhase("interview")} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Назад к интервью</button>
              </div>
            </>
          ) : null}

          {phase === "editor" && draft ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => applyAiEdit("short")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Сделай короче</button>
                <button onClick={() => applyAiEdit("premium")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Сделай премиальнее</button>
                <button onClick={() => applyAiEdit("trust")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Добавь доверия</button>
                <button onClick={() => applyAiEdit("booking")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Сфокусируй на записи</button>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Секции (drag-and-drop)</p>
                <div className="mt-2 grid gap-2">
                  {sectionOrder.map((key) => (
                    <div
                      key={key}
                      draggable
                      onDragStart={() => setDragSection(key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragSection || dragSection === key) return;
                        const next = [...sectionOrder];
                        const from = next.findIndex((item) => item === dragSection);
                        const to = next.findIndex((item) => item === key);
                        if (from < 0 || to < 0) return;
                        const [moved] = next.splice(from, 1);
                        next.splice(to, 0, moved);
                        setSectionOrder(next);
                        setDragSection(null);
                      }}
                      onDragEnd={() => setDragSection(null)}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <span className="text-sm font-semibold text-slate-700">⋮⋮ {key === "about" ? "О компании" : key === "services" ? "Услуги" : "FAQ"}</span>
                      <button
                        onClick={() => setSectionsEnabled((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${sectionsEnabled[key] ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}
                      >
                        {sectionsEnabled[key] ? "Вкл" : "Выкл"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                <input value={draft.heroTitle} onChange={(e) => setDraft((prev) => (prev ? { ...prev, heroTitle: e.target.value } : prev))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <textarea value={draft.heroSubtitle} onChange={(e) => setDraft((prev) => (prev ? { ...prev, heroSubtitle: e.target.value } : prev))} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <textarea value={draft.about} onChange={(e) => setDraft((prev) => (prev ? { ...prev, about: e.target.value } : prev))} rows={3} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Услуги (сортировка)</p>
                <div className="mt-2 space-y-2">
                  {draft.products.map((product, index) => (
                    <div key={product.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                        <input value={product.title} onChange={(e) => setDraft((prev) => prev ? { ...prev, products: prev.products.map((item) => item.id === product.id ? { ...item, title: e.target.value } : item) } : prev)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                        <input value={product.price} onChange={(e) => setDraft((prev) => prev ? { ...prev, products: prev.products.map((item) => item.id === product.id ? { ...item, price: e.target.value } : item) } : prev)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                        <div className="flex gap-1">
                          <button onClick={() => moveService(index, -1)} className="rounded border border-slate-300 px-2 py-1 text-xs">↑</button>
                          <button onClick={() => moveService(index, 1)} className="rounded border border-slate-300 px-2 py-1 text-xs">↓</button>
                        </div>
                      </div>
                      <textarea value={product.description} onChange={(e) => setDraft((prev) => prev ? { ...prev, products: prev.products.map((item) => item.id === product.id ? { ...item, description: e.target.value } : item) } : prev)} rows={2} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={() => setPhase("publish")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">К оплате и публикации</button>
                <button onClick={() => setPhase("concepts")} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">К концептам</button>
              </div>
            </>
          ) : null}

          {phase === "publish" ? (
            <>
              <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-cyan-700">Оплата</p>
                <p className="mt-1 text-sm text-slate-700">Фиксированная стоимость: 3 500 ₽ за сайт.</p>
                <button onClick={handleMockPayment} disabled={paymentStatus === "loading" || paymentStatus === "success"} className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {paymentStatus === "loading" ? "Оплата..." : paymentStatus === "success" ? "Оплачено" : "Оплатить 3 500 ₽"}
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">Публикация</p>
                <p className="mt-1 text-sm text-slate-700">После публикации сайт откроется автоматически.</p>
                <button onClick={() => void handlePublish()} disabled={paymentStatus !== "success" || publishStatus === "loading"} className="mt-2 rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">
                  {publishStatus === "loading" ? "Публикуем..." : "Опубликовать"}
                </button>
                {publishPath ? <button onClick={() => onNavigate(publishPath)} className="ml-2 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700">Открыть сайт сейчас</button> : null}
              </div>
            </>
          ) : null}

          {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p> : null}
        </section>

        <aside className={`${sitesTokens.surface} bg-white/92`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Live Preview</p>
              <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{draft?.businessName || brief.business_name || "Ваш сайт"}</h3>
              <p className="mt-1 text-sm text-slate-600">Предпросмотр обновляется по мере настройки.</p>
            </div>
            <div className="space-y-1 text-right text-xs">
              <p className={`rounded-lg border px-2 py-1 ${statusChipClass(generationStatus)}`}>Генерация: {generationStatus}</p>
              <p className={`rounded-lg border px-2 py-1 ${statusChipClass(paymentStatus)}`}>Оплата: {paymentStatus}</p>
              <p className={`rounded-lg border px-2 py-1 ${statusChipClass(publishStatus)}`}>Публикация: {publishStatus}</p>
            </div>
          </div>

          {phase === "editor" && draft ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Свойства блока</p>
              {!selectedSection ? (
                <p className="mt-2 text-xs text-slate-600">Выберите блок в превью справа, чтобы быстро редактировать его.</p>
              ) : null}
              {selectedSection === "about" ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">О компании</p>
                  <textarea
                    value={draft.about}
                    onChange={(e) => setDraft((prev) => (prev ? { ...prev, about: e.target.value } : prev))}
                    rows={4}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                </div>
              ) : null}
              {selectedSection === "services" ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Услуги: {draft.products.length}</p>
                  <button
                    onClick={() =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              products: [
                                ...prev.products,
                                {
                                  id: uid(),
                                  title: "Новая услуга",
                                  price: "по запросу",
                                  description: "Описание новой услуги.",
                                  ctaText: prev.primaryCta,
                                  images: []
                                }
                              ]
                            }
                          : prev
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Добавить услугу
                  </button>
                </div>
              ) : null}
              {selectedSection === "faq" ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">FAQ: {draft.faq.length}</p>
                  <button
                    onClick={() =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              faq: [...prev.faq, { q: "Новый вопрос", a: "Новый ответ" }]
                            }
                          : prev
                      )
                    }
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Добавить вопрос
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <div className="relative h-[760px] overflow-y-auto" style={{ backgroundColor: draft?.palette.base || "#f8fafc" }}>
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      {draft?.logoUrl ? <img src={draft.logoUrl} alt="logo" className="h-full w-full object-contain" /> : <span className="text-[10px] font-bold text-slate-400">LOGO</span>}
                    </div>
                    <p className="text-sm font-bold text-slate-900">{draft?.businessName || "Название бизнеса"}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: "tg", label: "TG", href: toHref(draft?.socialLinks.telegram || "") },
                      { id: "wa", label: "WA", href: toHref(draft?.socialLinks.whatsapp || "") },
                      { id: "ig", label: "IG", href: toHref(draft?.socialLinks.instagram || "") }
                    ].map((item) =>
                      item.href ? (
                        <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-700">
                          {item.label}
                        </a>
                      ) : (
                        <span key={item.id} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-400">{item.label}</span>
                      )
                    )}
                  </div>
                </div>
              </div>

              <div className="px-4 py-6" style={{ backgroundColor: draft?.palette.hero || "#edf2ff" }}>
                <h4 className="text-3xl font-extrabold tracking-[-0.03em] text-slate-900">{draft?.heroTitle || "Здесь появится заголовок"}</h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">{draft?.heroSubtitle || "Пройдите интервью, чтобы получить точную структуру сайта."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: draft?.palette.accent || "#0f172a" }}>{draft?.primaryCta || "Оставить заявку"}</button>
                  <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">{draft?.secondaryCta || "Подробнее"}</button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Ответ</p>
                    <p className="text-sm font-bold text-slate-900">&lt; 2 мин</p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Конверсия</p>
                    <p className="text-sm font-bold text-slate-900">+28%</p>
                  </div>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Записи/мес</p>
                    <p className="text-sm font-bold text-slate-900">200+</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4">
                {sectionOrder.map((section, index) => {
                  if (!sectionsEnabled[section]) return null;
                  return (
                    <div
                      key={section}
                      onClick={() => setSelectedSection(section)}
                      className={`rounded-xl border bg-white p-3 transition ${
                        selectedSection === section ? "border-cyan-300 shadow-[0_0_0_2px_rgba(34,211,238,.18)]" : "border-slate-200"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
                          {section === "about" ? "О компании" : section === "services" ? "Услуги" : "FAQ"}
                        </p>
                        <div className="flex gap-1">
                          <button onClick={() => moveSection(section, -1)} className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600">↑</button>
                          <button onClick={() => moveSection(section, 1)} className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600">↓</button>
                          <button onClick={() => duplicateSection(section)} className="rounded border border-cyan-200 px-1.5 py-0.5 text-[10px] text-cyan-700">дубль</button>
                          <button onClick={() => setSectionsEnabled((prev) => ({ ...prev, [section]: false }))} className="rounded border border-rose-200 px-1.5 py-0.5 text-[10px] text-rose-700">скрыть</button>
                        </div>
                      </div>

                      {section === "about" ? <p className="text-sm text-slate-700">{draft?.about || "Описание появится после генерации."}</p> : null}

                      {section === "services" ? (
                        <div className="space-y-2">
                          {(draft?.products || []).map((product) => (
                            <div key={product.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-900">{product.title}</p>
                                <p className="text-xs font-bold" style={{ color: draft?.palette.accent || "#0f172a" }}>{product.price}</p>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600">{product.description}</p>
                            </div>
                          ))}
                          {!draft?.products?.length ? <p className="text-xs text-slate-500">После генерации здесь появится список услуг.</p> : null}
                        </div>
                      ) : null}

                      {section === "faq"
                        ? (draft?.faq || []).slice(0, 6).map((item, faqIndex) => (
                            <div key={item.q} className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <div
                                draggable
                                onDragStart={() => setDragFaqIndex(faqIndex)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (dragFaqIndex === null || dragFaqIndex === faqIndex) return;
                                  setDraft((prev) => {
                                    if (!prev) return prev;
                                    const nextFaq = [...prev.faq];
                                    const [movedFaq] = nextFaq.splice(dragFaqIndex, 1);
                                    nextFaq.splice(faqIndex, 0, movedFaq);
                                    return { ...prev, faq: nextFaq };
                                  });
                                  setDragFaqIndex(null);
                                }}
                                onDragEnd={() => setDragFaqIndex(null)}
                                className="cursor-move"
                              >
                                <p className="text-xs font-semibold text-slate-900">⋮⋮ {item.q}</p>
                                <p className="mt-1 text-[11px] text-slate-700">{item.a}</p>
                              </div>
                            </div>
                          ))
                        : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {publishingOverlay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-500 border-t-cyan-300" />
            <p className="mt-4 text-sm font-semibold text-white">{overlayMessage}</p>
            <p className="mt-2 text-xs text-slate-300">Подготавливаем ссылку для вашего сайта.</p>
          </div>
        </div>
      ) : null}
    </SitesPageShell>
  );
}
