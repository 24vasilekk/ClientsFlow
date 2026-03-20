import { FormEvent, useEffect, useMemo, useState } from "react";

type RoutePath = "/" | "/login" | "/dashboard" | "/pricing" | "/workbench";

type WorkbenchMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type BusinessAudit = {
  summary: string;
  whatWorks: string[];
  risks: string[];
  quickWins: string[];
  automationPlan: string[];
  telegramPlan: string[];
  kpis: string[];
  firstWeekPlan: string[];
  estimatedImpact: string;
};

type IntegrationState = {
  botToken: string;
  botUsername: string;
  webhookUrl: string;
  telegramChannel: string;
  openrouterApiKey: string;
};

const INTEGRATION_KEY = "clientsflow_workbench_integrations_v1";
const METRICS_KEY = "clientsflow_workbench_metrics_v1";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function parseJsonBlock<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export default function WorkbenchApp({ onNavigate }: { onNavigate: (path: RoutePath) => void }) {
  const [integration, setIntegration] = useState<IntegrationState>(() => {
    try {
      const raw = localStorage.getItem(INTEGRATION_KEY);
      if (!raw) {
        return {
          botToken: "",
          botUsername: "",
          webhookUrl: "",
          telegramChannel: "",
          openrouterApiKey: ""
        };
      }
      return JSON.parse(raw) as IntegrationState;
    } catch {
      return {
        botToken: "",
        botUsername: "",
        webhookUrl: "",
        telegramChannel: "",
        openrouterApiKey: ""
      };
    }
  });

  const [copilotInput, setCopilotInput] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<WorkbenchMessage[]>([
    {
      id: uid(),
      role: "assistant",
      text: "Готов помочь с запуском рабочего контура: Telegram, ответы клиентам, аналитика и план роста. Опиши текущую задачу."
    }
  ]);

  const [auditBusinessName, setAuditBusinessName] = useState("Studio Nova");
  const [auditNiche, setAuditNiche] = useState("beauty salon");
  const [auditRegion, setAuditRegion] = useState("Москва");
  const [auditAvgCheck, setAuditAvgCheck] = useState("4500 ₽");
  const [auditChannels, setAuditChannels] = useState("Telegram, Instagram, WhatsApp");
  const [auditCurrentProblem, setAuditCurrentProblem] = useState("Теряем лиды из-за позднего ответа и слабого follow-up");
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<BusinessAudit | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [metrics, setMetrics] = useState(() => {
    try {
      const raw = localStorage.getItem(METRICS_KEY);
      if (!raw) return { analyses: 0, copilotMessages: 0, telegramConfigured: false, lastAuditAt: "" };
      return JSON.parse(raw) as { analyses: number; copilotMessages: number; telegramConfigured: boolean; lastAuditAt: string };
    } catch {
      return { analyses: 0, copilotMessages: 0, telegramConfigured: false, lastAuditAt: "" };
    }
  });

  useEffect(() => {
    localStorage.setItem(INTEGRATION_KEY, JSON.stringify(integration));
  }, [integration]);

  useEffect(() => {
    localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
  }, [metrics]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const integrationReady = useMemo(
    () =>
      Boolean(
        integration.botToken.trim() &&
          integration.botUsername.trim() &&
          integration.webhookUrl.trim() &&
          integration.telegramChannel.trim()
      ),
    [integration]
  );

  const saveIntegration = (event: FormEvent) => {
    event.preventDefault();
    setMetrics((prev) => ({ ...prev, telegramConfigured: integrationReady }));
    setNotice(integrationReady ? "Интеграция сохранена. Можно подключать Telegram и запускать аналитику." : "Заполните все поля Telegram-интеграции.");
  };

  const sendCopilot = async () => {
    const text = copilotInput.trim();
    if (!text) return;
    const next = [...copilotMessages, { id: uid(), role: "user" as const, text }];
    setCopilotMessages(next);
    setCopilotInput("");
    setCopilotLoading(true);
    try {
      const response = await fetch("/api/openrouter/product-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((msg) => ({ role: msg.role, content: msg.text }))
        })
      });
      const data = (await response.json()) as { reply?: string };
      const replyText = data.reply?.trim() || "Принял задачу. Давай разобьем её на 3 шага и сразу внедрим первый.";
      setCopilotMessages((prev) => [...prev, { id: uid(), role: "assistant", text: replyText }]);
      setMetrics((prev) => ({ ...prev, copilotMessages: prev.copilotMessages + 1 }));
    } catch {
      setCopilotMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          text: "Связь с моделью временно недоступна. Можно продолжить через ручной план внедрения в Telegram."
        }
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  const runBusinessAudit = async () => {
    setAuditLoading(true);
    try {
      const response = await fetch("/api/openrouter/business-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: auditBusinessName,
          niche: auditNiche,
          region: auditRegion,
          avgCheck: auditAvgCheck,
          channels: auditChannels,
          problem: auditCurrentProblem,
          telegramChannel: integration.telegramChannel
        })
      });
      const data = (await response.json()) as { reply?: string };
      const parsed = parseJsonBlock<BusinessAudit>(data.reply ?? "");
      if (!parsed) {
        throw new Error("Parse error");
      }
      setAuditResult(parsed);
      setMetrics((prev) => ({
        ...prev,
        analyses: prev.analyses + 1,
        lastAuditAt: new Date().toLocaleString("ru-RU")
      }));
      setNotice("Аудит готов. Можно переносить рекомендации в сценарии Telegram.");
    } catch {
      setAuditResult({
        summary: "Обнаружены потери на этапе первого ответа и после вопроса о цене.",
        whatWorks: ["Сильный спрос по текущим каналам", "Есть стабильный поток входящих обращений", "Потенциал для роста через follow-up"],
        risks: ["Долгое первое касание", "Нет стандарта ответа по цене", "Нет регулярного повторного контакта с тихими лидами"],
        quickWins: ["Сократить время первого ответа до 2 минут", "Добавить шаблон ответа на цену", "Ввести follow-up через 45 минут"],
        automationPlan: ["Автоответ на входящие", "Квалификация по 3 вопросам", "Передача менеджеру сложных кейсов"],
        telegramPlan: ["Подключить Telegram Bot API", "Собрать очередь входящих в Inbox", "Логировать этапы лида и итог диалога"],
        kpis: ["Время первого ответа", "Доля квалифицированных лидов", "Конверсия в запись"],
        firstWeekPlan: ["День 1-2: подключение Telegram", "День 3-4: запуск сценариев", "День 5-7: анализ и коррекция"],
        estimatedImpact: "+12-18% к записям за 30 дней при корректном follow-up"
      });
      setNotice("Модель недоступна. Показан резервный аудит-шаблон для запуска работ.");
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8f6] px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-[1240px] space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">Рабочий контур</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">ClientsFlow Operator Console</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Здесь готовим реальный продукт: подключение Telegram, copilot для любых вопросов и аудит бизнеса с планом внедрения.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onNavigate("/dashboard")} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Личный кабинет
              </button>
              <button onClick={() => onNavigate("/")} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                На главную
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Аудитов выполнено</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{metrics.analyses}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Диалогов с Copilot</p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{metrics.copilotMessages}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Telegram интеграция</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{metrics.telegramConfigured ? "Готова" : "Не завершена"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Последний аудит</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{metrics.lastAuditAt || "Ещё не запускали"}</p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <form onSubmit={saveIntegration} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Интеграция</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Telegram + каналы</h2>
            <div className="mt-4 grid gap-3">
              <input value={integration.botToken} onChange={(e) => setIntegration((prev) => ({ ...prev, botToken: e.target.value }))} placeholder="Telegram Bot Token" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
              <input value={integration.botUsername} onChange={(e) => setIntegration((prev) => ({ ...prev, botUsername: e.target.value }))} placeholder="@bot_username" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
              <input value={integration.webhookUrl} onChange={(e) => setIntegration((prev) => ({ ...prev, webhookUrl: e.target.value }))} placeholder="Webhook URL" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
              <input value={integration.telegramChannel} onChange={(e) => setIntegration((prev) => ({ ...prev, telegramChannel: e.target.value }))} placeholder="Ссылка на Telegram канал / чат" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
              <input value={integration.openrouterApiKey} onChange={(e) => setIntegration((prev) => ({ ...prev, openrouterApiKey: e.target.value }))} placeholder="OpenRouter API key (для менеджера/ops)" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
            </div>
            <button className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Сохранить интеграцию</button>
            <p className="mt-2 text-xs text-slate-500">MVP-режим: данные сохраняются локально, далее можно подключить реальный backend pipeline.</p>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Product Copilot</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Любые вопросы по продукту и внедрению</h2>
            <div className="mt-4 h-[280px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {copilotMessages.map((msg) => (
                <div key={msg.id} className={`max-w-[92%] rounded-xl border px-3 py-2 text-sm ${msg.role === "assistant" ? "border-slate-200 bg-white text-slate-800" : "ml-auto border-cyan-200 bg-cyan-50 text-cyan-950"}`}>
                  {msg.text}
                </div>
              ))}
              {copilotLoading ? <div className="text-xs text-slate-500">Готовлю ответ...</div> : null}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={copilotInput} onChange={(e) => setCopilotInput(e.target.value)} placeholder="Например: как запустить автоответ в Telegram?" className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
              <button onClick={() => void sendCopilot()} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Отправить
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Аудит бизнеса</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Кнопка: Проанализируй мой бизнес</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input value={auditBusinessName} onChange={(e) => setAuditBusinessName(e.target.value)} placeholder="Название бизнеса" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
            <input value={auditNiche} onChange={(e) => setAuditNiche(e.target.value)} placeholder="Ниша" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
            <input value={auditRegion} onChange={(e) => setAuditRegion(e.target.value)} placeholder="Город / регион" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
            <input value={auditAvgCheck} onChange={(e) => setAuditAvgCheck(e.target.value)} placeholder="Средний чек" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
            <input value={auditChannels} onChange={(e) => setAuditChannels(e.target.value)} placeholder="Текущие каналы лидов" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm md:col-span-2 xl:col-span-1" />
            <input value={auditCurrentProblem} onChange={(e) => setAuditCurrentProblem(e.target.value)} placeholder="Ключевая проблема" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm md:col-span-2 xl:col-span-2" />
          </div>
          <button onClick={() => void runBusinessAudit()} className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
            {auditLoading ? "Анализирую..." : "Проанализируй мой бизнес"}
          </button>
          {auditResult ? (
            <div className="mt-4 grid gap-3 xl:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 xl:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Summary</p>
                <p className="mt-1 text-sm text-slate-800">{auditResult.summary}</p>
                <p className="mt-2 text-xs font-semibold text-cyan-700">{auditResult.estimatedImpact}</p>
              </div>
              {[
                { title: "Что уже работает", items: auditResult.whatWorks },
                { title: "Риски", items: auditResult.risks },
                { title: "Быстрые улучшения", items: auditResult.quickWins },
                { title: "План автоматизации", items: auditResult.automationPlan },
                { title: "План для Telegram", items: auditResult.telegramPlan },
                { title: "План на 7 дней", items: auditResult.firstWeekPlan }
              ].map((group) => (
                <div key={group.title} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{group.title}</p>
                  <div className="mt-2 space-y-1.5">
                    {group.items.map((item) => (
                      <p key={item} className="text-sm text-slate-700">• {item}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
      {notice ? (
        <div className="fixed bottom-4 right-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
