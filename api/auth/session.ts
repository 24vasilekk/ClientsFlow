import { authErrorPayload, requireRequestContext } from "../_auth/session";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const traceId = String(req.headers?.["x-trace-id"] || `trace_session_${Date.now().toString(36)}`);
  try {
    const ctx = await requireRequestContext(req, "api/auth/session");
    res.status(200).json({
      ok: true,
      user: {
        id: ctx.userId,
        email: ctx.email || null
      },
      workspace: {
        id: ctx.workspaceId,
        role: ctx.role
      }
    });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_") || error?.code?.startsWith?.("workspace_")) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    res.status(500).json({ error: error?.message || "auth_session_failed", traceId });
  }
}

