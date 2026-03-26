declare const process: { env: Record<string, string | undefined> };

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    from?: { id: number; is_bot: boolean; first_name?: string; username?: string };
    chat?: { id: number; type: string; title?: string; username?: string; first_name?: string };
  };
};

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTelegramWithRetry(url: string, init: RequestInit, attempts = 3, timeoutMs = 10000): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === attempts) {
        return response;
      }
      console.warn("[telegram/get-updates] retry_status", { status: response.status, attempt });
    } catch (error: any) {
      lastError = error;
      const logTag = error?.name === "AbortError" ? "retry_timeout" : "retry_network_error";
      console.warn(`[telegram/get-updates] ${logTag}`, { attempt, message: error?.message || "unknown_error" });
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timer);
    }
    await wait(250 * 2 ** (attempt - 1));
  }
  throw lastError || new Error("telegram_get_updates_failed");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const botToken = req.body?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    res.status(400).json({ error: "Telegram bot token is missing" });
    return;
  }

  const offset = Number(req.body?.offset ?? 0);
  try {
    const response = await fetchTelegramWithRetry(`https://api.telegram.org/bot${botToken}/getUpdates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offset,
        timeout: 0,
        allowed_updates: ["message"]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok !== true) {
      console.error("[telegram/get-updates] api_error", { status: response.status, error: data?.description || "unknown_error" });
      res.status(400).json({ error: data?.description || "Telegram getUpdates failed" });
      return;
    }

    const updates: TelegramUpdate[] = Array.isArray(data.result) ? data.result : [];
    res.status(200).json({ updates });
  } catch (error: any) {
    console.error("[telegram/get-updates] handler_error", { message: error?.message || "unknown_error" });
    res.status(500).json({ error: error?.message || "Telegram getUpdates error" });
  }
}
