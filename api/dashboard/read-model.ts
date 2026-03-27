import { loadDashboardReadModel } from "./readModelQueries";
import { ensureWorkspaceAccess, workspaceAccessErrorPayload } from "../_auth/workspace";
import { authErrorPayload, requireRequestContext } from "../_auth/session";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_dashboard_read_model_${Date.now().toString(36)}`;

  try {
    const authCtx = await requireRequestContext(req, "api/dashboard/read-model");
    const workspaceId = authCtx.workspaceId;
    const userId = authCtx.userId;
    await ensureWorkspaceAccess({ workspaceId, userId, traceId });
    const readModel = await loadDashboardReadModel(workspaceId, userId);
    res.status(200).json({
      ...readModel,
      runtimeStatus: "ok",
      traceId
    });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_")) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    if (error?.code?.startsWith?.("workspace_")) {
      const failure = workspaceAccessErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    res.status(500).json({
      error: error?.message || "dashboard_read_model_failed",
      traceId,
      runtimeStatus: "degraded",
      generatedAt: new Date().toISOString(),
      sourceOfTruth: {
        leads: "leads",
        conversations: "conversations",
        messages: "messages",
        channels: "channel_connections"
      },
      leads: [],
      stageCounts: { новый: 0, заинтересован: 0, "спросил цену": 0, думает: 0, записан: 0, потерян: 0 },
      conversationPreviews: [],
      recentMessages: [],
      connectedChannels: [],
      connectionHealth: [],
      kpiSummary: {
        incomingLeads: 0,
        qualifiedLeads: 0,
        bookedLeads: 0,
        lostLeads: 0,
        inboundMessages: 0,
        outboundMessages: 0,
        connectedChannels: 0,
        healthyChannels: 0
      },
      billingSummary: {
        plan: {
          id: "free",
          title: "Free",
          description: "Fallback plan",
          priceMonthly: 0,
          currency: "RUB",
          isPlaceholder: false,
          limits: {
            leads: 100,
            messages: 1000,
            channels: 1
          }
        },
        subscription: {
          id: "",
          status: "active",
          provider: "mock",
          currentPeriodStart: "",
          currentPeriodEnd: ""
        },
        usage: {
          periodKey: "",
          leads: 0,
          messages: 0,
          channels: 0,
          inboundMessages: 0,
          aiReplies: 0,
          followUpJobs: 0,
          crmHandoffs: 0
        },
        limitFlags: {
          leadsNearLimit: false,
          messagesNearLimit: false,
          channelsNearLimit: false
        },
        invoices: []
      }
    });
  }
}
