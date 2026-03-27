import { readJsonSafe, supabaseRestOrThrow } from "../_db/supabase.js";
import { listConnections } from "../channel-connections/manager.js";
import { getBillingSummary } from "../billing/service.js";

type AnyRecord = Record<string, any>;

type UiChannel = "Telegram" | "WhatsApp" | "Instagram" | "Website";
type UiLeadStage = "новый" | "заинтересован" | "спросил цену" | "думает" | "записан" | "потерян";
type UiLeadStatus = UiLeadStage | "эскалация";
type UiBookingState = "не начата" | "в процессе" | "подтверждена" | "отменена";
type UiTimelineRole = "client" | "ai" | "manager";

type ConversationPreview = {
  id: string;
  client: string;
  channel: UiChannel;
  status: UiLeadStatus;
  summary: string;
  score: number;
  purchaseProbability: number;
  suggestedAction: string;
  lastActivity: string;
  intent: string;
  extractedFields: Array<{ label: string; value: string }>;
  notes: string;
  timeline: Array<{ role: UiTimelineRole; text: string; time: string }>;
};

type LeadCard = {
  id: string;
  name: string;
  business: string;
  stage: UiLeadStage;
  channel: UiChannel;
  score: number;
  estimatedRevenue: number;
  lastActivityLabel: string;
  lastActivityMinutes: number;
  bookingState: UiBookingState;
  tags: string[];
  owner: string;
};

type RecentMessage = {
  id: string;
  leadId: string;
  conversationId: string;
  client: string;
  channel: UiChannel;
  direction: "inbound" | "outbound";
  text: string;
  timestamp: string;
};

export type DashboardReadModel = {
  generatedAt: string;
  sourceOfTruth: {
    leads: "leads";
    conversations: "conversations";
    messages: "messages";
    channels: "channel_connections";
  };
  leads: LeadCard[];
  stageCounts: Record<UiLeadStage, number>;
  conversationPreviews: ConversationPreview[];
  recentMessages: RecentMessage[];
  connectedChannels: string[];
  connectionHealth: Array<{
    id: string;
    channel: string;
    status: string;
    healthStatus: string;
    capabilities: {
      supportsInbound: boolean;
      supportsOutbound: boolean;
      supportsAutoReply: boolean;
      supportsFollowUp: boolean;
      supportsCrmHandoffTrigger: boolean;
      supportsWebhookVerification: boolean;
      supportsHealthCheck: boolean;
    };
    lastSyncAt: string | null;
    lastError: string | null;
  }>;
  kpiSummary: {
    incomingLeads: number;
    qualifiedLeads: number;
    bookedLeads: number;
    lostLeads: number;
    inboundMessages: number;
    outboundMessages: number;
    connectedChannels: number;
    healthyChannels: number;
  };
  billingSummary: {
    plan: {
      id: string;
      title: string;
      description: string;
      priceMonthly: number;
      currency: string;
      isPlaceholder: boolean;
      limits: {
        leads: number | null;
        messages: number | null;
        channels: number | null;
      };
    };
    subscription: {
      id: string;
      status: string;
      provider: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
    };
    usage: {
      periodKey: string;
      leads: number;
      messages: number;
      channels: number;
      inboundMessages: number;
      aiReplies: number;
      followUpJobs: number;
      crmHandoffs: number;
    };
    limitFlags: {
      leadsNearLimit: boolean;
      messagesNearLimit: boolean;
      channelsNearLimit: boolean;
    };
    invoices: Array<{
      id: string;
      planId: string;
      amount: number;
      currency: string;
      status: string;
      createdAt: string;
      issuedAt: string;
      paidAt: string;
      periodStart: string;
      periodEnd: string;
      provider: string;
    }>;
  };
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toUiChannel(channel: string): UiChannel {
  const c = String(channel || "").toLowerCase();
  if (c === "telegram") return "Telegram";
  if (c === "whatsapp") return "WhatsApp";
  if (c === "instagram") return "Instagram";
  return "Website";
}

function toUiStage(stage: unknown): UiLeadStage {
  const s = String(stage || "").toLowerCase();
  if (s === "interested" || s === "заинтересован") return "заинтересован";
  if (s === "asked_price" || s === "спросил цену") return "спросил цену";
  if (s === "thinking" || s === "думает") return "думает";
  if (s === "booked" || s === "записан") return "записан";
  if (s === "lost" || s === "потерян") return "потерян";
  return "новый";
}

function bookingByStage(stage: UiLeadStage): UiBookingState {
  if (stage === "записан") return "подтверждена";
  if (stage === "потерян") return "отменена";
  if (stage === "новый") return "не начата";
  return "в процессе";
}

function scoreByStage(stage: UiLeadStage): number {
  if (stage === "записан") return 95;
  if (stage === "заинтересован") return 72;
  if (stage === "спросил цену") return 66;
  if (stage === "думает") return 61;
  if (stage === "потерян") return 28;
  return 45;
}

function probabilityByStage(stage: UiLeadStage): number {
  if (stage === "записан") return 96;
  if (stage === "заинтересован") return 64;
  if (stage === "спросил цену") return 57;
  if (stage === "думает") return 52;
  if (stage === "потерян") return 14;
  return 34;
}

function actionByStatus(status: UiLeadStatus): string {
  if (status === "новый") return "Уточнить задачу и предложить следующий шаг.";
  if (status === "заинтересован") return "Закрепить интерес и перейти к цене/условиям.";
  if (status === "спросил цену") return "Дать диапазон и предложить 2 слота.";
  if (status === "думает") return "Сделать follow-up и подтолкнуть к записи.";
  if (status === "потерян") return "Запустить recovery-касание.";
  if (status === "эскалация") return "Передать кейс менеджеру.";
  return "Подготовить следующий шаг по диалогу.";
}

function formatLastActivity(timestamp: string): { label: string; minutes: number } {
  const ms = new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return { label: "нет времени", minutes: Number.MAX_SAFE_INTEGER };
  const diffMin = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (diffMin < 1) return { label: "только что", minutes: 0 };
  if (diffMin < 60) return { label: `${diffMin} мин назад`, minutes: diffMin };
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  if (hours < 24) return { label: minutes > 0 ? `${hours} ч ${minutes} мин назад` : `${hours} ч назад`, minutes: diffMin };
  const days = Math.floor(hours / 24);
  return { label: `${days} дн назад`, minutes: diffMin };
}

function timelineRole(direction: string, metadata: AnyRecord): UiTimelineRole {
  if (direction === "inbound") return "client";
  if (asString(metadata?.source).includes("manager")) return "manager";
  return "ai";
}

async function fetchRows(path: string): Promise<AnyRecord[]> {
  const response = await supabaseRestOrThrow(path, {}, "dashboard_readmodel_fetch_rows");
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows : [];
}

export async function loadDashboardReadModel(workspaceId: string, userId: string): Promise<DashboardReadModel> {
  const [leadRows, conversationRows, messageRows, connections, billingSummary] = await Promise.all([
    fetchRows(
      `leads?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,name,channel,stage,estimated_revenue,lost_reason,updated_at,created_at&order=updated_at.desc&limit=2000`
    ),
    fetchRows(
      `conversations?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,lead_id,channel,status,last_message_at,updated_at,external_conversation_id,unread_count&order=updated_at.desc&limit=2000`
    ),
    fetchRows(
      `messages?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,lead_id,conversation_id,channel,direction,content,sent_at,metadata&order=sent_at.asc&limit=10000`
    ),
    listConnections({ workspaceId, userId }),
    getBillingSummary(workspaceId, userId)
  ]);

  const leadsById = new Map<string, AnyRecord>();
  for (const lead of leadRows) leadsById.set(asString(lead.id), lead);

  const messagesByConversation = new Map<string, AnyRecord[]>();
  const messagesByLead = new Map<string, AnyRecord[]>();
  for (const msg of messageRows) {
    const convId = asString(msg.conversation_id);
    const leadId = asString(msg.lead_id);
    if (convId) {
      if (!messagesByConversation.has(convId)) messagesByConversation.set(convId, []);
      messagesByConversation.get(convId)!.push(msg);
    }
    if (leadId) {
      if (!messagesByLead.has(leadId)) messagesByLead.set(leadId, []);
      messagesByLead.get(leadId)!.push(msg);
    }
  }

  const stageCounts: Record<UiLeadStage, number> = {
    новый: 0,
    заинтересован: 0,
    "спросил цену": 0,
    думает: 0,
    записан: 0,
    потерян: 0
  };

  const leadCards: LeadCard[] = leadRows.map((lead) => {
    const id = asString(lead.id);
    const stage = toUiStage(lead.stage);
    stageCounts[stage] += 1;
    const channel = toUiChannel(asString(lead.channel));
    const latestAt = asString(lead.updated_at || lead.created_at || new Date().toISOString());
    const activity = formatLastActivity(latestAt);
    const revenue = Number(lead.estimated_revenue || 0);
    return {
      id,
      name: asString(lead.name, "Клиент"),
      business: "Подключенный сервис",
      stage,
      channel,
      score: scoreByStage(stage),
      estimatedRevenue: Number.isFinite(revenue) ? Math.round(revenue) : 0,
      lastActivityLabel: activity.label,
      lastActivityMinutes: activity.minutes,
      bookingState: bookingByStage(stage),
      tags: [channel, stage],
      owner: "AI"
    };
  });

  const conversationPreviews: ConversationPreview[] = conversationRows.map((conv) => {
    const convId = asString(conv.id);
    const leadId = asString(conv.lead_id);
    const lead = leadsById.get(leadId) || {};
    const msgs = [...(messagesByConversation.get(convId) || [])].sort(
      (a, b) => new Date(asString(a.sent_at)).getTime() - new Date(asString(b.sent_at)).getTime()
    );
    const latest = msgs[msgs.length - 1] || null;
    const latestAt = asString(latest?.sent_at || conv.last_message_at || conv.updated_at || new Date().toISOString());
    const activity = formatLastActivity(latestAt);
    const stage = toUiStage(lead.stage);
    const status: UiLeadStatus = stage;
    const inboundFirst = msgs.find((m) => asString(m.direction) === "inbound");
    const summary = asString(latest?.content || "").trim().slice(0, 180) || "Диалог без сообщений";
    const timeline = msgs.slice(-6).map((m) => ({
      role: timelineRole(asString(m.direction), (m.metadata || {}) as AnyRecord),
      text: asString(m.content),
      time: new Date(asString(m.sent_at || new Date().toISOString())).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    }));
    return {
      id: leadId || convId,
      client: asString(lead.name, "Клиент"),
      channel: toUiChannel(asString(conv.channel || lead.channel)),
      status,
      summary,
      score: scoreByStage(stage),
      purchaseProbability: probabilityByStage(stage),
      suggestedAction: actionByStatus(status),
      lastActivity: activity.label,
      intent: asString(inboundFirst?.content, "Входящее обращение").slice(0, 100) || "Входящее обращение",
      extractedFields: [
        { label: "Lead ID", value: leadId || "—" },
        { label: "Канал", value: toUiChannel(asString(conv.channel || lead.channel)) },
        { label: "Сообщений", value: String(msgs.length) }
      ],
      notes: asString(lead.lost_reason, "Данные получены из БД."),
      timeline
    };
  });

  const recentMessages: RecentMessage[] = [...messageRows]
    .sort((a, b) => new Date(asString(b.sent_at)).getTime() - new Date(asString(a.sent_at)).getTime())
    .slice(0, 80)
    .map((msg) => {
      const lead = leadsById.get(asString(msg.lead_id)) || {};
      return {
        id: asString(msg.id),
        leadId: asString(msg.lead_id),
        conversationId: asString(msg.conversation_id),
        client: asString(lead.name, "Клиент"),
        channel: toUiChannel(asString(msg.channel)),
        direction: asString(msg.direction) === "outbound" ? "outbound" : "inbound",
        text: asString(msg.content),
        timestamp: asString(msg.sent_at)
      };
    });

  const inboundLeadIds = new Set(
    messageRows
      .filter((m) => asString(m.direction) === "inbound")
      .map((m) => asString(m.lead_id))
      .filter(Boolean)
  );
  const inboundMessages = messageRows.filter((m) => asString(m.direction) === "inbound").length;
  const outboundMessages = messageRows.filter((m) => asString(m.direction) === "outbound").length;

  let qualifiedLeads = 0;
  let bookedLeads = 0;
  let lostLeads = 0;
  for (const leadId of inboundLeadIds) {
    const lead = leadsById.get(leadId);
    if (!lead) continue;
    const stage = toUiStage(lead.stage);
    if (stage === "заинтересован" || stage === "спросил цену" || stage === "думает" || stage === "записан") qualifiedLeads += 1;
    if (stage === "записан") bookedLeads += 1;
    if (stage === "потерян") lostLeads += 1;
  }

  const connectedChannels = connections
    .filter((item) => item.status !== "disabled")
    .map((item) => String(item.channel));

  return {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: {
      leads: "leads",
      conversations: "conversations",
      messages: "messages",
      channels: "channel_connections"
    },
    leads: leadCards,
    stageCounts,
    conversationPreviews,
    recentMessages,
    connectedChannels,
    connectionHealth: connections.map((item) => ({
      id: item.id,
      channel: item.channel,
      status: item.status,
      healthStatus: item.healthStatus,
      capabilities: item.capabilities,
      lastSyncAt: item.lastSyncAt,
      lastError: item.lastError
    })),
    kpiSummary: {
      incomingLeads: inboundLeadIds.size,
      qualifiedLeads,
      bookedLeads,
      lostLeads,
      inboundMessages,
      outboundMessages,
      connectedChannels: connections.filter((item) => item.status !== "disabled").length,
      healthyChannels: connections.filter((item) => item.healthStatus === "healthy").length
    },
    billingSummary
  };
}
