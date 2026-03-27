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
  const password = asString(req.body?.password).trim();
  const emailRedirectTo = asString(req.body?.emailRedirectTo).trim() || undefined;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const response = await callSupabaseAuth("signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        ...(emailRedirectTo ? { options: { emailRedirectTo } } : {})
      })
    });
    const data = await readJsonSafe<any>(response);
    if (!response.ok) {
      res.status(response.status).json({ error: asString(data?.msg || data?.error_description || data?.error || "signup_failed") });
      return;
    }
    res.status(200).json({
      user: data?.user || null,
      session: data?.session || null,
      message: "signup_requested"
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "auth_signup_failed" });
  }
}

