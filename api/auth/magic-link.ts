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
  const emailRedirectTo = asString(req.body?.emailRedirectTo).trim();
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  try {
    const response = await callSupabaseAuth("otp", {
      method: "POST",
      body: JSON.stringify({
        email,
        create_user: true,
        ...(emailRedirectTo ? { email_redirect_to: emailRedirectTo } : {})
      })
    });
    const data = await readJsonSafe<any>(response);
    if (!response.ok) {
      res.status(response.status).json({ error: asString(data?.msg || data?.error_description || data?.error || "magic_link_failed") });
      return;
    }
    res.status(200).json({ ok: true, message: "magic_link_sent" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "magic_link_failed" });
  }
}

