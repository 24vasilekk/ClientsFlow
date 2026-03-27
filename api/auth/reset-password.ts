import { readJsonSafe } from "../_db/supabase.js";
import { callSupabaseAuth } from "./_supabaseAuth.js";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const email = asString(req.body?.email).trim().toLowerCase();
  const redirectTo = asString(req.body?.redirectTo).trim();
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  try {
    const response = await callSupabaseAuth("recover", {
      method: "POST",
      body: JSON.stringify({
        email,
        ...(redirectTo ? { redirect_to: redirectTo } : {})
      })
    });
    const data = await readJsonSafe<any>(response);
    if (!response.ok) {
      res.status(response.status).json({ error: asString(data?.msg || data?.error_description || data?.error || "password_reset_failed") });
      return;
    }
    res.status(200).json({ ok: true, message: "password_reset_sent" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "password_reset_failed" });
  }
}

