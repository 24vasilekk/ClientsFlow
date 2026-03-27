declare const process: { env: Record<string, string | undefined> };

import { safeSupabaseCall } from "../_db/supabase.js";
import { createFallbackProvider } from "./providers/fallbackProvider.js";
import { createOpenRouterProvider } from "./providers/openrouterProvider.js";
import type { AiDecisionInput, AiDecisionOutput, AiDecisionProvider } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeInput(input: AiDecisionInput): AiDecisionInput {
  const history = Array.isArray(input.conversationHistory)
    ? input.conversationHistory
        .filter((item) => item && typeof item.text === "string" && item.text.trim())
        .map((item) => ({
          role: item.role === "client" || item.role === "ai" || item.role === "manager" || item.role === "system" ? item.role : "client",
          text: item.text.trim().slice(0, 1200),
          at: item.at
        }))
        .slice(-30)
    : [];

  return {
    ...input,
    workspaceId: String(input.workspaceId || "").trim(),
    userId: String(input.userId || "").trim(),
    conversationId: String(input.conversationId || "conversation_unknown").trim() || "conversation_unknown",
    leadId: String(input.leadId || "").trim() || undefined,
    channel: String(input.channel || "telegram").trim().toLowerCase() || "telegram",
    channelCapabilities:
      input.channelCapabilities && typeof input.channelCapabilities === "object"
        ? {
            supportsInbound: input.channelCapabilities.supportsInbound === true,
            supportsOutbound: input.channelCapabilities.supportsOutbound === true,
            supportsAutoReply: input.channelCapabilities.supportsAutoReply === true,
            supportsFollowUp: input.channelCapabilities.supportsFollowUp === true,
            supportsCrmHandoffTrigger: input.channelCapabilities.supportsCrmHandoffTrigger === true,
            supportsWebhookVerification: input.channelCapabilities.supportsWebhookVerification === true,
            supportsHealthCheck: input.channelCapabilities.supportsHealthCheck === true
          }
        : undefined,
    leadStage: String(input.leadStage || "new").trim().toLowerCase() || "new",
    businessProfile: String(input.businessProfile || "").trim().slice(0, 6000),
    lastUserMessage: String(input.lastUserMessage || "").trim().slice(0, 2000),
    conversationHistory: history
  };
}

function pickPrimaryProvider(): AiDecisionProvider {
  return process.env.OPENROUTER_API_KEY ? createOpenRouterProvider() : createFallbackProvider();
}

function withDefaults(result: AiDecisionOutput): AiDecisionOutput {
  const rawReply = String(result.replyText || "").trim();
  const shouldKeepEmptyReply = result.nextAction === "noop" || result.nextAction === "wait";
  return {
    ...result,
    replyText:
      rawReply || (shouldKeepEmptyReply ? "" : "Понял ваш запрос. Следующий шаг: уточните задачу в одном предложении, чтобы я предложил подходящий сценарий."),
    confidence: Number.isFinite(result.confidence) ? Math.max(0.1, Math.min(0.99, result.confidence)) : 0.55,
    nextAction: result.nextAction || "reply",
    qualificationUpdate: result.qualificationUpdate || null,
    followUpSuggestion: result.followUpSuggestion || null,
    attempts: Math.max(1, Number(result.attempts || 1)),
    latencyMs: Math.max(0, Number(result.latencyMs || 0))
  };
}

async function logDecision(args: {
  id: string;
  traceId: string;
  workspaceId: string;
  userId: string;
  conversationId: string;
  leadId?: string;
  channel: string;
  leadStage: string;
  provider: string;
  model: string;
  promptVersion: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown>;
  errorMessage?: string;
}) {
  try {
    await safeSupabaseCall("ai_decision_logs", {
      method: "POST",
      body: JSON.stringify([
        {
          id: args.id,
          trace_id: args.traceId,
          workspace_id: args.workspaceId,
          user_id: args.userId,
          conversation_id: args.conversationId,
          lead_id: args.leadId || null,
          channel: args.channel,
          lead_stage: args.leadStage,
          provider: args.provider,
          model: args.model,
          prompt_version: args.promptVersion,
          input_metadata: args.inputPayload,
          output_metadata: args.outputPayload,
          error_message: args.errorMessage || null,
          created_at: nowIso(),
          updated_at: nowIso()
        }
      ])
    }, { traceId: args.traceId, context: "ai_pipeline_log_decision" });
  } catch (error: any) {
    console.warn("[ai/pipeline] failed_to_log_decision", { traceId: args.traceId, message: error?.message || "unknown_error" });
  }
}

export async function runAiDecision(inputRaw: AiDecisionInput): Promise<AiDecisionOutput> {
  const input = normalizeInput(inputRaw);
  const traceId = String(input.traceId || `trace_${Date.now().toString(36)}`);
  const startedAt = Date.now();
  if (!input.workspaceId || !input.userId) {
    throw new Error("workspaceId and userId are required for ai decision pipeline");
  }
  if (input.channelCapabilities && !input.channelCapabilities.supportsAutoReply) {
    const decision = withDefaults({
      replyText: "",
      confidence: 0.99,
      nextAction: "noop",
      qualificationUpdate: null,
      followUpSuggestion: null,
      provider: "fallback",
      model: "capability-guard",
      attempts: 1,
      latencyMs: Date.now() - startedAt
    });
    await logDecision({
      id: `ai_dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      traceId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      conversationId: input.conversationId,
      leadId: input.leadId,
      channel: input.channel,
      leadStage: input.leadStage,
      provider: decision.provider,
      model: decision.model,
      promptVersion: "capability-guard-v1",
      inputPayload: {
        channelCapabilities: input.channelCapabilities
      },
      outputPayload: {
        nextAction: decision.nextAction,
        confidence: decision.confidence,
        reason: "auto_reply_not_supported_for_channel"
      },
      errorMessage: "auto_reply_not_supported_for_channel"
    });
    return decision;
  }

  const primary = pickPrimaryProvider();
  const fallback = createFallbackProvider();
  const logId = `ai_dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const primaryResult = await primary.decide(input);
    const decision = withDefaults({ ...primaryResult.decision, latencyMs: Date.now() - startedAt });

    await logDecision({
      id: logId,
      traceId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      conversationId: input.conversationId,
      leadId: input.leadId,
      channel: input.channel,
      leadStage: input.leadStage,
      provider: decision.provider,
      model: decision.model,
      promptVersion: primaryResult.promptMetadata.version,
      inputPayload: {
        historyCount: input.conversationHistory.length,
        historyChars: input.conversationHistory.map((item) => item.text).join("\n").length,
        lastMessageChars: input.lastUserMessage.length,
        businessProfileChars: input.businessProfile.length,
        tokensHint: primaryResult.promptMetadata.tokensHint || null
      },
      outputPayload: {
        nextAction: decision.nextAction,
        confidence: decision.confidence,
        qualificationUpdate: decision.qualificationUpdate,
        followUpSuggestion: decision.followUpSuggestion,
        attempts: decision.attempts,
        latencyMs: decision.latencyMs,
        rawOutputPreview: String(primaryResult.rawOutput || "").slice(0, 400)
      }
    });

    return decision;
  } catch (error: any) {
    const message = String(error?.message || "ai_decision_primary_failed");
    const fallbackResult = await fallback.decide(input);
    const decision = withDefaults({ ...fallbackResult.decision, latencyMs: Date.now() - startedAt, attempts: (fallbackResult.decision.attempts || 1) + 1 });

    await logDecision({
      id: logId,
      traceId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      conversationId: input.conversationId,
      leadId: input.leadId,
      channel: input.channel,
      leadStage: input.leadStage,
      provider: decision.provider,
      model: decision.model,
      promptVersion: fallbackResult.promptMetadata.version,
      inputPayload: {
        historyCount: input.conversationHistory.length,
        lastMessageChars: input.lastUserMessage.length,
        businessProfileChars: input.businessProfile.length
      },
      outputPayload: {
        nextAction: decision.nextAction,
        confidence: decision.confidence,
        qualificationUpdate: decision.qualificationUpdate,
        followUpSuggestion: decision.followUpSuggestion,
        attempts: decision.attempts,
        latencyMs: decision.latencyMs,
        fallbackReason: message
      },
      errorMessage: message
    });

    return decision;
  }
}
