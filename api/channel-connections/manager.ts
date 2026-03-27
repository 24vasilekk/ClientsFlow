import { readJsonSafe, safeSupabaseCall } from "../_db/supabase";
import { checkWorkspaceLimit } from "../billing/service";

declare const process: { env: Record<string, string | undefined> };

type AnyRecord = Record<string, any>;

export type ChannelConnectionStatus =
  | "connected"
  | "connecting"
  | "validating"
  | "needs_reauth"
  | "error"
  | "disabled";

export type ChannelConnectionInput = {
  workspaceId: string;
  userId: string;
  channel: string;
  channelType?: string;
  displayName?: string;
  endpointUrl?: string;
  accessToken?: string;
  botToken?: string;
  accountId?: string;
  pageId?: string;
  businessId?: string;
  refreshMetadata?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  credentialsRef?: string;
};

export type ChannelConnectionView = {
  id: string;
  channel: string;
  channelType: string;
  status: ChannelConnectionStatus;
  healthStatus: "healthy" | "degraded" | "error" | "disabled" | "unknown";
  accountId: string;
  pageId: string;
  businessId: string;
  lastSyncAt: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  tokenStorage: "encrypted" | "dev_placeholder" | "plaintext";
  sync: {
    inbound24h: number;
    outbound24h: number;
    lastMessageAt: string | null;
  };
  capabilities: ChannelCapabilities;
  updatedAt: string | null;
};

export type ChannelCapabilities = {
  supportsInbound: boolean;
  supportsOutbound: boolean;
  supportsAutoReply: boolean;
  supportsFollowUp: boolean;
  supportsCrmHandoffTrigger: boolean;
  supportsWebhookVerification: boolean;
  supportsHealthCheck: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function requireContextIds(workspaceIdRaw: unknown, userIdRaw: unknown, source: string): { workspaceId: string; userId: string } {
  const workspaceId = asString(workspaceIdRaw).trim();
  const userId = asString(userIdRaw).trim();
  if (!workspaceId || !userId) throw new Error(`workspace_context_required:${source}`);
  return { workspaceId, userId };
}

function normalizeStatus(value: unknown, fallback: ChannelConnectionStatus = "connected"): ChannelConnectionStatus {
  const raw = asString(value).trim().toLowerCase();
  if (raw === "connected" || raw === "connecting" || raw === "validating" || raw === "needs_reauth" || raw === "error" || raw === "disabled") {
    return raw;
  }
  if (raw === "active") return "connected";
  if (raw === "disconnected") return "disabled";
  return fallback;
}

function toLegacyStatus(value: ChannelConnectionStatus): string {
  if (value === "connected") return "active";
  if (value === "disabled") return "disabled";
  return value;
}

function stableMask(token: string): string {
  if (!token) return "";
  if (token.length <= 6) return `${token.slice(0, 2)}***`;
  return `${token.slice(0, 3)}***${token.slice(-3)}`;
}

function xorCipher(input: string, key: string): string {
  if (!input || !key) return "";
  const chars: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    chars.push(String.fromCharCode(code));
  }
  return chars.join("");
}

function toBase64(value: string): string {
  if (typeof btoa === "function") return btoa(value);
  return value;
}

function fromBase64(value: string): string {
  if (typeof atob === "function") return atob(value);
  return value;
}

function encryptToken(token: string): { tokenStorage: "encrypted" | "dev_placeholder" | "plaintext"; encryptedAccessToken: string; plaintext: string } {
  const normalized = token.trim();
  if (!normalized) {
    return { tokenStorage: "dev_placeholder", encryptedAccessToken: "", plaintext: "" };
  }

  const secret = asString(process.env.CHANNEL_TOKEN_SECRET).trim();
  if (secret) {
    const cipher = xorCipher(normalized, secret);
    return {
      tokenStorage: "encrypted",
      encryptedAccessToken: toBase64(cipher),
      plaintext: ""
    };
  }

  const nodeEnv = asString(process.env.NODE_ENV).trim().toLowerCase();
  const allowPlainFromEnv = asString(process.env.CHANNEL_ALLOW_DEV_PLAINTEXT_TOKEN || "true").toLowerCase() !== "false";
  const allowPlain = nodeEnv === "production" ? false : allowPlainFromEnv;
  return {
    tokenStorage: allowPlain ? "plaintext" : "dev_placeholder",
    encryptedAccessToken: `dev:${stableMask(normalized)}`,
    plaintext: allowPlain ? normalized : ""
  };
}

function resolveToken(row: AnyRecord): string {
  const direct = asString(row.access_token).trim();
  if (direct) return direct;

  const encrypted = asString(row.encrypted_access_token || row?.settings?.auth?.encryptedAccessToken).trim();
  if (!encrypted) return "";
  if (encrypted.startsWith("dev:")) return "";

  const secret = asString(process.env.CHANNEL_TOKEN_SECRET).trim();
  if (!secret) return "";
  try {
    const decoded = fromBase64(encrypted);
    return xorCipher(decoded, secret);
  } catch {
    return "";
  }
}

async function findConnection(workspaceId: string, userId: string, channel: string): Promise<AnyRecord | null> {
  const response = await safeSupabaseCall(
    `channel_connections?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&channel=eq.${encodeURIComponent(channel)}&select=*`,
    {},
    { context: "channel_manager_find_connection" }
  );
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function findConnectionById(connectionId: string, scope?: { workspaceId?: string; userId?: string }): Promise<AnyRecord | null> {
  const { workspaceId, userId } = requireContextIds(scope?.workspaceId, scope?.userId, "channel-connections/manager:findConnectionById");
  const response = await safeSupabaseCall(
    `channel_connections?id=eq.${encodeURIComponent(connectionId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
    {},
    { context: "channel_manager_find_connection_by_id" }
  );
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function patchConnection(connectionId: string, patch: Record<string, unknown>, scope?: { workspaceId?: string; userId?: string }): Promise<void> {
  const { workspaceId, userId } = requireContextIds(scope?.workspaceId, scope?.userId, "channel-connections/manager:patchConnection");
  await safeSupabaseCall(
    `channel_connections?id=eq.${encodeURIComponent(connectionId)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ ...patch, updated_at: nowIso() })
    },
    { context: "channel_manager_patch_connection" }
  );
}

export async function upsertConnection(input: ChannelConnectionInput, forceStatus?: ChannelConnectionStatus): Promise<{ ok: true; connectionId: string }> {
  const channel = asString(input.channel).trim().toLowerCase();
  const { workspaceId, userId } = requireContextIds(input.workspaceId, input.userId, "channel-connections/manager:upsertConnection");
  const connectionId = `cc_${workspaceId}_${userId}_${channel}`;

  const encrypted = encryptToken(asString(input.accessToken));
  const botToken = asString(input.botToken).trim();
  const status = forceStatus || (asString(input.accessToken || input.botToken).trim() ? "connecting" : "disabled");

  const current = await findConnection(workspaceId, userId, channel);
  const currentSettings = current?.settings && typeof current.settings === "object" ? (current.settings as AnyRecord) : {};
  const mergedSettings = {
    ...currentSettings,
    ...(input.settings || {}),
    auth: {
      ...(currentSettings.auth && typeof currentSettings.auth === "object" ? currentSettings.auth : {}),
      tokenStorage: encrypted.tokenStorage,
      encryptedAccessToken: encrypted.encryptedAccessToken,
      devTokenMask: encrypted.tokenStorage !== "encrypted" ? stableMask(asString(input.accessToken)) : undefined,
      updatedAt: nowIso()
    }
  };

  await safeSupabaseCall(
    "channel_connections?on_conflict=workspace_id,user_id,channel",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: connectionId,
          workspace_id: workspaceId,
          user_id: userId,
          channel,
          channel_type: asString(input.channelType || "messaging"),
          status: toLegacyStatus(status),
          display_name: asString(input.displayName || current?.display_name || channel),
          endpoint_url: asString(input.endpointUrl || current?.endpoint_url),
          access_token: encrypted.plaintext || asString(current?.access_token),
          encrypted_access_token: encrypted.encryptedAccessToken || asString(current?.encrypted_access_token),
          token_storage: encrypted.tokenStorage,
          bot_token: botToken || asString(current?.bot_token),
          credentials_ref: asString(input.credentialsRef || current?.credentials_ref || ""),
          account_id: asString(input.accountId || current?.account_id),
          page_id: asString(input.pageId || current?.page_id),
          business_id: asString(input.businessId || current?.business_id),
          refresh_metadata: {
            ...(current?.refresh_metadata && typeof current.refresh_metadata === "object" ? current.refresh_metadata : {}),
            ...(input.refreshMetadata || {})
          },
          settings: mergedSettings,
          connected_at: status === "disabled" ? current?.connected_at || null : current?.connected_at || nowIso(),
          health_status: status === "disabled" ? "disabled" : asString(current?.health_status || "unknown"),
          last_error: status === "disabled" ? null : asString(current?.last_error || null),
          updated_at: nowIso()
        }
      ])
    },
    { context: "channel_manager_upsert_connection" }
  );

  return { ok: true, connectionId };
}

async function validateTelegram(token: string): Promise<{ ok: boolean; detail?: string }> {
  if (!token) return { ok: false, detail: "missing_bot_token" };
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { method: "GET" });
  const data = await response.json().catch(() => ({} as AnyRecord));
  if (!response.ok || data?.ok !== true) {
    return { ok: false, detail: asString(data?.description || `telegram_http_${response.status}`) };
  }
  return { ok: true, detail: asString(data?.result?.username || "telegram_ok") };
}

async function validateInstagram(token: string, pageId: string): Promise<{ ok: boolean; detail?: string }> {
  if (!token) return { ok: false, detail: "missing_access_token" };
  if (!pageId) return { ok: false, detail: "missing_page_id" };
  const response = await fetch(`https://graph.facebook.com/v20.0/${pageId}?fields=id,name&access_token=${encodeURIComponent(token)}`, {
    method: "GET"
  });
  const data = await response.json().catch(() => ({} as AnyRecord));
  if (!response.ok || data?.error) {
    return { ok: false, detail: asString(data?.error?.message || `instagram_http_${response.status}`) };
  }
  return { ok: true, detail: asString(data?.name || "instagram_ok") };
}

async function validateVk(token: string): Promise<{ ok: boolean; detail?: string }> {
  if (!token) return { ok: false, detail: "missing_access_token" };
  const response = await fetch(`https://api.vk.com/method/users.get?access_token=${encodeURIComponent(token)}&v=5.199`, { method: "GET" });
  const data = await response.json().catch(() => ({} as AnyRecord));
  if (!response.ok || data?.error) {
    return { ok: false, detail: asString(data?.error?.error_msg || `vk_http_${response.status}`) };
  }
  return { ok: true, detail: "vk_ok" };
}

async function validateCustomWebhook(connection: AnyRecord): Promise<{ ok: boolean; detail?: string }> {
  const settings = connection?.settings && typeof connection.settings === "object" ? (connection.settings as AnyRecord) : {};
  const custom = settings.customWebhook && typeof settings.customWebhook === "object" ? (settings.customWebhook as AnyRecord) : {};
  const authMode = asString(custom.authMode || "token").toLowerCase();
  const authToken = asString(custom.authToken || "");
  const replyMode = asString(custom.replyMode || "manual_only").toLowerCase();
  const callbackUrl = asString(custom.replyCallbackUrl || "").trim();

  if (authMode !== "none" && !authToken) {
    return { ok: false, detail: "custom_webhook_missing_auth_token" };
  }

  if (replyMode === "callback" && !callbackUrl) {
    return { ok: false, detail: "custom_webhook_missing_reply_callback_url" };
  }

  if (replyMode === "callback" && callbackUrl) {
    try {
      const response = await fetch(callbackUrl, { method: "OPTIONS" });
      if (!response.ok && response.status >= 500) {
        return { ok: false, detail: `custom_webhook_callback_unreachable_${response.status}` };
      }
    } catch {
      return { ok: false, detail: "custom_webhook_callback_network_error" };
    }
  }

  return { ok: true, detail: replyMode === "callback" ? "custom_webhook_callback_ready" : "custom_webhook_manual_only" };
}

export async function validateConnectionById(connectionId: string, scope?: { workspaceId?: string; userId?: string }): Promise<{
  ok: boolean;
  connectionId: string;
  status: ChannelConnectionStatus;
  healthStatus: ChannelConnectionView["healthStatus"];
  runStatus?: "ok" | "incomplete" | "not_supported";
  detail?: string;
}> {
  const connection = await findConnectionById(connectionId, scope);
  if (!connection) {
    return { ok: false, connectionId, status: "error", healthStatus: "error", detail: "connection_not_found" };
  }

  const status = normalizeStatus(connection.status);
  const capabilities = resolveChannelCapabilities(connection.channel, connection.settings);
  if (status === "disabled") {
    await patchConnection(connectionId, {
      health_status: "disabled",
      last_health_check_at: nowIso(),
      last_error: null
    }, { workspaceId: asString(connection.workspace_id), userId: asString(connection.user_id) });
    return { ok: true, connectionId, status: "disabled", healthStatus: "disabled" };
  }
  if (!capabilities.supportsHealthCheck) {
    return {
      ok: false,
      connectionId,
      status,
      healthStatus: toHealthStatus(asString(connection.status), asString(connection.health_status)),
      runStatus: "not_supported",
      detail: "health_check_not_supported_for_channel"
    };
  }

  await patchConnection(connectionId, { status: "validating", last_health_check_at: nowIso() }, { workspaceId: asString(connection.workspace_id), userId: asString(connection.user_id) });

  const channel = asString(connection.channel).toLowerCase();
  const token = resolveToken(connection) || asString(connection.bot_token);
  let result: { ok: boolean; detail?: string } = { ok: true, detail: "validated" };

  try {
    if (channel === "telegram") result = await validateTelegram(asString(connection.bot_token).trim() || token);
    else if (channel === "instagram") result = await validateInstagram(token, asString(connection.page_id || connection?.settings?.custom?.instagramPageId));
    else if (channel === "vk") result = await validateVk(token);
    else if (channel === "custom_webhook") result = await validateCustomWebhook(connection);
  } catch (error: any) {
    result = { ok: false, detail: asString(error?.message || "validation_failed") };
  }

  if (result.ok) {
    await patchConnection(connectionId, {
      status: "active",
      health_status: "healthy",
      last_sync_at: nowIso(),
      last_error: null,
      connected_at: connection.connected_at || nowIso(),
      last_health_check_at: nowIso()
    }, { workspaceId: asString(connection.workspace_id), userId: asString(connection.user_id) });
    return { ok: true, connectionId, status: "connected", healthStatus: "healthy", runStatus: "ok", detail: result.detail };
  }

  const needsReauth = /unauthorized|invalid|token|auth|expired/i.test(asString(result.detail));
  await patchConnection(connectionId, {
    status: needsReauth ? "needs_reauth" : "error",
    health_status: "error",
    last_error: asString(result.detail || "validation_failed"),
    last_health_check_at: nowIso()
  }, { workspaceId: asString(connection.workspace_id), userId: asString(connection.user_id) });

  return {
    ok: false,
    connectionId,
    status: needsReauth ? "needs_reauth" : "error",
    healthStatus: "error",
    runStatus: "incomplete",
    detail: result.detail
  };
}

export async function connectConnection(input: ChannelConnectionInput): Promise<{
  ok: boolean;
  connectionId: string;
  status: ChannelConnectionStatus;
  healthStatus: ChannelConnectionView["healthStatus"];
  detail?: string;
}> {
  const channel = asString(input.channel).trim().toLowerCase();
  const current = await findConnection(input.workspaceId, input.userId, channel);
  const currentStatus = normalizeStatus(current?.status, "disabled");
  if (!current || currentStatus === "disabled") {
    const limit = await checkWorkspaceLimit({
      workspaceId: asString(input.workspaceId),
      userId: asString(input.userId),
      metric: "channels",
      increment: 1
    });
    if (!limit.allowed) {
      return {
        ok: false,
        connectionId: current?.id ? asString(current.id) : "",
        status: "error",
        healthStatus: "error",
        detail: `${limit.reason || "limit_exceeded_channels"}:used=${limit.used}:limit=${limit.limit}`
      };
    }
  }
  const upsert = await upsertConnection(input, "connecting");
  const validated = await validateConnectionById(upsert.connectionId, { workspaceId: input.workspaceId, userId: input.userId });
  return validated;
}

export async function reconnectConnection(args: {
  connectionId?: string;
  workspaceId?: string;
  userId?: string;
  channel?: string;
  accessToken?: string;
  botToken?: string;
}): Promise<{ ok: boolean; connectionId: string; status: ChannelConnectionStatus; healthStatus: ChannelConnectionView["healthStatus"]; detail?: string }> {
  let connection: AnyRecord | null = null;
  if (args.connectionId) connection = await findConnectionById(args.connectionId, { workspaceId: args.workspaceId, userId: args.userId });
  if (!connection && args.workspaceId && args.userId && args.channel) {
    connection = await findConnection(args.workspaceId, args.userId, args.channel);
  }
  if (!connection) {
    return { ok: false, connectionId: asString(args.connectionId || ""), status: "error", healthStatus: "error", detail: "connection_not_found" };
  }

  await upsertConnection(
    {
      workspaceId: asString(connection.workspace_id),
      userId: asString(connection.user_id),
      channel: asString(connection.channel),
      channelType: asString(connection.channel_type || "messaging"),
      displayName: asString(connection.display_name),
      endpointUrl: asString(connection.endpoint_url),
      accessToken: asString(args.accessToken || "") || resolveToken(connection),
      botToken: asString(args.botToken || "") || asString(connection.bot_token),
      accountId: asString(connection.account_id),
      pageId: asString(connection.page_id),
      businessId: asString(connection.business_id),
      refreshMetadata: (connection.refresh_metadata || {}) as Record<string, unknown>,
      settings: (connection.settings || {}) as Record<string, unknown>,
      credentialsRef: asString(connection.credentials_ref)
    },
    "connecting"
  );

  return validateConnectionById(asString(connection.id), { workspaceId: asString(connection.workspace_id), userId: asString(connection.user_id) });
}

export async function disableConnection(args: {
  connectionId?: string;
  workspaceId?: string;
  userId?: string;
  channel?: string;
}): Promise<{ ok: boolean; connectionId: string }> {
  let connection: AnyRecord | null = null;
  if (args.connectionId) connection = await findConnectionById(args.connectionId, { workspaceId: args.workspaceId, userId: args.userId });
  if (!connection && args.workspaceId && args.userId && args.channel) {
    connection = await findConnection(args.workspaceId, args.userId, args.channel);
  }
  if (!connection) return { ok: false, connectionId: asString(args.connectionId || "") };

  await patchConnection(asString(connection.id), {
    status: "disabled",
    health_status: "disabled",
    last_error: null,
    last_health_check_at: nowIso()
  }, { workspaceId: asString(connection.workspace_id), userId: asString(connection.user_id) });

  return { ok: true, connectionId: asString(connection.id) };
}

export async function markConnectionSync(args: {
  connectionId: string;
  workspaceId: string;
  userId: string;
  ok: boolean;
  errorMessage?: string;
  detail?: string;
}) {
  await patchConnection(args.connectionId, {
    status: args.ok ? "active" : "error",
    health_status: args.ok ? "healthy" : "degraded",
    last_sync_at: nowIso(),
    last_error: args.ok ? null : asString(args.errorMessage || args.detail || "sync_failed"),
    last_health_check_at: nowIso()
  }, { workspaceId: args.workspaceId, userId: args.userId });
}

function toHealthStatus(status: string, health: string): ChannelConnectionView["healthStatus"] {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "disabled") return "disabled";
  const h = asString(health).toLowerCase();
  if (h === "healthy") return "healthy";
  if (h === "degraded") return "degraded";
  if (h === "error") return "error";
  if (normalizedStatus === "error" || normalizedStatus === "needs_reauth") return "error";
  return "unknown";
}

export function resolveChannelCapabilities(channelRaw: unknown, settingsRaw?: unknown): ChannelCapabilities {
  const channel = asString(channelRaw).trim().toLowerCase();
  const settings = settingsRaw && typeof settingsRaw === "object" ? (settingsRaw as AnyRecord) : {};
  const customWebhook = settings.customWebhook && typeof settings.customWebhook === "object" ? (settings.customWebhook as AnyRecord) : {};
  const customWebhookReplyMode = asString(customWebhook.replyMode || "manual_only").toLowerCase();
  const customWebhookSupportsOutbound = customWebhookReplyMode === "callback";

  if (channel === "telegram") {
    return {
      supportsInbound: true,
      supportsOutbound: true,
      supportsAutoReply: true,
      supportsFollowUp: true,
      supportsCrmHandoffTrigger: true,
      supportsWebhookVerification: false,
      supportsHealthCheck: true
    };
  }
  if (channel === "instagram") {
    return {
      supportsInbound: true,
      supportsOutbound: true,
      supportsAutoReply: true,
      supportsFollowUp: true,
      supportsCrmHandoffTrigger: true,
      supportsWebhookVerification: true,
      supportsHealthCheck: true
    };
  }
  if (channel === "vk") {
    return {
      supportsInbound: true,
      supportsOutbound: true,
      supportsAutoReply: true,
      supportsFollowUp: true,
      supportsCrmHandoffTrigger: true,
      supportsWebhookVerification: true,
      supportsHealthCheck: true
    };
  }
  if (channel === "custom_webhook") {
    return {
      supportsInbound: true,
      supportsOutbound: customWebhookSupportsOutbound,
      supportsAutoReply: customWebhookSupportsOutbound,
      supportsFollowUp: customWebhookSupportsOutbound,
      supportsCrmHandoffTrigger: true,
      supportsWebhookVerification: true,
      supportsHealthCheck: true
    };
  }
  return {
    supportsInbound: false,
    supportsOutbound: false,
    supportsAutoReply: false,
    supportsFollowUp: false,
    supportsCrmHandoffTrigger: false,
    supportsWebhookVerification: false,
    supportsHealthCheck: false
  };
}

export async function listConnections(args: {
  workspaceId: string;
  userId: string;
}): Promise<ChannelConnectionView[]> {
  const { workspaceId, userId } = requireContextIds(args.workspaceId, args.userId, "channel-connections/manager:listConnections");

  const [connections, messages] = await Promise.all([
    fetchRows(
      `channel_connections?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`
    ),
    fetchRows(
      `messages?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&sent_at=gte.${encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())}&select=channel,direction,sent_at&order=sent_at.desc&limit=5000`
    )
  ]);

  const stats = new Map<string, { inbound24h: number; outbound24h: number; lastMessageAt: string | null }>();
  for (const message of messages) {
    const channel = asString(message.channel).toLowerCase();
    if (!channel) continue;
    if (!stats.has(channel)) stats.set(channel, { inbound24h: 0, outbound24h: 0, lastMessageAt: null });
    const item = stats.get(channel)!;
    if (asString(message.direction) === "inbound") item.inbound24h += 1;
    if (asString(message.direction) === "outbound") item.outbound24h += 1;
    if (!item.lastMessageAt || asString(message.sent_at) > item.lastMessageAt) item.lastMessageAt = asString(message.sent_at);
  }

  return connections.map((row) => {
    const channel = asString(row.channel).toLowerCase();
    const sync = stats.get(channel) || { inbound24h: 0, outbound24h: 0, lastMessageAt: null };
    const tokenStorageRaw = asString(row.token_storage || row?.settings?.auth?.tokenStorage).toLowerCase();
    const tokenStorage: ChannelConnectionView["tokenStorage"] =
      tokenStorageRaw === "encrypted" ? "encrypted" : tokenStorageRaw === "plaintext" ? "plaintext" : "dev_placeholder";
    return {
      id: asString(row.id),
      channel,
      channelType: asString(row.channel_type || "messaging"),
      status: normalizeStatus(row.status),
      healthStatus: toHealthStatus(asString(row.status), asString(row.health_status)),
      accountId: asString(row.account_id),
      pageId: asString(row.page_id),
      businessId: asString(row.business_id),
      lastSyncAt: asString(row.last_sync_at) || null,
      lastHealthCheckAt: asString(row.last_health_check_at) || null,
      lastError: asString(row.last_error) || null,
      tokenStorage,
      sync,
      capabilities: resolveChannelCapabilities(channel, row.settings),
      updatedAt: asString(row.updated_at) || null
    };
  });
}

async function fetchRows(path: string): Promise<AnyRecord[]> {
  const response = await safeSupabaseCall(path, {}, { context: "channel_manager_fetch_rows" });
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows : [];
}
