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
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offset,
        timeout: 0,
        allowed_updates: ["message"]
      })
    });

    const data = await response.json();
    if (!response.ok || data?.ok !== true) {
      res.status(400).json({ error: data?.description || "Telegram getUpdates failed" });
      return;
    }

    const updates: TelegramUpdate[] = Array.isArray(data.result) ? data.result : [];
    res.status(200).json({ updates });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Telegram getUpdates error" });
  }
}
