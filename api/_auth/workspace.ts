import { readJsonSafe, safeSupabaseCall } from "../_db/supabase";

type WorkspaceRole = "owner" | "admin" | "member";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function log(traceId: string, level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
  const payload = { traceId, message, ...(extra || {}) };
  if (level === "error") {
    console.error("[workspace/auth]", payload);
    return;
  }
  if (level === "warn") {
    console.warn("[workspace/auth]", payload);
    return;
  }
  console.log("[workspace/auth]", payload);
}

class WorkspaceAccessError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 403, code = "workspace_access_denied") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function ensureWorkspaceExists(workspaceId: string, userId: string) {
  await safeSupabaseCall(
    "workspaces?on_conflict=id",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: workspaceId,
          name: workspaceId.startsWith("ws_") ? `Workspace ${workspaceId.slice(3)}` : `Workspace ${workspaceId}`,
          owner_user_id: userId,
          status: "active",
          created_at: nowIso(),
          updated_at: nowIso()
        }
      ])
    },
    { context: "workspace_auth_ensure_workspace_exists" }
  );
}

async function upsertMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  const safeId = `wm_${workspaceId}_${userId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
  await safeSupabaseCall(
    "workspace_members?on_conflict=workspace_id,user_id",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id: safeId,
          workspace_id: workspaceId,
          user_id: userId,
          role,
          status: "active",
          invited_by: null,
          joined_at: nowIso(),
          created_at: nowIso(),
          updated_at: nowIso()
        }
      ])
    },
    { context: "workspace_auth_upsert_member" }
  );
}

export async function ensureWorkspaceAccess(args: {
  workspaceId: string;
  userId: string;
  traceId: string;
  allowAutoprovision?: boolean;
  requiredRole?: WorkspaceRole;
}): Promise<{ workspaceId: string; userId: string; role: WorkspaceRole }> {
  const workspaceId = asString(args.workspaceId).trim();
  const userId = asString(args.userId).trim();
  if (!workspaceId || !userId) {
    throw new WorkspaceAccessError("workspaceId and userId are required", 400, "workspace_context_invalid");
  }

  const memberResp = await safeSupabaseCall(
    `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&select=role,status&limit=1`,
    {},
    { traceId: args.traceId, context: "workspace_auth_lookup_member" }
  );
  const memberRows = await readJsonSafe<Array<{ role?: string; status?: string }>>(memberResp);
  const member = Array.isArray(memberRows) ? memberRows[0] : null;
  if (member && asString(member.status, "active") === "active") {
    const role = (asString(member.role, "member") as WorkspaceRole) || "member";
    if (args.requiredRole) {
      const rank = { member: 1, admin: 2, owner: 3 };
      if (rank[role] < rank[args.requiredRole]) {
        throw new WorkspaceAccessError("insufficient_workspace_role", 403, "workspace_role_forbidden");
      }
    }
    return { workspaceId, userId, role };
  }

  const allowAutoprovision = args.allowAutoprovision !== false;
  if (!allowAutoprovision) {
    throw new WorkspaceAccessError("workspace membership not found", 403, "workspace_membership_missing");
  }

  await ensureWorkspaceExists(workspaceId, userId);
  await upsertMember(workspaceId, userId, "owner");
  log(args.traceId, "info", "workspace_autoprovisioned", { workspaceId, userId });
  return { workspaceId, userId, role: "owner" };
}

export function workspaceAccessErrorPayload(error: unknown, traceId: string) {
  const e = error as WorkspaceAccessError;
  if (typeof e?.status === "number" && typeof e?.code === "string") {
    return { status: e.status, body: { error: e.message, code: e.code, traceId } };
  }
  return { status: 500, body: { error: "workspace_access_failed", traceId } };
}
