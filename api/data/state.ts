import { readJsonSafe, safeSupabaseCall } from "../_db/supabase.js";
import { listConnections } from "../channel-connections/manager.js";
import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace.js";
import { authErrorPayload, requireRequestContext } from "../_auth/session.js";
import { checkWorkspaceLimit } from "../billing/service.js";

type AnyRecord = Record<string, any>;

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toUiConnectionState(status: string, lastError?: string | null): "connected" | "error" | "needs_reauth" | "disabled" {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "disabled" || normalized === "disconnected") return "disabled";
  if (normalized === "needs_reauth") return "needs_reauth";
  if (normalized === "error" || (lastError && String(lastError).trim())) return "error";
  return "connected";
}

export default async function handler(req: any, res: any) {
  const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_state_${Date.now().toString(36)}`;
  let workspaceId = "";
  let userId = "";
  let role: "owner" | "admin" | "member" = "member";
  try {
    const authCtx = await requireRequestContext(req, "api/data/state");
    workspaceId = authCtx.workspaceId;
    userId = authCtx.userId;
    role = authCtx.role;
  } catch (error: any) {
    const failure = authErrorPayload(error, traceId);
    res.status(failure.status).json(failure.body);
    return;
  }

  if (req.method === "GET") {
    try {
      await ensureWorkspaceAccess({ workspaceId, userId, traceId });
      const connectionResp = await safeSupabaseCall(
        `channel_connections?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=*`,
        {},
        { traceId, context: "state_get_connections" }
      );
      const connectionRows = await readJsonSafe<AnyRecord[]>(connectionResp);
      const connections = Array.isArray(connectionRows) ? connectionRows : [];
      const telegramConnection = connections.find((item) => asString(item.channel) === "telegram") || null;
      const instagramConnection = connections.find((item) => asString(item.channel) === "instagram") || null;
      const vkConnection = connections.find((item) => asString(item.channel) === "vk") || null;
      const customWebhookConnection = connections.find((item) => asString(item.channel) === "custom_webhook") || null;
      const settings = (telegramConnection?.settings || {}) as AnyRecord;
      const connectedChannels = connections.filter((item) => asString(item.status, "active") !== "disconnected").map((item) => asString(item.channel));

      const channelConnectionManager = await listConnections({ workspaceId, userId });

      const serviceConnection = {
        serviceName: asString(telegramConnection?.display_name),
        endpoint: asString(telegramConnection?.endpoint_url),
        token: asString(telegramConnection?.access_token),
        botToken: asString(telegramConnection?.bot_token),
        autoReplyEnabled: settings.autoReplyEnabled !== false,
        connectedAt: telegramConnection?.connected_at || null,
        crmWebhookUrl: asString(settings?.crmWebhook?.targetUrl),
        crmWebhookAuthMode: asString(settings?.crmWebhook?.authMode, "bearer"),
        crmWebhookAuthHeader: asString(settings?.crmWebhook?.authHeaderName, "X-CRM-Auth"),
        crmWebhookToken: asString(settings?.crmWebhook?.authToken),
        crmWebhookEventTypes: Array.isArray(settings?.crmWebhook?.eventTypes) ? settings.crmWebhook.eventTypes : ["lead.qualified"],
        instagramAccountId: asString(instagramConnection?.settings?.custom?.instagramAccountId),
        instagramPageId: asString(instagramConnection?.settings?.custom?.instagramPageId),
        instagramAccessToken: asString(instagramConnection?.access_token || instagramConnection?.settings?.custom?.devAccessToken),
        instagramConnectedAt: instagramConnection?.connected_at || null,
        vkGroupId: asString(vkConnection?.settings?.custom?.vkGroupId),
        vkAccessToken: asString(vkConnection?.access_token || vkConnection?.settings?.custom?.devAccessToken),
        vkConnectedAt: vkConnection?.connected_at || null
      };

      res.status(200).json({
        serviceConnection,
        connectedChannels,
        channelConnectionStates: {
          telegram: toUiConnectionState(asString(telegramConnection?.status), asString(telegramConnection?.last_error) || null),
          instagram: toUiConnectionState(asString(instagramConnection?.status), asString(instagramConnection?.last_error) || null),
          vk: toUiConnectionState(asString(vkConnection?.status), asString(vkConnection?.last_error) || null),
          custom_webhook: toUiConnectionState(asString(customWebhookConnection?.status), asString(customWebhookConnection?.last_error) || null)
        },
        channelConnectionManager,
        telegramOffset: typeof settings.telegramOffset === "number" ? settings.telegramOffset : 0,
        telegramProfiles: settings.telegramProfiles && typeof settings.telegramProfiles === "object" ? settings.telegramProfiles : {},
        telegramErrorLogs: Array.isArray(settings.telegramErrorLogs) ? settings.telegramErrorLogs : [],
        newUserOnboarding: settings.newUserOnboarding || null,
        businessBrief: settings.businessBrief || null,
        businessTuning: settings.businessTuning || null,
        subscription: settings.subscription || null,
        bridgeMode: "preferences_and_connection_config_only",
        readModel: {
          sourceOfTruth: {
            businessData: "api/dashboard/read-model + api/analytics/metrics",
            bridge: "preferences_only"
          }
        }
      });
      return;
    } catch (error: any) {
      if (error?.code?.startsWith?.("workspace_")) {
        const failure = workspaceAccessErrorPayload(error, traceId);
        res.status(failure.status).json(failure.body);
        return;
      }
      res.status(500).json({ error: error?.message || "state_get_failed", traceId });
      return;
    }
  }

  if (req.method === "POST") {
    try {
      if (role === "member") {
        res.status(403).json({ error: "insufficient_role_for_settings_update", role, traceId });
        return;
      }
      await ensureWorkspaceAccess({ workspaceId, userId, traceId });
      const body = (req.body || {}) as AnyRecord;
      const replaceAll = body.replaceAll === true;
      const serviceConnection = (body.serviceConnection || {}) as AnyRecord;
      const instagramConnection = (body.instagramConnection || {}) as AnyRecord;
      const vkConnection = (body.vkConnection || {}) as AnyRecord;
      const existingConnectionsResp = await safeSupabaseCall(
        `channel_connections?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=channel,status`,
        {},
        { traceId, context: "state_post_existing_connections" }
      );
      const existingConnections = await readJsonSafe<Array<{ channel?: string; status?: string }>>(existingConnectionsResp);
      const activeChannels = new Set(
        (Array.isArray(existingConnections) ? existingConnections : [])
          .filter((row) => {
            const status = asString(row.status, "active").toLowerCase();
            return status !== "disabled" && status !== "disconnected";
          })
          .map((row) => asString(row.channel).toLowerCase())
          .filter(Boolean)
      );

      const intendedActiveChannels = new Set<string>(["telegram"]);
      const shouldEnableInstagram =
        asString(instagramConnection.instagramAccountId || serviceConnection.instagramAccountId).trim() ||
        asString(instagramConnection.instagramPageId || serviceConnection.instagramPageId).trim() ||
        asString(instagramConnection.accessToken || serviceConnection.instagramAccessToken).trim();
      if (shouldEnableInstagram) intendedActiveChannels.add("instagram");

      const shouldUpsertVk =
        asString(vkConnection.groupId || serviceConnection.vkGroupId).trim() || asString(vkConnection.accessToken || serviceConnection.vkAccessToken).trim();
      const vkStatus = asString(vkConnection.status, "active").toLowerCase();
      if (shouldUpsertVk && vkStatus !== "disabled" && vkStatus !== "disconnected") intendedActiveChannels.add("vk");

      const newActiveChannels = [...intendedActiveChannels].filter((channel) => !activeChannels.has(channel));
      if (newActiveChannels.length > 0) {
        const channelLimit = await checkWorkspaceLimit({
          workspaceId,
          userId,
          metric: "channels",
          increment: newActiveChannels.length
        });
        if (!channelLimit.allowed) {
          res.status(429).json({
            error: "channels_limit_exceeded",
            errorCode: "limit_exceeded_channels",
            metric: "channels",
            used: channelLimit.used,
            limit: channelLimit.limit,
            planId: channelLimit.planId,
            upgradeRequired: true,
            message: "Достигнут лимит каналов текущего тарифа."
          });
          return;
        }
      }

      const settingsBlob = {
        autoReplyEnabled: serviceConnection.autoReplyEnabled !== false,
        crmWebhook: {
          targetUrl: asString(serviceConnection.crmWebhookUrl),
          authMode: asString(serviceConnection.crmWebhookAuthMode, "bearer"),
          authHeaderName: asString(serviceConnection.crmWebhookAuthHeader, "X-CRM-Auth"),
          authToken: asString(serviceConnection.crmWebhookToken),
          eventTypes: Array.isArray(serviceConnection.crmWebhookEventTypes)
            ? serviceConnection.crmWebhookEventTypes.map((item: unknown) => String(item).trim()).filter(Boolean)
            : ["lead.qualified"]
        },
        telegramOffset: Number(body.telegramOffset || 0),
        telegramProfiles: body.telegramProfiles && typeof body.telegramProfiles === "object" ? body.telegramProfiles : {},
        telegramErrorLogs: Array.isArray(body.telegramErrorLogs) ? body.telegramErrorLogs.slice(0, 100) : [],
        newUserOnboarding: body.newUserOnboarding || null,
        businessBrief: body.businessBrief || null,
        businessTuning: body.businessTuning || null,
        subscription: body.subscription || null
      };

      await safeSupabaseCall(
        "channel_connections?on_conflict=workspace_id,user_id,channel",
        {
          method: "POST",
          body: JSON.stringify([
            {
              id: `cc_${workspaceId}_${userId}_telegram`,
              workspace_id: workspaceId,
              user_id: userId,
              channel: "telegram",
              channel_type: "messaging",
              display_name: asString(serviceConnection.serviceName),
              endpoint_url: asString(serviceConnection.endpoint),
              access_token: asString(serviceConnection.token),
              bot_token: asString(serviceConnection.botToken),
              status: "active",
              account_id: asString(serviceConnection.serviceName),
              page_id: "",
              business_id: asString(serviceConnection.serviceName),
              token_storage: asString(serviceConnection.token).trim() ? "plaintext" : "dev_placeholder",
              health_status: "unknown",
              last_error: null,
              settings: settingsBlob,
              connected_at: serviceConnection.connectedAt || null,
              updated_at: nowIso()
            }
          ])
        },
        { traceId, context: "state_post_upsert_telegram_connection" }
      );

      if (
        asString(instagramConnection.instagramAccountId || serviceConnection.instagramAccountId).trim() ||
        asString(instagramConnection.instagramPageId || serviceConnection.instagramPageId).trim() ||
        asString(instagramConnection.accessToken || serviceConnection.instagramAccessToken).trim()
      ) {
        const instagramAccountId = asString(instagramConnection.instagramAccountId || serviceConnection.instagramAccountId);
        const instagramPageId = asString(instagramConnection.instagramPageId || serviceConnection.instagramPageId);
        const instagramAccessToken = asString(instagramConnection.accessToken || serviceConnection.instagramAccessToken);
        await safeSupabaseCall(
          "channel_connections?on_conflict=workspace_id,user_id,channel",
          {
            method: "POST",
            body: JSON.stringify([
              {
                id: `cc_${workspaceId}_${userId}_instagram`,
                workspace_id: workspaceId,
                user_id: userId,
                channel: "instagram",
                channel_type: "messaging",
                display_name: "Instagram Direct",
                endpoint_url: "",
                access_token: instagramAccessToken,
                bot_token: "",
                status: "active",
                account_id: instagramAccountId,
                page_id: instagramPageId,
                business_id: instagramAccountId || instagramPageId,
                token_storage: instagramAccessToken ? "plaintext" : "dev_placeholder",
                health_status: "unknown",
                last_error: null,
                settings: {
                  custom: {
                    instagramAccountId,
                    instagramPageId,
                    ...(instagramAccessToken ? { devAccessToken: instagramAccessToken } : {})
                  }
                },
                connected_at: serviceConnection.instagramConnectedAt || nowIso(),
                updated_at: nowIso()
              }
            ])
          },
          { traceId, context: "state_post_upsert_instagram_connection" }
        );
      }

      if (shouldUpsertVk) {
        const vkGroupId = asString(vkConnection.groupId || serviceConnection.vkGroupId);
        const vkAccessToken = asString(vkConnection.accessToken || serviceConnection.vkAccessToken);
        const vkStatusRaw = asString(vkConnection.status, "active");
        await safeSupabaseCall(
          "channel_connections?on_conflict=workspace_id,user_id,channel",
          {
            method: "POST",
            body: JSON.stringify([
              {
                id: `cc_${workspaceId}_${userId}_vk`,
                workspace_id: workspaceId,
                user_id: userId,
                channel: "vk",
                channel_type: "messaging",
                display_name: "VK Messages",
                endpoint_url: "",
                access_token: vkAccessToken,
                bot_token: "",
                status: vkStatusRaw,
                account_id: vkGroupId,
                page_id: vkGroupId,
                business_id: vkGroupId,
                token_storage: vkAccessToken ? "plaintext" : "dev_placeholder",
                health_status: "unknown",
                last_error: null,
                settings: {
                  custom: {
                    vkGroupId,
                    ...(vkAccessToken ? { devAccessToken: vkAccessToken } : {})
                  }
                },
                connected_at: serviceConnection.vkConnectedAt || nowIso(),
                updated_at: nowIso()
              }
            ])
          },
          { traceId, context: "state_post_upsert_vk_connection" }
        );
      }

      res.status(200).json({
        ok: true,
        bridgeMode: "preferences_and_connection_config_only",
        replaceAllAccepted: false,
        warning: replaceAll ? "replaceAll_disabled_for_business_data" : undefined
      });
      return;
    } catch (error: any) {
      if (error?.code?.startsWith?.("workspace_")) {
        const failure = workspaceAccessErrorPayload(error, traceId);
        res.status(failure.status).json(failure.body);
        return;
      }
      res.status(500).json({ error: error?.message || "state_post_failed", traceId });
      return;
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
