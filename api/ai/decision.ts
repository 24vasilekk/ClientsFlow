import { runAiDecision } from "./pipeline";
import type { AiDecisionInput, AiHistoryItem } from "./types";
import { resolveChannelCapabilities } from "../channel-connections/manager";
import { authErrorPayload, requireRequestContext } from "../_auth/session";

type AnyRecord = Record<string, any>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeHistory(value: unknown): AiHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = (item || {}) as AnyRecord;
      const roleRaw = asString(row.role || "").toLowerCase();
      const role = roleRaw === "client" || roleRaw === "ai" || roleRaw === "manager" || roleRaw === "system" ? roleRaw : "client";
      const text = asString(row.text).trim();
      const at = asString(row.at || "").trim() || undefined;
      if (!text) return null;
      return { role, text, at } as AiHistoryItem;
    })
    .filter(Boolean) as AiHistoryItem[];
}

function buildTraceId(req: any): string {
  const incoming = asString(req.headers?.["x-trace-id"] || req.body?.traceId).trim();
  return incoming || `trace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(req: any, res: any) {
  const traceId = buildTraceId(req);
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", traceId });
    return;
  }

  try {
    const body = (req.body || {}) as AnyRecord;
    const ctx = await requireRequestContext(req, "api/ai/decision");
    const channel = asString(body.channel).trim().toLowerCase() || "telegram";
    const input: AiDecisionInput = {
      traceId,
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      conversationId: asString(body.conversationId).trim() || "conversation_unknown",
      leadId: asString(body.leadId).trim() || undefined,
      channel,
      channelCapabilities: resolveChannelCapabilities(channel),
      leadStage: asString(body.leadStage).trim().toLowerCase() || "new",
      businessProfile: asString(body.businessProfile).trim(),
      lastUserMessage: asString(body.lastUserMessage).trim(),
      conversationHistory: normalizeHistory(body.conversationHistory)
    };

    if (!input.lastUserMessage) {
      res.status(400).json({ error: "lastUserMessage is required", traceId: input.traceId });
      return;
    }

    const decision = await runAiDecision(input);
    res.status(200).json({ traceId: input.traceId, ...decision });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_")) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    res.status(500).json({ error: error?.message || "ai_decision_failed", traceId });
  }
}
