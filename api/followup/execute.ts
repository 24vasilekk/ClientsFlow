import { executeFollowUpJob } from "./engine.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function makeTraceId(req: any): string {
  return asString(req.headers?.["x-trace-id"] || req.body?.traceId).trim() || `trace_fu_exec_${Date.now().toString(36)}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const traceId = makeTraceId(req);
  let workspaceId = "";
  let userId = "";
  try {
    const ctx = await requireRequestContext(req, "api/followup/execute");
    workspaceId = ctx.workspaceId;
    userId = ctx.userId;
  } catch (error: any) {
    const failure = authErrorPayload(error, traceId);
    res.status(failure.status).json(failure.body);
    return;
  }
  const jobId = asString(req.body?.jobId).trim();
  if (!jobId) {
    res.status(400).json({ error: "jobId is required", traceId });
    return;
  }

  const run = await executeFollowUpJob(jobId, traceId, { workspaceId, userId });
  res.status(200).json({ traceId, ...run });
}
