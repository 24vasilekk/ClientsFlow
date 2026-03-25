import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createPublishedSite, getPublishedSite, type PublishedSitePayload } from "./lib/sites/store";
import chatApiHandler from "./api/openrouter/chat";

function openRouterMiddleware() {
  const systemPrompt =
    "Ты консультант ClientsFlow для B2B бизнеса. Пиши только по-русски. " +
    "Всегда отвечай как живой специалист, а не как технология. " +
    "Запрещено использовать слова: AI, ИИ, нейросеть, искусственный интеллект, бот, ассистент. " +
    "Запрещено использовать markdown и служебное оформление: *, **, #, -, ---, [ ], ( ). " +
    "Формат строго: 1 короткий ответ и отдельная строка с префиксом Следующий шаг:. " +
    "Ответ до 220 символов, без списков и без длинных пояснений. " +
    "Стиль: спокойно, профессионально, конкретно, без хайпа. " +
    "Фокус: лиды, запись, квалификация, follow-up, конверсия, аналитика. " +
    "Следующий шаг должен быть чётким действием.";
  const sitesSystemPrompt =
    "Ты senior UX-copywriter для премиального B2B SaaS. " +
    "Пиши только по-русски, без hype, без клише. " +
    "Верни строго JSON без markdown и без пояснений.";
  const productChatPrompt =
    "Ты продуктовый copilot ClientsFlow для владельцев бизнеса. " +
    "Пиши по-русски, практично и конкретно. " +
    "Давай рекомендации по Telegram, лидам, конверсии, записи и аналитике.";
  const businessAuditPrompt =
    "Ты senior growth-аналитик для сервисных бизнесов. " +
    "Пиши по-русски и верни только JSON без markdown.";
  const businessBriefPrompt =
    "Ты продуктовый аналитик внедрения ClientsFlow для сервисных бизнесов. " +
    "Сгенерируй ОДИН следующий вопрос для брифа бизнеса. " +
    "Вопрос короткий, конкретный, без markdown. " +
    "Учитывай предыдущие ответы, не повторяйся, не упоминай AI/бота/модель.";
  const businessSummaryPrompt =
    "Ты product strategist для сервисного бизнеса. " +
    "Сформируй краткий профиль бизнеса для внутреннего использования в ответах клиентам. " +
    "Язык: русский. Объем: 200-400 слов. Без markdown, без списков, одним цельным текстом.";
  const telegramReplyPrompt =
    "Ты отвечаешь клиенту в Telegram от лица сервисного бизнеса. " +
    "Пиши по-русски, кратко и вежливо, как живой менеджер. " +
    "Цель: уточнить запрос и предложить следующий шаг к записи.";

  const pickNextStep = (context: string) => {
    const text = context.toLowerCase();
    if (text.includes("голос") || text.includes("аудио")) return "Отправьте голосовое, и я дам готовый вариант ответа клиенту.";
    if (text.includes("фото") || text.includes("изображ") || text.includes("картин")) return "Загрузите фото запроса, и я предложу корректный сценарий ответа.";
    if (text.includes("цена") || text.includes("стоим") || text.includes("дорог")) return "Напишите: Покажи ответ на вопрос о цене.";
    if (text.includes("аналит") || text.includes("ворон") || text.includes("конверс") || text.includes("выруч")) return "Перейдите в личный кабинет и откройте раздел аналитики.";
    if (text.includes("запис") || text.includes("брон") || text.includes("слот") || text.includes("календар")) return "Напишите: Нужен сценарий доведения до записи.";
    if (text.includes("директ") || text.includes("лид") || text.includes("входящ") || text.includes("клиент")) return "Напишите сферу бизнеса, и я предложу стартовый сценарий первого ответа.";
    return "Опишите задачу в одном предложении, и я предложу рабочий сценарий.";
  };

  const extractUserText = (content: unknown) => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      const textPart = content.find((item: any) => item?.type === "text" && typeof item?.text === "string");
      return textPart?.text || "";
    }
    return "";
  };

  const formatSalesReply = (text: string, context = "") => {
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
    const main = compact || "Понял задачу и вижу, как усилить обработку входящих.";
    return `${main}\nСледующий шаг: ${pickNextStep(`${context} ${noTechWords}`)}`;
  };

  const handler = async (req: any, res: any, next: () => void) => {
    const isChatRoute = req.method === "POST" && req.url === "/api/openrouter/chat";
    const isSitesRoute = req.method === "POST" && req.url === "/api/openrouter/sites-copy";
    const isProductRoute = req.method === "POST" && req.url === "/api/openrouter/product-chat";
    const isAuditRoute = req.method === "POST" && req.url === "/api/openrouter/business-audit";
    const isBusinessBriefRoute = req.method === "POST" && req.url === "/api/openrouter/business-brief";
    const isBusinessSummaryRoute = req.method === "POST" && req.url === "/api/openrouter/business-summary";
    const isTelegramReplyRoute = req.method === "POST" && req.url === "/api/openrouter/telegram-reply";
    const isTelegramGetUpdatesRoute = req.method === "POST" && req.url === "/api/telegram/get-updates";
    const isTelegramSendRoute = req.method === "POST" && req.url === "/api/telegram/send-message";
    const isSitesPublishRoute = req.method === "POST" && req.url === "/api/sites/publish";
    const isSitesGetRoute = req.method === "GET" && String(req.url || "").startsWith("/api/sites/get");
    if (
      !isChatRoute &&
      !isSitesRoute &&
      !isProductRoute &&
      !isAuditRoute &&
      !isBusinessBriefRoute &&
      !isBusinessSummaryRoute &&
      !isTelegramReplyRoute &&
      !isTelegramGetUpdatesRoute &&
      !isTelegramSendRoute &&
      !isSitesPublishRoute &&
      !isSitesGetRoute
    ) {
      next();
      return;
    }

    if (isSitesPublishRoute || isSitesGetRoute) {
      try {
        if (isSitesGetRoute) {
          const parsed = new URL(String(req.url || "/api/sites/get"), "http://localhost");
          const slug = (parsed.searchParams.get("slug") || "").trim();
          if (!slug) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "slug is required" }));
            return;
          }
          const site = await getPublishedSite(slug);
          if (!site) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Not found" }));
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(site));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks).toString("utf8");
        const payload = (raw ? JSON.parse(raw) : {}) as Partial<PublishedSitePayload>;
        if (!payload.businessName || !payload.logoUrl || !payload.heroTitle) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing required fields" }));
          return;
        }
        const doc = await createPublishedSite({
          businessName: String(payload.businessName || "Business"),
          city: String(payload.city || ""),
          logoUrl: String(payload.logoUrl || ""),
          accentColor: String(payload.accentColor || "#0f172a"),
          baseColor: String(payload.baseColor || "#f8fafc"),
          heroTitle: String(payload.heroTitle || ""),
          heroSubtitle: String(payload.heroSubtitle || ""),
          about: String(payload.about || ""),
          primaryCta: String(payload.primaryCta || "Связаться"),
          secondaryCta: String(payload.secondaryCta || "Услуги"),
          trustStats: Array.isArray(payload.trustStats) ? payload.trustStats.slice(0, 3) : [],
          valueProps: Array.isArray(payload.valueProps) ? payload.valueProps.slice(0, 3) : [],
          processSteps: Array.isArray(payload.processSteps) ? payload.processSteps.slice(0, 4) : [],
          testimonials: Array.isArray(payload.testimonials) ? payload.testimonials.slice(0, 6) : [],
          faq: Array.isArray(payload.faq) ? payload.faq.slice(0, 10) : [],
          contactLine: String(payload.contactLine || ""),
          products: Array.isArray(payload.products) ? payload.products.slice(0, 24) : [],
          sections: payload.sections && typeof payload.sections === "object" ? (payload.sections as Record<string, boolean>) : {},
          sectionOrder: Array.isArray(payload.sectionOrder) ? payload.sectionOrder.map((item) => String(item)) : [],
          galleryUrls: Array.isArray(payload.galleryUrls) ? payload.galleryUrls.slice(0, 20).map((item) => String(item)) : [],
          cabinetEnabled: payload.cabinetEnabled !== false,
          telegramBot: String(payload.telegramBot || "@clientsflow_support_bot")
        });
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ slug: doc.slug, url: `http://localhost:5173/s/${doc.slug}` }));
        return;
      } catch (error: any) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: error?.message || "Sites API error" }));
        return;
      }
    }

    if (isChatRoute) {
      await chatApiHandler(req, res);
      return;
    }

    if (isTelegramGetUpdatesRoute || isTelegramSendRoute) {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks).toString("utf8");
        const body = raw ? JSON.parse(raw) : {};
        const botToken = body.botToken || process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Telegram bot token is missing" }));
          return;
        }
        if (isTelegramGetUpdatesRoute) {
          const offset = Number(body.offset ?? 0);
          const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ offset, timeout: 0, allowed_updates: ["message"] })
          });
          const tgData = await tgResponse.json();
          if (!tgResponse.ok || tgData?.ok !== true) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: tgData?.description || "Telegram getUpdates failed" }));
            return;
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ updates: Array.isArray(tgData.result) ? tgData.result : [] }));
          return;
        }

        const chatId = body.chatId;
        const text = body.text;
        if (!chatId || !text) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "chatId and text are required" }));
          return;
        }
        const tgResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
        });
        const tgData = await tgResponse.json();
        if (!tgResponse.ok || tgData?.ok !== true) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: tgData?.description || "Telegram sendMessage failed" }));
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, result: tgData.result }));
        return;
      } catch (error: any) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: error?.message || "Telegram middleware error" }));
        return;
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "OPENROUTER_API_KEY is not set", mode: "mock" }));
      return;
    }

    try {
      let messages: any[] = [];
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : {};
      if (isAuditRoute) {
        const auditPrompt = [
          "Проанализируй бизнес-контекст и дай практический план улучшений.",
          "Верни JSON строго по схеме:",
          "{\"summary\":\"\",\"whatWorks\":[\"\",\"\",\"\"],\"risks\":[\"\",\"\",\"\"],\"quickWins\":[\"\",\"\",\"\"],\"automationPlan\":[\"\",\"\",\"\"],\"telegramPlan\":[\"\",\"\",\"\"],\"kpis\":[\"\",\"\",\"\"],\"firstWeekPlan\":[\"\",\"\",\"\"],\"estimatedImpact\":\"\"}",
          "Контекст:",
          JSON.stringify(body, null, 2)
        ].join("\n");
        messages = [{ role: "user", content: auditPrompt }];
      } else if (isBusinessBriefRoute) {
        const answers = Array.isArray(body.answers) ? body.answers : [];
        const prompt = [
          `Сервис: ${typeof body.serviceName === "string" ? body.serviceName : "Подключенный сервис"}`,
          typeof body.endpoint === "string" && body.endpoint ? `Endpoint: ${body.endpoint}` : "",
          `Нужно задать вопрос №${answers.length + 1} из минимум ${Math.max(10, Number(body.targetCount || 10))}.`,
          "Уже полученные ответы:",
          answers.length
            ? answers
                .map((item: any, i: number) => `${i + 1}. ${String(item?.question || "")} => ${String(item?.answer || "")}`)
                .join("\n")
            : "Пока ответов нет."
        ]
          .filter(Boolean)
          .join("\n");
        messages = [{ role: "user", content: prompt }];
      } else if (isBusinessSummaryRoute) {
        const answers = Array.isArray(body.answers) ? body.answers : [];
        const prompt = [
          `Бизнес: ${typeof body.businessName === "string" ? body.businessName : "Подключенный бизнес"}`,
          `Каналы: ${Array.isArray(body.channels) ? body.channels.join(", ") : ""}`,
          "Ответы владельца на вопросы о бизнесе:",
          answers
            .map((item: any, i: number) => `${i + 1}. ${String(item?.question || "")}: ${String(item?.answer || "")}`)
            .join("\n")
        ]
          .filter(Boolean)
          .join("\n");
        messages = [{ role: "user", content: prompt }];
      } else {
        messages = Array.isArray(body.messages) ? body.messages : [];
        if (isTelegramReplyRoute && typeof body.text === "string") {
          const businessName = typeof body.businessName === "string" ? body.businessName : "ClientsFlow";
          const businessContext = typeof body.businessContext === "string" ? body.businessContext : "";
          messages = [
            {
              role: "user",
              content: [
                `Бизнес: ${businessName}`,
                businessContext ? `Контекст бизнеса: ${businessContext}` : "",
                "Сформируй ответ клиенту в Telegram.",
                "Формат: 1-3 коротких предложения, до 320 символов.",
                "Сообщение клиента:",
                body.text
              ].join("\n")
            }
          ];
        }
      }

      const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
      const referer = process.env.OPENROUTER_SITE_URL || "http://localhost:5173";

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": referer,
          "X-Title": isSitesRoute
            ? "ClientsFlow Sites"
            : isProductRoute
              ? "ClientsFlow Product Copilot"
                : isAuditRoute
                  ? "ClientsFlow Business Audit"
                : isBusinessBriefRoute
                  ? "ClientsFlow Business Brief"
                : isBusinessSummaryRoute
                  ? "ClientsFlow Business Summary"
                : isTelegramReplyRoute
                  ? "ClientsFlow Telegram Reply"
                : "ClientsFlow MVP"
        },
        body: JSON.stringify({
          model,
          temperature: isSitesRoute ? 0.4 : isAuditRoute ? 0.3 : isBusinessBriefRoute ? 0.35 : isBusinessSummaryRoute ? 0.3 : 0.35,
          messages: [
            {
              role: "system",
              content: isSitesRoute
                ? sitesSystemPrompt
                : isProductRoute
                  ? productChatPrompt
                  : isAuditRoute
                    ? businessAuditPrompt
                    : isBusinessBriefRoute
                      ? businessBriefPrompt
                      : isBusinessSummaryRoute
                        ? businessSummaryPrompt
                    : isTelegramReplyRoute
                      ? telegramReplyPrompt
                      : systemPrompt
            },
            ...messages
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        res.statusCode = response.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: data?.error || "OpenRouter error", mode: "mock" }));
        return;
      }

      const content = data?.choices?.[0]?.message?.content;
      const reply =
        typeof content === "string"
          ? content
          : Array.isArray(content)
            ? content.map((item) => item?.text || "").join("\n").trim()
            : "";

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      if (isSitesRoute || isProductRoute || isAuditRoute || isBusinessBriefRoute || isBusinessSummaryRoute || isTelegramReplyRoute) {
        res.end(JSON.stringify({ reply, mode: "openrouter", model }));
      } else {
        const lastUserMessage = [...messages].reverse().find((item: any) => item?.role === "user");
        const userContext = extractUserText(lastUserMessage?.content);
        res.end(JSON.stringify({ reply: formatSalesReply(reply, userContext), mode: "openrouter", model }));
      }
    } catch (error: any) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: error?.message || "Middleware error", mode: "mock" }));
    }
  };

  return {
    name: "clientsflow-openrouter-middleware",
    configureServer(server: any) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler);
    }
  };
}

export default defineConfig({
  plugins: [react(), openRouterMiddleware()]
});
