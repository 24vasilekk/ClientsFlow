type NormalizedIncomingEvent = {
  id: string;
  channel: string;
  connectionId: string;
  externalEventId: string;
  externalMessageId: string;
  conversationExternalId: string;
  senderExternalId: string;
  senderName?: string;
  text: string;
  messageType: "text" | "image" | "audio" | "voice" | "file" | "system";
  systemEventType?: string;
  attachments: Array<{
    id: string;
    type: "image" | "audio" | "video" | "file";
    url?: string;
    mimeType?: string;
    name?: string;
    sizeBytes?: number;
  }>;
  timestamp: string;
};

function toIso(ts: unknown): string {
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const ms = ts > 10_000_000_000 ? ts : ts * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof ts === "string" && ts.trim()) {
    const parsed = new Date(ts).getTime();
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const str = String(value ?? "").trim();
    if (str) return str;
  }
  return "";
}

export function extractExternalEventId(channel: string, rawEvent: any): string {
  if (!rawEvent || typeof rawEvent !== "object") return "";
  if (channel === "telegram") {
    return firstNonEmpty(rawEvent.update_id, rawEvent.message?.message_id, rawEvent.edited_message?.message_id);
  }
  return firstNonEmpty(rawEvent.event_id, rawEvent.id, rawEvent.message_id, rawEvent.update_id);
}

function normalizeTelegram(rawEvent: any, connectionId: string): NormalizedIncomingEvent {
  const message = rawEvent?.message || rawEvent?.edited_message || null;
  const systemType = message ? "" : firstNonEmpty(rawEvent?.event_type, rawEvent?.type);
  const photo = Array.isArray(message?.photo) ? message.photo : [];
  const hasImage = photo.length > 0;
  const hasVoice = Boolean(message?.voice);
  const hasAudio = Boolean(message?.audio);
  const hasFile = Boolean(message?.document);

  const attachments: NormalizedIncomingEvent["attachments"] = [];
  if (hasImage) attachments.push({ id: firstNonEmpty(photo[0]?.file_id, "photo"), type: "image", mimeType: "image/jpeg" });
  if (hasVoice) attachments.push({ id: firstNonEmpty(message.voice?.file_id, "voice"), type: "audio", mimeType: asString(message.voice?.mime_type, "audio/ogg") });
  if (hasAudio) attachments.push({ id: firstNonEmpty(message.audio?.file_id, "audio"), type: "audio", mimeType: asString(message.audio?.mime_type) });
  if (hasFile) {
    attachments.push({
      id: firstNonEmpty(message.document?.file_id, "file"),
      type: "file",
      mimeType: asString(message.document?.mime_type),
      name: asString(message.document?.file_name)
    });
  }

  const messageType: NormalizedIncomingEvent["messageType"] = systemType
    ? "system"
    : hasImage
      ? "image"
      : hasVoice
        ? "voice"
        : hasAudio
          ? "audio"
          : hasFile
            ? "file"
            : "text";

  const externalEventId = firstNonEmpty(rawEvent?.update_id, message?.message_id, rawEvent?.id, Date.now());
  const externalMessageId = firstNonEmpty(message?.message_id, rawEvent?.update_id, rawEvent?.id);
  const conversationExternalId = firstNonEmpty(message?.chat?.id, rawEvent?.chat_id, rawEvent?.conversation_id);
  const senderExternalId = firstNonEmpty(message?.from?.id, rawEvent?.from?.id, rawEvent?.sender_id);

  return {
    id: `evt_telegram_${externalEventId}`,
    channel: "telegram",
    connectionId,
    externalEventId,
    externalMessageId,
    conversationExternalId,
    senderExternalId,
    senderName: firstNonEmpty(message?.from?.first_name, message?.from?.username, rawEvent?.sender_name),
    text: asString(message?.text || message?.caption || rawEvent?.text || ""),
    messageType,
    systemEventType: systemType || undefined,
    attachments,
    timestamp: toIso(message?.date || rawEvent?.timestamp || rawEvent?.date)
  };
}

function normalizeGeneric(channel: string, rawEvent: any, connectionId: string): NormalizedIncomingEvent {
  const guessedType = firstNonEmpty(rawEvent?.message_type, rawEvent?.type).toLowerCase();
  const type: NormalizedIncomingEvent["messageType"] =
    guessedType === "image"
      ? "image"
      : guessedType === "audio"
        ? "audio"
        : guessedType === "voice"
          ? "voice"
          : guessedType === "file" || guessedType === "document"
            ? "file"
            : guessedType === "system"
              ? "system"
              : "text";
  const externalEventId = firstNonEmpty(rawEvent?.event_id, rawEvent?.id, rawEvent?.message_id, Date.now());
  return {
    id: `evt_${channel}_${externalEventId}`,
    channel,
    connectionId,
    externalEventId,
    externalMessageId: firstNonEmpty(rawEvent?.message_id, rawEvent?.id, externalEventId),
    conversationExternalId: firstNonEmpty(rawEvent?.conversation_id, rawEvent?.thread_id, rawEvent?.chat_id, rawEvent?.from_id),
    senderExternalId: firstNonEmpty(rawEvent?.sender_id, rawEvent?.from_id, rawEvent?.from?.id),
    senderName: firstNonEmpty(rawEvent?.sender_name, rawEvent?.from?.name, rawEvent?.from?.username),
    text: asString(rawEvent?.text || rawEvent?.body || rawEvent?.caption || ""),
    messageType: type,
    systemEventType: type === "system" ? firstNonEmpty(rawEvent?.system_event_type, rawEvent?.event_type) : undefined,
    attachments: Array.isArray(rawEvent?.attachments) ? rawEvent.attachments : [],
    timestamp: toIso(rawEvent?.timestamp || rawEvent?.created_at || rawEvent?.date)
  };
}

function normalizeInstagram(rawEvent: any, connectionId: string): NormalizedIncomingEvent {
  const entry = Array.isArray(rawEvent?.entry) ? rawEvent.entry[0] : null;
  const messaging = Array.isArray(entry?.messaging) ? entry.messaging[0] : null;
  if (!messaging) return normalizeGeneric("instagram", rawEvent, connectionId);
  const message = messaging.message || {};
  const postback = messaging.postback || null;
  const attachments = Array.isArray(message.attachments)
    ? message.attachments.map((att: any, index: number) => ({
        id: `${message.mid || "msg"}:att:${index}`,
        type: att?.type === "image" ? "image" : att?.type === "audio" ? "audio" : "file",
        url: typeof att?.payload?.url === "string" ? att.payload.url : undefined
      }))
    : [];
  const messageType: NormalizedIncomingEvent["messageType"] = postback
    ? "system"
    : attachments.some((att) => att.type === "image")
      ? "image"
      : attachments.some((att) => att.type === "audio")
        ? "audio"
        : attachments.length > 0
          ? "file"
          : "text";

  const eventId = firstNonEmpty(message.mid, messaging?.timestamp, rawEvent?.id, Date.now());
  return {
    id: `evt_instagram_${eventId}`,
    channel: "instagram",
    connectionId,
    externalEventId: eventId,
    externalMessageId: firstNonEmpty(message.mid, eventId),
    conversationExternalId: firstNonEmpty(messaging?.sender?.id, messaging?.recipient?.id),
    senderExternalId: firstNonEmpty(messaging?.sender?.id),
    senderName: "Instagram user",
    text: asString(message.text || postback?.title || ""),
    messageType,
    systemEventType: postback ? "postback" : undefined,
    attachments,
    timestamp: toIso(messaging?.timestamp)
  };
}

function normalizeVk(rawEvent: any, connectionId: string): NormalizedIncomingEvent {
  const message = rawEvent?.object?.message || rawEvent?.message || {};
  const attachmentsRaw = Array.isArray(message?.attachments) ? message.attachments : [];
  const attachments = attachmentsRaw.map((att: any, index: number) => {
    if (att?.type === "photo") {
      const sizes = Array.isArray(att?.photo?.sizes) ? att.photo.sizes : [];
      const last = sizes[sizes.length - 1];
      return {
        id: `vk:${message.id || "msg"}:att:${index}`,
        type: "image" as const,
        url: typeof last?.url === "string" ? last.url : undefined
      };
    }
    if (att?.type === "audio_message") {
      return {
        id: `vk:${message.id || "msg"}:att:${index}`,
        type: "audio" as const,
        url: att?.audio_message?.link_mp3 || att?.audio_message?.link_ogg
      };
    }
    return {
      id: `vk:${message.id || "msg"}:att:${index}`,
      type: "file" as const,
      url: att?.doc?.url,
      name: att?.doc?.title
    };
  });
  const messageType: NormalizedIncomingEvent["messageType"] =
    attachments.some((att) => att.type === "image")
      ? "image"
      : attachments.some((att) => att.type === "audio")
        ? "voice"
        : attachments.length > 0
          ? "file"
          : "text";
  const externalId = firstNonEmpty(message?.id, rawEvent?.event_id, rawEvent?.id, Date.now());
  return {
    id: `evt_vk_${externalId}`,
    channel: "vk",
    connectionId,
    externalEventId: externalId,
    externalMessageId: firstNonEmpty(message?.id, externalId),
    conversationExternalId: firstNonEmpty(message?.peer_id, message?.from_id),
    senderExternalId: firstNonEmpty(message?.from_id),
    senderName: "VK user",
    text: asString(message?.text || ""),
    messageType,
    attachments,
    timestamp: toIso(message?.date)
  };
}

export function normalizeIncomingEvent(channel: string, rawEvent: any, connectionId: string): NormalizedIncomingEvent {
  if (channel === "telegram") return normalizeTelegram(rawEvent, connectionId);
  if (channel === "instagram") return normalizeInstagram(rawEvent, connectionId);
  if (channel === "vk") return normalizeVk(rawEvent, connectionId);
  return normalizeGeneric(channel, rawEvent, connectionId);
}

export type { NormalizedIncomingEvent };
