declare const process: { env: Record<string, string | undefined> };

const SYSTEM_PROMPT =
  "Ты senior UX-copywriter для премиального B2B SaaS. " +
  "Пиши только по-русски, без hype, без клише. " +
  "Верни строго JSON без markdown и без пояснений.";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENROUTER_API_KEY is not set" });
    return;
  }

  try {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const requestedModel = typeof req.body?.model === "string" ? req.body.model.trim() : "";
    const model = requestedModel || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
    const referer = process.env.OPENROUTER_SITE_URL || "https://clients-flow-ten.vercel.app";

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "ClientsFlow Sites"
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data?.error || "OpenRouter error" });
      return;
    }

    const content = data?.choices?.[0]?.message?.content;
    const reply =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((item: any) => item?.text || "").join("\n").trim()
          : "";

    res.status(200).json({ reply, mode: "openrouter", model });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "OpenRouter handler error" });
  }
}
