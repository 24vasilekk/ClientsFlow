export type AiHistoryRole = "client" | "ai" | "manager" | "system";

export type AiHistoryItem = {
  role: AiHistoryRole;
  text: string;
  at?: string;
};

export type QualificationUpdate = {
  stage: "new" | "interested" | "asked_price" | "thinking" | "booked" | "lost";
  reason: string;
};

export type FollowUpSuggestion = {
  shouldSchedule: boolean;
  triggerType?: "no_response_timeout" | "price_ghost" | "not_booked_stalled";
  delayHours?: number;
  reason?: string;
};

export type AiNextAction = "reply" | "ask_clarification" | "escalate_manager" | "book" | "wait" | "noop";

export type AiDecisionInput = {
  traceId: string;
  workspaceId: string;
  userId: string;
  conversationId: string;
  leadId?: string;
  channel: string;
  channelCapabilities?: {
    supportsInbound: boolean;
    supportsOutbound: boolean;
    supportsAutoReply: boolean;
    supportsFollowUp: boolean;
    supportsCrmHandoffTrigger: boolean;
    supportsWebhookVerification: boolean;
    supportsHealthCheck: boolean;
  };
  leadStage: string;
  businessProfile: string;
  lastUserMessage: string;
  conversationHistory: AiHistoryItem[];
};

export type AiDecisionOutput = {
  replyText: string;
  confidence: number;
  nextAction: AiNextAction;
  qualificationUpdate: QualificationUpdate | null;
  followUpSuggestion: FollowUpSuggestion | null;
  provider: "openrouter" | "fallback";
  model: string;
  attempts: number;
  latencyMs: number;
};

export type AiDecisionResult = {
  decision: AiDecisionOutput;
  promptMetadata: {
    version: string;
    model: string;
    provider: "openrouter" | "fallback";
    tokensHint?: { historyChars: number; inputChars: number };
  };
  rawOutput?: string;
};

export type AiDecisionProvider = {
  name: "openrouter" | "fallback";
  decide: (input: AiDecisionInput) => Promise<AiDecisionResult>;
};
