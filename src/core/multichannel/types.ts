export type KnownChannel = "telegram" | "instagram" | "whatsapp" | "vk" | "email" | "custom_webhook";
export type ChannelType = KnownChannel | (string & {});

export type LeadStage =
  | "new"
  | "interested"
  | "asked_price"
  | "thinking"
  | "booked"
  | "lost";

export type EventType =
  | "message_incoming"
  | "message_outgoing"
  | "lead_stage_changed"
  | "lead_qualified"
  | "follow_up_sent"
  | "delivery_failed"
  | "system_error";

export type MessageAttachment = {
  id: string;
  type: "image" | "audio" | "video" | "file";
  url?: string;
  mimeType?: string;
  name?: string;
  sizeBytes?: number;
};

export type IncomingMessage = {
  id: string;
  channel: ChannelType;
  connectionId: string;
  externalMessageId: string;
  externalEventId?: string;
  conversationExternalId: string;
  senderExternalId: string;
  senderName?: string;
  text: string;
  messageType?: "text" | "image" | "audio" | "voice" | "file" | "system";
  systemEventType?: string;
  attachments?: MessageAttachment[];
  timestamp: string;
  raw?: unknown;
};

export type OutgoingMessage = {
  id: string;
  channel: ChannelType;
  connectionId: string;
  conversationExternalId: string;
  recipientExternalId: string;
  text: string;
  attachments?: MessageAttachment[];
  replyToExternalMessageId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type Conversation = {
  id: string;
  workspaceId: string;
  channel: ChannelType;
  connectionId: string;
  externalConversationId: string;
  leadId: string;
  status: "active" | "waiting_client" | "waiting_manager" | "closed";
  lastMessageAt: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  unreadCount: number;
  assignedTo?: string;
  tags: string[];
};

export type Lead = {
  id: string;
  workspaceId: string;
  conversationId: string;
  channel: ChannelType;
  externalLeadId?: string;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  stage: LeadStage;
  score?: number;
  estimatedRevenue?: number;
  lostReason?: string;
  sourceLabel?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChannelConnection = {
  id: string;
  workspaceId: string;
  channel: ChannelType;
  status: "active" | "paused" | "error" | "disconnected";
  displayName: string;
  credentialsRef: string;
  settings: {
    webhookSecret?: string;
    defaultReplyEnabled?: boolean;
    timezone?: string;
    locale?: string;
    custom?: Record<string, string | number | boolean>;
  };
  createdAt: string;
  updatedAt: string;
  lastHealthCheckAt?: string;
  lastError?: string;
};

export type ChannelEvent = {
  id: string;
  workspaceId: string;
  channel: ChannelType;
  connectionId: string;
  conversationId?: string;
  leadId?: string;
  type: EventType;
  payload: Record<string, unknown>;
  timestamp: string;
};

export type DeliveryResult = {
  ok: boolean;
  externalMessageId?: string;
  providerStatus?: string;
  errorCode?: string;
  errorMessage?: string;
};

export type AdapterContext = {
  nowIso: () => string;
  log: (level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => void;
};
