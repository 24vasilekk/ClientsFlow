import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
    if (!isChatRoute && !isSitesRoute && !isProductRoute && !isAuditRoute) {
      next();
      return;
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
      } else {
        messages = Array.isArray(body.messages) ? body.messages : [];
      }

      const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-pro";
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
                : "ClientsFlow MVP"
        },
        body: JSON.stringify({
          model,
          temperature: isSitesRoute ? 0.4 : isAuditRoute ? 0.3 : 0.35,
          messages: [
            {
              role: "system",
              content: isSitesRoute ? sitesSystemPrompt : isProductRoute ? productChatPrompt : isAuditRoute ? businessAuditPrompt : systemPrompt
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
      if (isSitesRoute || isProductRoute || isAuditRoute) {
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
