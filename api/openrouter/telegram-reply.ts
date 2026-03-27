declare const process: { env: Record<string, string | undefined> };

import { runAiDecision } from "../ai/pipeline.js";
import type { AiHistoryItem } from "../ai/types.js";
import { resolveChannelCapabilities } from "../channel-connections/manager.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeHistory(value: unknown): AiHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = (item || {}) as Record<string, unknown>;
      const roleRaw = asString(row.role || "").toLowerCase();
      const role = roleRaw === "client" || roleRaw === "ai" || roleRaw === "manager" || roleRaw === "system" ? roleRaw : "client";
      const text = asString(row.text || "").trim();
      const at = asString(row.at || "").trim() || undefined;
      if (!text) return null;
      return { role, text, at } as AiHistoryItem;
    })
    .filter(Boolean) as AiHistoryItem[];
}

export default async function handler(req: any, res: any) {
  const traceId = asString(req.headers?.["x-trace-id"] || req.body?.traceId).trim() || `trace_${Date.now().toString(36)}`;
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed", traceId });
    return;
  }

  const userText = asString(req.body?.text || "").trim();
  const businessName = asString(req.body?.businessName || "ClientsFlow");
  const businessContext = asString(req.body?.businessContext || "").trim();
  if (!userText) {
    res.status(400).json({ error: "text is required", traceId });
    return;
  }

  try {
    const ctx = await requireRequestContext(req, "api/openrouter/telegram-reply");
    const decision = await runAiDecision({
      traceId,
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      conversationId: asString(req.body?.conversationId).trim() || "telegram_preview",
      leadId: asString(req.body?.leadId).trim() || undefined,
      channel: "telegram",
      channelCapabilities: resolveChannelCapabilities("telegram"),
      leadStage: asString(req.body?.leadStage).trim().toLowerCase() || "new",
      businessProfile: [businessName, businessContext].filter(Boolean).join(". "),
      lastUserMessage: userText,
      conversationHistory: normalizeHistory(req.body?.conversationHistory)
    });

    res.status(200).json({
      reply: decision.replyText,
      confidence: decision.confidence,
      nextAction: decision.nextAction,
      qualificationUpdate: decision.qualificationUpdate,
      followUpSuggestion: decision.followUpSuggestion,
      mode: decision.provider,
      model: decision.model
    });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_")) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    res.status(500).json({ error: error?.message || "telegram_reply_pipeline_failed", traceId });
  }
}
