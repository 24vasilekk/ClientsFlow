import { authErrorPayload, requireRequestContext } from "../_auth/session";
import teamHandler from "./team";

function buildTraceId(req: any): string {
  return String(req?.headers?.["x-trace-id"] || req?.body?.traceId || `trace_workspace_role_${Date.now().toString(36)}`);
}

export default async function handler(req: any, res: any) {
  const traceId = buildTraceId(req);
  try {
    await requireRequestContext(req, "api/workspace/change-role");
  } catch (error: any) {
    const failure = authErrorPayload(error, traceId);
    res.status(failure.status).json(failure.body);
    return;
  }
  req.method = "POST";
  req.body = { ...(req.body || {}), action: "change_role" };
  return teamHandler(req, res);
}
