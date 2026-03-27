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
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  try {
    const response = await callSupabaseAuth("token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    const data = await readJsonSafe<any>(response);
    if (!response.ok) {
      res.status(response.status).json({ error: asString(data?.error_description || data?.msg || data?.error || "login_failed") });
      return;
    }
    res.status(200).json({
      access_token: asString(data?.access_token),
      refresh_token: asString(data?.refresh_token),
      expires_in: Number(data?.expires_in || 0),
      token_type: asString(data?.token_type || "bearer"),
      user: data?.user || null
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "auth_login_failed" });
  }
}

