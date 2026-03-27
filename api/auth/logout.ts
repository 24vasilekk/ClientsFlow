import { readJsonSafe } from "../_db/supabase";
import { callSupabaseAuth } from "./_supabaseAuth";
import { requireAuthenticatedRequest, authErrorPayload } from "../_auth/session";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const traceId = String(req.headers?.["x-trace-id"] || `trace_logout_${Date.now().toString(36)}`);
  try {
    const auth = await requireAuthenticatedRequest(req, "api/auth/logout");
    const response = await callSupabaseAuth("logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.accessToken}` }
    });
    const data = await readJsonSafe<any>(response);
    if (!response.ok) {
      res.status(response.status).json({ error: String(data?.msg || data?.error_description || data?.error || "logout_failed") });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_")) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    res.status(500).json({ error: error?.message || "logout_failed" });
  }
}

