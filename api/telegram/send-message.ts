export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const botToken = req.body?.botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = req.body?.chatId;
  const text = req.body?.text;
  if (!botToken || !chatId || !text) {
    res.status(400).json({ error: "botToken, chatId and text are required" });
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });
    const data = await response.json();
    if (!response.ok || data?.ok !== true) {
      res.status(400).json({ error: data?.description || "Telegram sendMessage failed" });
      return;
    }
    res.status(200).json({ ok: true, result: data.result });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Telegram sendMessage error" });
  }
}
