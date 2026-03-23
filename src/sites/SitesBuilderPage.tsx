import { ChangeEvent, useEffect, useMemo, useReducer, useState } from "react";
import { generateConcepts } from "./concepts";
import { buildInterviewQuestions, buildStructuredBrief } from "./interview";
import { loadSitesBuilderState, saveSitesBuilderState, sitesBuilderReducer } from "./state";
import { AsyncStatus, SitesStep } from "./types";

type SitesBuilderPageProps = {
  onNavigate: (path: string) => void;
};

type EditorSectionKey = "about" | "services" | "process" | "testimonials" | "faq" | "cabinet" | "gallery" | "contacts";
type EditorPreviewTab = "home" | "services" | "reviews" | "cabinet";
type EditorService = { id: string; title: string; price: string; description: string; image?: string };
type EditorTestimonial = { id: string; author: string; role: string; text: string };
type EditorFaq = { id: string; q: string; a: string };
type EditorDraft = {
  conceptId: string;
  palette: { accent: string; base: string; hero: string };
  hero: { title: string; subtitle: string; primaryCta: string; secondaryCta: string; stats: Array<{ label: string; value: string }> };
  about: string;
  processSteps: string[];
  services: EditorService[];
  testimonials: EditorTestimonial[];
  faq: EditorFaq[];
  cabinet: { title: string; text: string; cta: string };
  contactLine: string;
  links: { telegram: string; whatsapp: string; instagram: string };
  sectionOrder: EditorSectionKey[];
  sectionsEnabled: Record<EditorSectionKey, boolean>;
};

const editorSections: Array<{ key: EditorSectionKey; label: string }> = [
  { key: "about", label: "О компании" },
  { key: "services", label: "Услуги" },
  { key: "process", label: "Как это работает" },
  { key: "testimonials", label: "Отзывы" },
  { key: "faq", label: "FAQ" },
  { key: "cabinet", label: "Личный кабинет" },
  { key: "gallery", label: "Галерея" },
  { key: "contacts", label: "Контакты" }
];

function toHref(raw: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  if (/^(https?:\/\/|tg:\/\/|mailto:|tel:)/i.test(value)) return value;
  if (value.startsWith("@")) return `https://t.me/${value.slice(1)}`;
  return `https://${value}`;
}

const LOCAL_PUBLISHED_SITE_PREFIX = "clientsflow_local_published_site:";
const PUBLISH_REDIRECT_DELAY_MS = 1200;

const stepOrder: SitesStep[] = ["intro", "brief", "concepts", "editor", "publish"];

const stepTitle: Record<SitesStep, string> = {
  intro: "Старт",
  brief: "AI-бриф",
  concepts: "Концепты",
  editor: "Редактор",
  publish: "Публикация"
};

function statusClass(status: AsyncStatus): string {
  if (status === "loading") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "error") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function statusLabel(status: AsyncStatus): string {
  if (status === "loading") return "в процессе";
  if (status === "success") return "успешно";
  if (status === "error") return "ошибка";
  return "ожидание";
}

function sectionCardClass() {
  return "rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)] sm:p-6";
}

function sectionTitleClass() {
  return "text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl";
}

export default function SitesBuilderPage({ onNavigate }: SitesBuilderPageProps) {
  const [state, dispatch] = useReducer(sitesBuilderReducer, undefined, loadSitesBuilderState);
  const [previewTab, setPreviewTab] = useState<"home" | "services" | "reviews" | "cabinet">("home");
  const [editorPreviewTab, setEditorPreviewTab] = useState<EditorPreviewTab>("home");
  const [editorDraft, setEditorDraft] = useState<EditorDraft | null>(null);
  const [dragServiceId, setDragServiceId] = useState<string | null>(null);
  const [dragSectionId, setDragSectionId] = useState<EditorSectionKey | null>(null);
  const [aiCommand, setAiCommand] = useState("");
  const [publishOverlayMessage, setPublishOverlayMessage] = useState("Публикуем сайт...");
  const interviewQuestions = useMemo(
    () => buildInterviewQuestions(state.interviewAnswers.niche || state.brief.niche),
    [state.interviewAnswers.niche, state.brief.niche]
  );
  const answeredRequired = useMemo(
    () => interviewQuestions.filter((q) => q.required).every((q) => (state.interviewAnswers[q.id] || "").trim().length > 0),
    [interviewQuestions, state.interviewAnswers]
  );
  const answeredCount = useMemo(
    () => interviewQuestions.filter((q) => (state.interviewAnswers[q.id] || "").trim().length > 0).length,
    [interviewQuestions, state.interviewAnswers]
  );
  const currentQuestion = interviewQuestions[Math.min(state.currentQuestionIndex, Math.max(interviewQuestions.length - 1, 0))];

  useEffect(() => {
    saveSitesBuilderState(state);
  }, [state]);

  const selectedConcept = useMemo(
    () => state.concepts.find((item) => item.id === state.selectedConceptId) ?? null,
    [state.concepts, state.selectedConceptId]
  );
  const publishRequirements = useMemo(
    () => [
      { key: "logo", ok: Boolean(state.logos[0]), text: "Логотип загружен" },
      { key: "concept", ok: Boolean(state.selectedConceptId), text: "Концепт выбран" },
      { key: "payment", ok: state.paymentStatus === "success", text: "Оплата подтверждена" }
    ],
    [state.logos, state.selectedConceptId, state.paymentStatus]
  );
  const canPublishNow = publishRequirements.every((item) => item.ok) && state.publishStatus !== "loading";

  useEffect(() => {
    if (!selectedConcept) return;
    setEditorDraft((prev) => {
      if (prev && prev.conceptId === selectedConcept.id) return prev;
      return {
        conceptId: selectedConcept.id,
        palette: selectedConcept.palette,
        hero: selectedConcept.hero,
        about: state.structuredBrief?.businessBrief || `${state.brief.businessName || "Бизнес"} — ${state.brief.niche || "сервис"}.`,
        processSteps: ["Оставляете заявку", "Уточняем задачу", "Подтверждаем запись"],
        services: selectedConcept.services.map((service, index) => ({
          ...service,
          image: state.photos[index] || state.photos[0] || ""
        })),
        testimonials: selectedConcept.testimonials,
        faq: selectedConcept.faq,
        cabinet: selectedConcept.cabinet,
        contactLine: `${state.brief.businessName || "Бизнес"}, ${state.brief.city || "город"}`,
        links: {
          telegram: state.brief.telegramLink || "",
          whatsapp: state.brief.whatsappLink || "",
          instagram: state.brief.instagramLink || ""
        },
        sectionOrder: editorSections.map((s) => s.key),
        sectionsEnabled: {
          about: true,
          services: true,
          process: true,
          testimonials: true,
          faq: true,
          cabinet: true,
          gallery: state.photos.length > 0,
          contacts: true
        }
      };
    });
  }, [selectedConcept, state.structuredBrief?.businessBrief, state.brief.businessName, state.brief.city, state.brief.niche, state.brief.telegramLink, state.brief.whatsappLink, state.brief.instagramLink, state.photos]);

  const handleMockGenerate = () => {
    if (!answeredRequired || !state.logos[0]) {
      dispatch({ type: "concepts_error", error: "Заполните обязательные вопросы и загрузите логотип." });
      dispatch({ type: "set_step", step: "brief" });
      return;
    }
    dispatch({ type: "concepts_loading" });
    window.setTimeout(() => {
      const concepts = generateConcepts({
        businessName: state.interviewAnswers.business_name || state.brief.businessName,
        city: state.interviewAnswers.city || state.brief.city,
        niche: state.interviewAnswers.niche || state.brief.niche,
        goal: state.interviewAnswers.goal || state.brief.goal,
        tone: state.interviewAnswers.tone || state.brief.tone,
        offer: state.interviewAnswers.main_offer || "ключевая услуга"
      });
      dispatch({ type: "concepts_success", concepts });
      dispatch({ type: "set_step", step: "concepts" });
    }, 1000);
  };

  const handleBuildStructuredBrief = () => {
    if (!currentQuestion) return;
    dispatch({ type: "structured_brief_loading" });
    window.setTimeout(() => {
      try {
        const niche = state.interviewAnswers.niche || state.brief.niche;
        const payload = buildStructuredBrief({
          niche,
          answers: state.interviewAnswers,
          referencesCount: state.references.filter((item) => item.url.trim()).length,
          logoLoaded: Boolean(state.logos[0]),
          photosCount: state.photos.length
        });
        dispatch({ type: "set_structured_brief", payload });
        dispatch({ type: "set_brief", field: "businessName", value: state.interviewAnswers.business_name || state.brief.businessName });
        dispatch({ type: "set_brief", field: "niche", value: niche });
        dispatch({ type: "set_brief", field: "city", value: state.interviewAnswers.city || state.brief.city });
        dispatch({ type: "set_brief", field: "goal", value: state.interviewAnswers.goal || state.brief.goal });
        dispatch({ type: "set_brief", field: "tone", value: state.interviewAnswers.tone || state.brief.tone });
        dispatch({ type: "set_brief", field: "telegramLink", value: state.interviewAnswers.telegram_link || state.brief.telegramLink });
        dispatch({ type: "set_brief", field: "instagramLink", value: state.interviewAnswers.instagram_link || state.brief.instagramLink });
        dispatch({ type: "set_brief", field: "whatsappLink", value: state.interviewAnswers.whatsapp_link || state.brief.whatsappLink });
      } catch (error: any) {
        dispatch({ type: "structured_brief_error", error: error?.message || "Не удалось собрать structured brief" });
      }
    }, 700);
  };

  const handleMockPayment = () => {
    dispatch({ type: "payment_loading" });
    window.setTimeout(() => {
      dispatch({ type: "payment_success" });
      dispatch({ type: "set_step", step: "publish" });
    }, 900);
  };

  const buildPublishPayload = () => ({
    businessName: state.brief.businessName || "CFlow Site",
    city: state.brief.city || "",
    logoUrl: state.logos[0] || "",
    accentColor: editorDraft?.palette.accent || selectedConcept?.palette.accent || state.brief.primaryColor || "#0f172a",
    baseColor: editorDraft?.palette.base || selectedConcept?.palette.base || "#f8fafc",
    heroTitle: editorDraft?.hero.title || selectedConcept?.hero.title || `${state.brief.businessName || "Ваш бизнес"} — сайт, который ведёт к заявке`,
    heroSubtitle:
      editorDraft?.hero.subtitle ||
      selectedConcept?.hero.subtitle ||
      `Ниша: ${state.brief.niche || "сервисный бизнес"}. Цель: ${state.brief.goal || "рост входящих заявок"}.`,
    about: editorDraft?.about || state.structuredBrief?.businessBrief || `Сайт собран в модуле CFlow Sites. Тон: ${state.brief.tone || "премиально и спокойно"}.`,
    primaryCta: editorDraft?.hero.primaryCta || selectedConcept?.hero.primaryCta || "Оставить заявку",
    secondaryCta: editorDraft?.hero.secondaryCta || selectedConcept?.hero.secondaryCta || "Смотреть услуги",
    trustStats: editorDraft?.hero.stats || selectedConcept?.hero.stats || [
      { label: "Скорость ответа", value: "< 2 мин" },
      { label: "Конверсия в запись", value: "+27%" },
      { label: "Обработано заявок", value: "500+" }
    ],
    valueProps: [],
    processSteps: editorDraft?.processSteps || ["Заявка", "Уточнение", "Запись"],
    testimonials:
      editorDraft?.testimonials.map((item) => ({ name: item.author, role: item.role, text: item.text })) ||
      selectedConcept?.testimonials.map((item) => ({ name: item.author, role: item.role, text: item.text })) ||
      [],
    faq: editorDraft?.faq.map((item) => ({ q: item.q, a: item.a })) || selectedConcept?.faq.map((item) => ({ q: item.q, a: item.a })) || [],
    contactLine: editorDraft?.contactLine || `${state.brief.businessName || "Бизнес"}, ${state.brief.city || "город"}`,
    products:
      (editorDraft?.services || selectedConcept?.services || []).map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        description: item.description,
        ctaText: "Связаться с менеджером",
        images: "image" in item && item.image ? [item.image] : state.photos.slice(0, 1)
      })) || [],
    sections: {
      about: editorDraft?.sectionsEnabled.about ?? true,
      valueProps: false,
      services: editorDraft?.sectionsEnabled.services ?? true,
      process: editorDraft?.sectionsEnabled.process ?? true,
      gallery: editorDraft?.sectionsEnabled.gallery ?? state.photos.length > 0,
      testimonials: editorDraft?.sectionsEnabled.testimonials ?? true,
      faq: editorDraft?.sectionsEnabled.faq ?? true,
      cabinet: editorDraft?.sectionsEnabled.cabinet ?? true,
      contacts: editorDraft?.sectionsEnabled.contacts ?? true,
      map: false
    },
    sectionOrder: editorDraft?.sectionOrder || ["about", "services", "process", "gallery", "testimonials", "faq", "cabinet", "contacts"],
    galleryUrls: state.photos,
    cabinetEnabled: true,
    telegramBot: "@clientsflow_support_bot",
    socialLinks: {
      telegram: editorDraft?.links.telegram || state.brief.telegramLink,
      whatsapp: editorDraft?.links.whatsapp || state.brief.whatsappLink,
      instagram: editorDraft?.links.instagram || state.brief.instagramLink
    }
  });

  const handlePublish = async () => {
    if (state.paymentStatus !== "success") {
      dispatch({ type: "publish_error", error: "Сначала оплатите 3 500 ₽ на этой странице, затем публикуйте." });
      dispatch({ type: "set_step", step: "publish" });
      return;
    }
    if (!state.logos[0]) {
      dispatch({ type: "publish_error", error: "Добавьте логотип в брифе — это обязательное поле для публикации." });
      dispatch({ type: "set_step", step: "brief" });
      return;
    }
    const payload = buildPublishPayload();
    dispatch({ type: "publish_loading" });
    setPublishOverlayMessage("Публикуем сайт в облаке...");
    try {
      const response = await fetch("/api/sites/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as { path?: string; slug?: string; error?: string };
      const path = body.path || (body.slug ? `/s/${body.slug}` : "");
      if (!response.ok || !path) throw new Error(body.error || "Не удалось опубликовать");
      dispatch({ type: "publish_success", path });
      setPublishOverlayMessage("Сайт опубликован. Открываем...");
      window.setTimeout(() => onNavigate(path), PUBLISH_REDIRECT_DELAY_MS);
    } catch (error: any) {
      try {
        setPublishOverlayMessage("Облако недоступно. Запускаем локальную публикацию...");
        const localSlug = `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        localStorage.setItem(
          `${LOCAL_PUBLISHED_SITE_PREFIX}${localSlug}`,
          JSON.stringify({
            slug: localSlug,
            payload
          })
        );
        const localPath = `/s/${localSlug}`;
        dispatch({ type: "publish_success", path: localPath });
        setPublishOverlayMessage("Локальная публикация готова. Открываем...");
        window.setTimeout(() => onNavigate(localPath), PUBLISH_REDIRECT_DELAY_MS);
      } catch (fallbackError: any) {
        dispatch({
          type: "publish_error",
          error: `Не удалось опубликовать сайт. Облако: ${error?.message || "недоступно"}. Локальный fallback: ${
            fallbackError?.message || "не сработал"
          }. Проверьте свободное место в браузере и попробуйте снова.`
        });
      }
    }
  };

  const handleFileList = async (event: ChangeEvent<HTMLInputElement>, mode: "logo" | "photos" | "reference", referenceId?: string) => {
    const files = event.target.files;
    if (!files) return;
    const asDataUrl = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("File read error")));
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsDataURL(file);
      });
    const urls = await Promise.all(Array.from(files).map((file) => asDataUrl(file)));
    if (mode === "logo") dispatch({ type: "set_logos", logos: urls.slice(0, 1) });
    else if (mode === "photos") dispatch({ type: "set_photos", photos: urls.slice(0, 5) });
    else if (referenceId && urls[0]) dispatch({ type: "update_reference_screenshot", id: referenceId, screenshotUrl: urls[0] });
    event.target.value = "";
  };

  const updateDraft = (updater: (prev: EditorDraft) => EditorDraft) => {
    setEditorDraft((prev) => (prev ? updater(prev) : prev));
  };

  const reorderArray = <T,>(arr: T[], fromId: (item: T) => string, sourceId: string, targetId: string): T[] => {
    const sourceIndex = arr.findIndex((item) => fromId(item) === sourceId);
    const targetIndex = arr.findIndex((item) => fromId(item) === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return arr;
    const next = [...arr];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  };

  const applyAiEdit = (mode: "short" | "premium" | "trust" | "booking" | "command", commandText?: string) => {
    if (!editorDraft) return;
    const cmd = (commandText || aiCommand || "").toLowerCase();
    updateDraft((prev) => {
      const next = { ...prev };
      if (mode === "short" || cmd.includes("короче")) {
        next.hero.subtitle = next.hero.subtitle.split(".")[0] + ".";
        next.about = next.about.split(".").slice(0, 2).join(".").trim() + ".";
      }
      if (mode === "premium" || cmd.includes("преми")) {
        next.hero.title = next.hero.title.replace("сайт", "премиальный сайт");
        next.hero.primaryCta = "Записаться на консультацию";
        next.about = `${next.about} Акцент на аккуратный сервис и высокий стандарт коммуникации.`;
      }
      if (mode === "trust" || cmd.includes("довер")) {
        next.testimonials = next.testimonials.map((item) => ({
          ...item,
          text: `${item.text} Подтверждаем результат прозрачным процессом и понятными этапами.`
        }));
        next.faq = next.faq.map((item) => (item.q.toLowerCase().includes("стоимость") ? item : item));
      }
      if (mode === "booking" || cmd.includes("запис")) {
        next.hero.primaryCta = "Записаться сейчас";
        next.hero.secondaryCta = "Выбрать время";
        next.processSteps = ["Оставляете контакт", "Получаете слот", "Подтверждаете запись"];
      }
      return next;
    });
  };

  const handleServiceImageUpload = async (event: ChangeEvent<HTMLInputElement>, serviceId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const asDataUrl = () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("File read error")));
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsDataURL(file);
      });
    const image = await asDataUrl();
    updateDraft((prev) => ({
      ...prev,
      services: prev.services.map((service) => (service.id === serviceId ? { ...service, image } : service))
    }));
    event.target.value = "";
  };

  const previewTabs: Array<{ id: "home" | "services" | "reviews" | "cabinet"; label: string }> = [
    { id: "home", label: "Дом" },
    { id: "services", label: "Услуги" },
    { id: "reviews", label: "Отзывы" },
    { id: "cabinet", label: "Личный кабинет" }
  ];

  const selectedConceptPalette = selectedConcept?.palette ?? { accent: "#0f172a", base: "#f8fafc", hero: "#e6f4ff" };
  const social = [
    { id: "tg", label: "TG", href: state.brief.telegramLink },
    { id: "wa", label: "WA", href: state.brief.whatsappLink },
    { id: "ig", label: "IG", href: state.brief.instagramLink }
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">CFlow Sites</p>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Новый модуль конструктора</h1>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button onClick={() => onNavigate("/")} className="flex-1 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 sm:flex-none">Главная</button>
            <button onClick={() => onNavigate("/dashboard")} className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:flex-none">Личный кабинет</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8">
        <div className={sectionCardClass()}>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Шаги</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {stepOrder.map((step, index) => (
              <button
                key={step}
                onClick={() => dispatch({ type: "set_step", step })}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${
                  state.step === step ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${state.step === step ? "bg-white/20" : "bg-white border border-slate-200 text-slate-500"}`}>{index + 1}</span>
                {stepTitle[step]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className={sectionCardClass()}>
            {state.step === "intro" ? (
              <div className="space-y-4">
                <h2 className={sectionTitleClass()}>CFlow Sites: production-ready конструктор</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Дальше: интервью, генерация 4 концептов, ручная редактура, оплата и публикация на `/s/slug` с cloud/local fallback.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Реалистичный UX</p>
                    <p className="mt-2 text-sm text-slate-700">Явные статусы, проверка обязательных полей, полноэкранная публикация и ручной fallback.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-cyan-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-cyan-700">Связка с CFlow</p>
                    <p className="mt-2 text-sm text-slate-700">После публикации можно сразу перейти в кабинет, AI Inbox и сценарии Telegram-коммуникации.</p>
                  </div>
                </div>
                <button onClick={() => dispatch({ type: "set_step", step: "brief" })} className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
                  Начать с брифа
                </button>
              </div>
            ) : null}

            {state.step === "brief" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className={sectionTitleClass()}>AI-интервью для сайта</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Динамический бриф: {interviewQuestions.length} вопросов, ветвление по нише, итог — structured brief.
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                    Заполнено: {answeredCount}/{interviewQuestions.length}
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Вопрос {Math.min(state.currentQuestionIndex + 1, interviewQuestions.length)} из {interviewQuestions.length}
                    </p>
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-2 rounded-full bg-slate-900 transition-all"
                        style={{ width: `${Math.max(8, Math.round(((state.currentQuestionIndex + 1) / interviewQuestions.length) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {currentQuestion ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-sm font-semibold text-slate-900">{currentQuestion.label}</p>
                      {currentQuestion.helper ? <p className="mt-1 text-xs text-slate-500">{currentQuestion.helper}</p> : null}
                      <textarea
                        value={state.interviewAnswers[currentQuestion.id] || ""}
                        onChange={(e) => {
                          dispatch({ type: "set_interview_answer", id: currentQuestion.id, value: e.target.value });
                          if (currentQuestion.id === "niche") dispatch({ type: "set_brief", field: "niche", value: e.target.value });
                        }}
                        placeholder={currentQuestion.placeholder}
                        rows={3}
                        className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => dispatch({ type: "set_current_question", index: Math.max(0, state.currentQuestionIndex - 1) })}
                          disabled={state.currentQuestionIndex === 0}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        >
                          Назад
                        </button>
                        <button
                          onClick={() =>
                            dispatch({
                              type: "set_current_question",
                              index: Math.min(interviewQuestions.length - 1, state.currentQuestionIndex + 1)
                            })
                          }
                          disabled={state.currentQuestionIndex >= interviewQuestions.length - 1}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Дальше
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <span className="font-semibold text-slate-700">Логотип (обязательно)</span>
                    <input type="file" accept="image/*" onChange={(e) => void handleFileList(e, "logo")} className="mt-2 block w-full text-xs" />
                    <p className={`mt-2 text-xs font-semibold ${state.logos[0] ? "text-emerald-700" : "text-amber-700"}`}>
                      {state.logos[0] ? "Логотип загружен" : "Без логотипа нельзя перейти к публикации"}
                    </p>
                  </label>
                  <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <span className="font-semibold text-slate-700">Фото (до 5, опционально)</span>
                    <input type="file" multiple accept="image/*" onChange={(e) => void handleFileList(e, "photos")} className="mt-2 block w-full text-xs" />
                    <p className="mt-2 text-xs text-slate-500">Добавлено: {state.photos.length}/5</p>
                  </label>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">Сайты-примеры и скриншоты</p>
                    <span className="text-xs text-slate-500">{state.references.length}/5</span>
                  </div>
                  {state.references.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <input
                        value={item.url}
                        onChange={(e) => dispatch({ type: "update_reference_url", id: item.id, url: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => dispatch({ type: "toggle_reference_flag", id: item.id, flag: "likesStyle" })} className={`rounded-full border px-2 py-1 text-[11px] ${item.likesStyle ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`}>Нравится стиль</button>
                        <button onClick={() => dispatch({ type: "toggle_reference_flag", id: item.id, flag: "likesStructure" })} className={`rounded-full border px-2 py-1 text-[11px] ${item.likesStructure ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`}>Нравится структура</button>
                        <button onClick={() => dispatch({ type: "toggle_reference_flag", id: item.id, flag: "likesOffer" })} className={`rounded-full border px-2 py-1 text-[11px] ${item.likesOffer ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`}>Нравится оффер</button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                          Загрузить скрин
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => void handleFileList(e, "reference", item.id)}
                            className="hidden"
                          />
                        </label>
                        {item.screenshotUrl ? <span className="text-[11px] text-emerald-700">Скриншот добавлен</span> : <span className="text-[11px] text-slate-500">Скриншот не добавлен</span>}
                        {state.references.length > 1 ? (
                          <button onClick={() => dispatch({ type: "remove_reference", id: item.id })} className="rounded-lg border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700">Удалить</button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => dispatch({ type: "add_reference" })}
                    disabled={state.references.length >= 5}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Добавить пример
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleBuildStructuredBrief}
                      disabled={!answeredRequired}
                      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Собрать structured brief
                    </button>
                    <button onClick={handleMockGenerate} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">
                      Сгенерировать концепты
                    </button>
                  </div>
                  {!answeredRequired ? <p className="mt-2 text-xs font-semibold text-amber-700">Заполните обязательные ответы, чтобы собрать brief.</p> : null}
                  {state.structuredBriefStatus === "loading" ? <p className="mt-2 text-xs text-slate-500">Собираем AI-выжимку...</p> : null}
                  {state.structuredBriefError ? <p className="mt-2 text-xs text-rose-600">{state.structuredBriefError}</p> : null}
                </div>

                {state.structuredBrief ? (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-700">Structured brief</p>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl border border-cyan-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">businessBrief</p>
                        <p className="mt-1 text-sm text-slate-700">{state.structuredBrief.businessBrief}</p>
                      </div>
                      <div className="rounded-xl border border-cyan-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">styleBrief</p>
                        <p className="mt-1 text-sm text-slate-700">{state.structuredBrief.styleBrief}</p>
                      </div>
                      <div className="rounded-xl border border-cyan-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">contentBrief</p>
                        <p className="mt-1 text-sm text-slate-700">{state.structuredBrief.contentBrief}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {state.step === "concepts" ? (
              <div>
                <h2 className={sectionTitleClass()}>Концепты сайта</h2>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {state.concepts.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => dispatch({ type: "select_concept", id: item.id })}
                      className={`rounded-xl border p-3 text-left ${
                        state.selectedConceptId === item.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <p className="font-semibold">{item.name}</p>
                      <p className="mt-1 text-sm">{item.description}</p>
                    </button>
                  ))}
                </div>
                {selectedConcept ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="relative h-[680px] overflow-y-auto pb-24" style={{ backgroundColor: selectedConceptPalette.base }}>
                      <div className="border-b border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-500">{selectedConcept.name}</p>
                            <p className="text-sm font-bold text-slate-900">{state.brief.businessName || "Название бизнеса"}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {(social || []).map((item) =>
                              item.href ? (
                                <a key={item.id} href={item.href} target="_blank" rel="noreferrer" className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-bold text-slate-700">
                                  {item.label}
                                </a>
                              ) : (
                                <span key={item.id} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-400">
                                  {item.label}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      {previewTab === "home" ? (
                        <div className="px-4 py-5" style={{ backgroundColor: selectedConceptPalette.hero }}>
                          <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">{selectedConcept.hero.title}</h3>
                          <p className="mt-2 text-sm text-slate-700">{selectedConcept.hero.subtitle}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button className="rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: selectedConceptPalette.accent }}>
                              {selectedConcept.hero.primaryCta}
                            </button>
                            <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                              {selectedConcept.hero.secondaryCta}
                            </button>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            {selectedConcept.hero.stats.map((item) => (
                              <div key={item.label} className="rounded-xl border border-white/70 bg-white/90 p-2.5">
                                <p className="text-[11px] text-slate-500">{item.label}</p>
                                <p className="text-sm font-bold text-slate-900">{item.value}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">О компании</p>
                            <p className="mt-1 text-sm text-slate-700">{state.structuredBrief?.businessBrief || "Краткое описание бизнеса появится после интервью."}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="border-b border-slate-200 bg-white px-4 py-4">
                          <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
                            {previewTab === "services" && "Услуги и цены"}
                            {previewTab === "reviews" && "Отзывы и FAQ"}
                            {previewTab === "cabinet" && "Личный кабинет"}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {previewTab === "services" && "Каталог услуг с ценами и кратким описанием."}
                            {previewTab === "reviews" && "Блок доверия и ответы на частые вопросы."}
                            {previewTab === "cabinet" && "Отдельный раздел для входа и статусов клиента."}
                          </p>
                        </div>
                      )}

                      <div className="space-y-3 p-4">
                        {(previewTab === "home" || previewTab === "services") ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Услуги</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                              {selectedConcept.services.map((srv) => (
                                <div key={srv.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                                  <p className="text-xs font-semibold text-slate-900">{srv.title}</p>
                                  <p className="mt-0.5 text-[11px] text-slate-600">{srv.price}</p>
                                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{srv.description}</p>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">45–60 мин</span>
                                    <span className="text-[10px] font-semibold text-cyan-700">Заказать</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {previewTab === "home" ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Как это работает</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                              {["Оставляете заявку", "Уточняем задачу", "Фиксируем запись"].map((step) => (
                                <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{step}</div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {(previewTab === "reviews") ? (
                          <>
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Отзывы</p>
                              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                {selectedConcept.testimonials.map((item) => (
                                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                    <p className="text-xs font-semibold text-slate-900">{item.author}</p>
                                    <p className="text-[11px] text-slate-500">{item.role}</p>
                                    <p className="mt-1 text-xs text-slate-700">{item.text}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">FAQ</p>
                              <div className="mt-2 space-y-2">
                                {selectedConcept.faq.map((item) => (
                                  <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                    <p className="text-xs font-semibold text-slate-900">{item.q}</p>
                                    <p className="mt-1 text-xs text-slate-700">{item.a}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : null}

                        {previewTab === "cabinet" ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-sm font-semibold text-slate-900">{selectedConcept.cabinet.title}</p>
                            <p className="mt-1 text-xs text-slate-700">{selectedConcept.cabinet.text}</p>
                            <button className="mt-3 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: selectedConceptPalette.accent }}>
                              {selectedConcept.cabinet.cta}
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="sticky bottom-3 z-20 flex justify-center px-4">
                        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
                          {previewTabs.map((tab) => (
                            <button
                              key={tab.id}
                              onClick={() => setPreviewTab(tab.id)}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                previewTab === tab.id ? "text-white" : "text-slate-700"
                              }`}
                              style={previewTab === tab.id ? { backgroundColor: selectedConceptPalette.accent } : undefined}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => dispatch({ type: "set_step", step: "editor" })}
                    disabled={!selectedConcept}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Открыть редактор
                  </button>
                  <button onClick={() => dispatch({ type: "set_step", step: "brief" })} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">К брифу</button>
                </div>
              </div>
            ) : null}

            {state.step === "editor" ? (
              <div className="space-y-4">
                <div>
                  <h2 className={sectionTitleClass()}>Пост-редактор сайта</h2>
                  <p className="mt-1 text-sm text-slate-600">Редактируйте тексты, стиль и структуру. AI-правки применяются в 1 клик.</p>
                </div>

                {editorDraft ? (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">AI-правки</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => applyAiEdit("short")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Сделай короче</button>
                        <button onClick={() => applyAiEdit("premium")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Сделай премиальнее</button>
                        <button onClick={() => applyAiEdit("trust")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Добавь больше доверия</button>
                        <button onClick={() => applyAiEdit("booking")} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Сфокусируй на записи</button>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={aiCommand}
                          onChange={(e) => setAiCommand(e.target.value)}
                          placeholder="AI-команда: например, сделай заголовок спокойнее"
                          className="h-10 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                        />
                        <button onClick={() => applyAiEdit("command", aiCommand)} className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white">Применить</button>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Hero</p>
                        <div className="mt-2 grid gap-2">
                          <input value={editorDraft.hero.title} onChange={(e) => updateDraft((prev) => ({ ...prev, hero: { ...prev.hero, title: e.target.value } }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                          <textarea value={editorDraft.hero.subtitle} onChange={(e) => updateDraft((prev) => ({ ...prev, hero: { ...prev.hero, subtitle: e.target.value } }))} rows={2} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input value={editorDraft.hero.primaryCta} onChange={(e) => updateDraft((prev) => ({ ...prev, hero: { ...prev.hero, primaryCta: e.target.value } }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            <input value={editorDraft.hero.secondaryCta} onChange={(e) => updateDraft((prev) => ({ ...prev, hero: { ...prev.hero, secondaryCta: e.target.value } }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">О компании и процесс</p>
                        <textarea
                          value={editorDraft.about}
                          onChange={(e) => updateDraft((prev) => ({ ...prev, about: e.target.value }))}
                          rows={3}
                          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {editorDraft.processSteps.map((step, idx) => (
                            <input
                              key={`${idx}-${step}`}
                              value={step}
                              onChange={(e) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  processSteps: prev.processSteps.map((item, i) => (i === idx ? e.target.value : item))
                                }))
                              }
                              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Отзывы</p>
                        <div className="mt-2 space-y-2">
                          {editorDraft.testimonials.map((item) => (
                            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <div className="grid gap-2 sm:grid-cols-2">
                                <input
                                  value={item.author}
                                  onChange={(e) =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      testimonials: prev.testimonials.map((x) => (x.id === item.id ? { ...x, author: e.target.value } : x))
                                    }))
                                  }
                                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                                />
                                <input
                                  value={item.role}
                                  onChange={(e) =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      testimonials: prev.testimonials.map((x) => (x.id === item.id ? { ...x, role: e.target.value } : x))
                                    }))
                                  }
                                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                                />
                              </div>
                              <textarea
                                value={item.text}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    testimonials: prev.testimonials.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x))
                                  }))
                                }
                                rows={2}
                                className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">FAQ</p>
                        <div className="mt-2 space-y-2">
                          {editorDraft.faq.map((item) => (
                            <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                              <input
                                value={item.q}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    faq: prev.faq.map((x) => (x.id === item.id ? { ...x, q: e.target.value } : x))
                                  }))
                                }
                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                              />
                              <textarea
                                value={item.a}
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    faq: prev.faq.map((x) => (x.id === item.id ? { ...x, a: e.target.value } : x))
                                  }))
                                }
                                rows={2}
                                className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Личный кабинет</p>
                        <div className="mt-2 grid gap-2">
                          <input value={editorDraft.cabinet.title} onChange={(e) => updateDraft((prev) => ({ ...prev, cabinet: { ...prev.cabinet, title: e.target.value } }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                          <textarea value={editorDraft.cabinet.text} onChange={(e) => updateDraft((prev) => ({ ...prev, cabinet: { ...prev.cabinet, text: e.target.value } }))} rows={2} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                          <input value={editorDraft.cabinet.cta} onChange={(e) => updateDraft((prev) => ({ ...prev, cabinet: { ...prev.cabinet, cta: e.target.value } }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Цвета и контакты</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <label className="text-xs font-semibold text-slate-600">Accent
                            <input type="color" value={editorDraft.palette.accent} onChange={(e) => updateDraft((prev) => ({ ...prev, palette: { ...prev.palette, accent: e.target.value } }))} className="mt-1 h-9 w-full rounded border border-slate-300" />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">Base
                            <input type="color" value={editorDraft.palette.base} onChange={(e) => updateDraft((prev) => ({ ...prev, palette: { ...prev.palette, base: e.target.value } }))} className="mt-1 h-9 w-full rounded border border-slate-300" />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">Hero
                            <input type="color" value={editorDraft.palette.hero} onChange={(e) => updateDraft((prev) => ({ ...prev, palette: { ...prev.palette, hero: e.target.value } }))} className="mt-1 h-9 w-full rounded border border-slate-300" />
                          </label>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <input value={editorDraft.links.telegram} onChange={(e) => updateDraft((prev) => ({ ...prev, links: { ...prev.links, telegram: e.target.value } }))} placeholder="Telegram URL" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                          <input value={editorDraft.links.whatsapp} onChange={(e) => updateDraft((prev) => ({ ...prev, links: { ...prev.links, whatsapp: e.target.value } }))} placeholder="WhatsApp URL" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                          <input value={editorDraft.links.instagram} onChange={(e) => updateDraft((prev) => ({ ...prev, links: { ...prev.links, instagram: e.target.value } }))} placeholder="Instagram URL" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                        </div>
                        <input value={editorDraft.contactLine} onChange={(e) => updateDraft((prev) => ({ ...prev, contactLine: e.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Секции (drag-and-drop)</p>
                        <div className="mt-2 grid gap-2">
                          {editorDraft.sectionOrder.map((sectionKey) => {
                            const meta = editorSections.find((s) => s.key === sectionKey);
                            return (
                              <div
                                key={sectionKey}
                                draggable
                                onDragStart={() => setDragSectionId(sectionKey)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (!dragSectionId || dragSectionId === sectionKey) return;
                                  updateDraft((prev) => ({
                                    ...prev,
                                    sectionOrder: reorderArray(prev.sectionOrder, (item) => item, dragSectionId, sectionKey)
                                  }));
                                  setDragSectionId(null);
                                }}
                                onDragEnd={() => setDragSectionId(null)}
                                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                              >
                                <span className="font-semibold text-slate-700">⋮⋮ {meta?.label || sectionKey}</span>
                                <button
                                  onClick={() =>
                                    updateDraft((prev) => ({
                                      ...prev,
                                      sectionsEnabled: { ...prev.sectionsEnabled, [sectionKey]: !prev.sectionsEnabled[sectionKey] }
                                    }))
                                  }
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${editorDraft.sectionsEnabled[sectionKey] ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}
                                >
                                  {editorDraft.sectionsEnabled[sectionKey] ? "Вкл" : "Выкл"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Услуги (drag-and-drop + фото)</p>
                        <div className="mt-2 grid gap-2">
                          {editorDraft.services.map((service) => (
                            <div
                              key={service.id}
                              draggable
                              onDragStart={() => setDragServiceId(service.id)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (!dragServiceId || dragServiceId === service.id) return;
                                updateDraft((prev) => ({
                                  ...prev,
                                  services: reorderArray(prev.services, (item) => item.id, dragServiceId, service.id)
                                }));
                                setDragServiceId(null);
                              }}
                              onDragEnd={() => setDragServiceId(null)}
                              className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                            >
                              <div className="grid gap-2 sm:grid-cols-3">
                                <input value={service.title} onChange={(e) => updateDraft((prev) => ({ ...prev, services: prev.services.map((item) => (item.id === service.id ? { ...item, title: e.target.value } : item)) }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                                <input value={service.price} onChange={(e) => updateDraft((prev) => ({ ...prev, services: prev.services.map((item) => (item.id === service.id ? { ...item, price: e.target.value } : item)) }))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                                <label className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-xs font-semibold text-slate-700">
                                  Фото услуги
                                  <input type="file" accept="image/*" onChange={(e) => void handleServiceImageUpload(e, service.id)} className="hidden" />
                                </label>
                              </div>
                              <textarea value={service.description} onChange={(e) => updateDraft((prev) => ({ ...prev, services: prev.services.map((item) => (item.id === service.id ? { ...item, description: e.target.value } : item)) }))} rows={2} className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="relative h-[640px] overflow-y-auto pb-24" style={{ backgroundColor: editorDraft.palette.base }}>
                        <div className="border-b border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900">{state.brief.businessName || "Название бизнеса"}</p>
                            <div className="flex items-center gap-1.5">
                              {[
                                { id: "tg", label: "TG", href: toHref(editorDraft.links.telegram) },
                                { id: "wa", label: "WA", href: toHref(editorDraft.links.whatsapp) },
                                { id: "ig", label: "IG", href: toHref(editorDraft.links.instagram) }
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

                        {editorPreviewTab === "home" ? (
                          <div className="px-4 py-5" style={{ backgroundColor: editorDraft.palette.hero }}>
                            <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">{editorDraft.hero.title}</h3>
                            <p className="mt-2 text-sm text-slate-700">{editorDraft.hero.subtitle}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button className="rounded-full px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: editorDraft.palette.accent }}>{editorDraft.hero.primaryCta}</button>
                              <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700">{editorDraft.hero.secondaryCta}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="border-b border-slate-200 bg-white px-4 py-4">
                            <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
                              {editorPreviewTab === "services" && "Услуги и каталог"}
                              {editorPreviewTab === "reviews" && "Отзывы и FAQ"}
                              {editorPreviewTab === "cabinet" && "Личный кабинет"}
                            </h3>
                          </div>
                        )}

                        <div className="space-y-3 p-4">
                          {editorDraft.sectionOrder.map((sectionKey) => {
                            if (!editorDraft.sectionsEnabled[sectionKey]) return null;
                            if (sectionKey === "about" && editorPreviewTab === "home") {
                              return (
                                <div key={sectionKey} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">О компании</p>
                                  <p className="mt-1 text-sm text-slate-700">{editorDraft.about}</p>
                                </div>
                              );
                            }
                            if (sectionKey === "services" && (editorPreviewTab === "home" || editorPreviewTab === "services")) {
                              return (
                                <div key={sectionKey} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Услуги</p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                    {editorDraft.services.map((service) => (
                                      <div key={service.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                        {service.image ? <img src={service.image} alt={service.title} className="h-16 w-full rounded-md object-cover" /> : null}
                                        <p className="mt-1 text-xs font-semibold text-slate-900">{service.title}</p>
                                        <p className="text-[11px] text-slate-600">{service.price}</p>
                                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{service.description}</p>
                                        <button className="mt-2 rounded-full border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700">Подробнее</button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            if (sectionKey === "process" && editorPreviewTab === "home") {
                              return (
                                <div key={sectionKey} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Как это работает</p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                    {editorDraft.processSteps.map((step) => <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{step}</div>)}
                                  </div>
                                </div>
                              );
                            }
                            if (sectionKey === "testimonials" && editorPreviewTab === "reviews") {
                              return (
                                <div key={sectionKey} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Отзывы</p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                    {editorDraft.testimonials.map((item) => (
                                      <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                        <p className="text-xs font-semibold text-slate-900">{item.author}</p>
                                        <p className="text-[11px] text-slate-700">{item.text}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            if (sectionKey === "faq" && editorPreviewTab === "reviews") {
                              return (
                                <div key={sectionKey} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">FAQ</p>
                                  {editorDraft.faq.map((item) => (
                                    <div key={item.id} className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                      <p className="text-xs font-semibold text-slate-900">{item.q}</p>
                                      <p className="text-[11px] text-slate-700">{item.a}</p>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            if (sectionKey === "cabinet" && editorPreviewTab === "cabinet") {
                              return (
                                <div key={sectionKey} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-sm font-semibold text-slate-900">{editorDraft.cabinet.title}</p>
                                  <p className="mt-1 text-xs text-slate-700">{editorDraft.cabinet.text}</p>
                                  <button className="mt-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: editorDraft.palette.accent }}>
                                    {editorDraft.cabinet.cta}
                                  </button>
                                </div>
                              );
                            }
                            if (sectionKey === "gallery" && editorPreviewTab === "home" && state.photos.length > 0) {
                              return (
                                <div key={sectionKey} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Галерея</p>
                                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {state.photos.map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt={`gallery-${index}`} className="h-20 w-full rounded-lg object-cover" />)}
                                  </div>
                                </div>
                              );
                            }
                            if (sectionKey === "contacts" && editorPreviewTab === "home") {
                              return (
                                <div key={sectionKey} className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                                  <p className="text-sm font-semibold text-slate-900">{editorDraft.contactLine}</p>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>

                        <div className="sticky bottom-3 z-20 flex justify-center px-4">
                          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
                            {previewTabs.map((tab) => (
                              <button
                                key={tab.id}
                                onClick={() => setEditorPreviewTab(tab.id)}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                  editorPreviewTab === tab.id ? "text-white" : "text-slate-700"
                                }`}
                                style={editorPreviewTab === tab.id ? { backgroundColor: editorDraft.palette.accent } : undefined}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">Сначала выберите концепт на предыдущем шаге.</p>
                )}
                <button onClick={() => dispatch({ type: "set_step", step: "publish" })} className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Перейти к оплате и публикации</button>
              </div>
            ) : null}

            {state.step === "publish" ? (
              <div className="space-y-4">
                <h2 className={sectionTitleClass()}>Оплата и публикация</h2>
                <p className="mt-2 text-sm text-slate-600">Надежный flow: оплата на этой странице, затем публикация, fullscreen загрузка и автопереход на готовый сайт.</p>

                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-cyan-700">Оплата</p>
                  {state.paymentStatus === "success" ? (
                    <p className="mt-2 text-sm font-semibold text-emerald-700">Оплата подтверждена. Можно публиковать.</p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-700">Перед публикацией оплатите сайт: 3 500 ₽ за один проект.</p>
                  )}
                  <button
                    onClick={handleMockPayment}
                    disabled={state.paymentStatus === "loading" || state.paymentStatus === "success"}
                    className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {state.paymentStatus === "loading" ? "Проверяем оплату..." : state.paymentStatus === "success" ? "Оплачено" : "Оплатить 3 500 ₽"}
                  </button>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">Публикация</p>
                  <p className="mt-2 text-sm text-slate-700">После клика откроется полноэкранная загрузка. Когда сайт будет готов, произойдет автоматический переход на адрес `/s/slug`.</p>
                  <div className="mt-3 space-y-1">
                    {publishRequirements.map((item) => (
                      <p key={item.key} className={`text-xs font-semibold ${item.ok ? "text-emerald-700" : "text-amber-700"}`}>
                        {item.ok ? "✓" : "•"} {item.text}
                      </p>
                    ))}
                  </div>
                  <button
                    onClick={() => void handlePublish()}
                    disabled={!canPublishNow}
                    className="mt-3 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {state.publishStatus === "loading" ? "Публикуем..." : "Опубликовать сайт"}
                  </button>
                  {!canPublishNow ? (
                    <p className="mt-2 text-xs text-amber-700">Чтобы опубликовать, завершите пункты из списка выше.</p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Связка с CFlow после публикации</p>
                  <p className="mt-2 text-sm text-slate-700">Готовый сайт можно сразу подключить к обработке лидов в кабинете и сценариям Telegram.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => onNavigate("/dashboard")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      Открыть кабинет
                    </button>
                    <button onClick={() => onNavigate("/workbench")} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      Открыть AI Inbox
                    </button>
                    {toHref(state.brief.telegramLink) ? (
                      <a href={toHref(state.brief.telegramLink)} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700">
                        Telegram канала
                      </a>
                    ) : null}
                  </div>
                </div>

                {state.publishedPath ? (
                  <button onClick={() => onNavigate(state.publishedPath!)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                    Открыть сайт сейчас
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="space-y-4">
            <div className={sectionCardClass()}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Состояния</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className={`rounded-xl border px-3 py-2 ${statusClass(state.conceptsStatus)}`}>Генерация концептов: {statusLabel(state.conceptsStatus)}</div>
                <div className={`rounded-xl border px-3 py-2 ${statusClass(state.paymentStatus)}`}>Оплата: {statusLabel(state.paymentStatus)}</div>
                <div className={`rounded-xl border px-3 py-2 ${statusClass(state.publishStatus)}`}>Публикация: {statusLabel(state.publishStatus)}</div>
              </div>
              {state.conceptsError ? <p className="mt-2 text-xs text-rose-700">{state.conceptsError}</p> : null}
              {state.paymentError ? <p className="mt-2 text-xs text-rose-700">{state.paymentError}</p> : null}
              {state.publishError ? <p className="mt-2 text-xs text-rose-700">{state.publishError}</p> : null}
              {state.publishedPath ? (
                <p className="mt-2 text-xs text-emerald-700">
                  Сайт опубликован: <span className="font-semibold">{state.publishedPath}</span>
                </p>
              ) : null}
            </div>
            <div className={sectionCardClass()}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Текущий контекст</p>
              <p className="mt-2 text-sm text-slate-700">Бизнес: <span className="font-semibold text-slate-900">{state.brief.businessName || "не заполнен"}</span></p>
              <p className="mt-1 text-sm text-slate-700">Ниша: <span className="font-semibold text-slate-900">{state.brief.niche || "не заполнена"}</span></p>
              <p className="mt-1 text-sm text-slate-700">Референсы: <span className="font-semibold text-slate-900">{state.references.filter((r) => r.url.trim()).length}</span></p>
              <p className="mt-1 text-sm text-slate-700">Фото: <span className="font-semibold text-slate-900">{state.photos.length}</span></p>
            </div>
            <div className={sectionCardClass()}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Интеграции CFlow</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {["Telegram", "WhatsApp", "Instagram", "AI Inbox"].map((item) => (
                  <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">После публикации сайт становится точкой входа, а CFlow берет обработку лидов, квалификацию и маршрутизацию в кабинет.</p>
            </div>
          </aside>
        </div>
      </div>
      {state.publishStatus === "loading" ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-md">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="mt-4 text-lg font-bold text-white">Публикация сайта</p>
            <p className="mt-2 text-sm text-slate-200">{publishOverlayMessage}</p>
            <p className="mt-2 text-xs text-slate-300">Не закрывайте страницу, идет подготовка ссылки.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
