import { authErrorPayload, requireRequestContext } from "../_auth/session.js";
import { readJsonSafe, supabaseRestOrThrow } from "../_db/supabase.js";

declare const process: { env: Record<string, string | undefined> };

type AnyRecord = Record<string, any>;
type WorkspaceRole = "owner" | "admin" | "member";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRole(value: unknown, fallback: WorkspaceRole = "member"): WorkspaceRole {
  const role = asString(value).trim().toLowerCase();
  if (role === "owner" || role === "admin" || role === "member") return role;
  return fallback;
}

function roleRank(role: WorkspaceRole): number {
  if (role === "owner") return 3;
  if (role === "admin") return 2;
  return 1;
}

function canInvite(actorRole: WorkspaceRole, inviteRole: WorkspaceRole): boolean {
  if (actorRole === "owner") return inviteRole === "admin" || inviteRole === "member";
  if (actorRole === "admin") return inviteRole === "member";
  return false;
}

function canRemove(actorRole: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (actorRole === "owner") return targetRole !== "owner";
  if (actorRole === "admin") return targetRole === "member";
  return false;
}

function canChangeRole(actorRole: WorkspaceRole, currentRole: WorkspaceRole, nextRole: WorkspaceRole): boolean {
  if (nextRole === "owner" || currentRole === "owner") return false;
  if (actorRole === "owner") return true;
  return false;
}

function validEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

function buildInviteToken(): string {
  const random = Math.random().toString(36).slice(2);
  return `inv_${Date.now().toString(36)}_${random}`;
}

function buildInviteUrl(req: any, token: string): string {
  const base =
    asString(process.env.APP_BASE_URL).trim() ||
    (req?.headers?.host ? `${asString(req.headers["x-forwarded-proto"] || "https")}://${asString(req.headers.host)}` : "");
  if (!base) return "";
  const normalized = base.replace(/\/+$/, "");
  return `${normalized}/login?invite=${encodeURIComponent(token)}`;
}

async function fetchWorkspaceMembers(workspaceId: string): Promise<AnyRecord[]> {
  const response = await supabaseRestOrThrow(
    `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,user_id,role,status,joined_at,updated_at&order=joined_at.asc`,
    {},
    "workspace_team_fetch_members"
  );
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows : [];
}

async function fetchPendingInvites(workspaceId: string): Promise<AnyRecord[]> {
  const response = await supabaseRestOrThrow(
    `workspace_invites?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=eq.pending&select=id,email,role,status,invite_token,invited_by_user_id,expires_at,created_at,updated_at&order=created_at.desc`,
    {},
    "workspace_team_fetch_invites"
  );
  const rows = await readJsonSafe<AnyRecord[]>(response);
  return Array.isArray(rows) ? rows : [];
}

async function findAuthUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const baseUrl = asString(process.env.SUPABASE_URL).trim().replace(/\/+$/, "");
  const serviceKey = asString(process.env.SUPABASE_SERVICE_ROLE_KEY).trim();
  if (!baseUrl || !serviceKey) return null;
  const response = await fetch(`${baseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    method: "GET",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({} as AnyRecord));
  const users = Array.isArray(payload?.users) ? payload.users : [];
  const user = users.find((item: AnyRecord) => asString(item?.email).toLowerCase() === email.toLowerCase());
  if (!user) return null;
  const id = asString(user.id).trim();
  const normalizedEmail = asString(user.email).trim().toLowerCase();
  if (!id || !normalizedEmail) return null;
  return { id, email: normalizedEmail };
}

async function upsertWorkspaceMember(args: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: "active" | "disabled";
  invitedBy?: string | null;
}) {
  const id = `wm_${args.workspaceId}_${args.userId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
  await supabaseRestOrThrow(
    "workspace_members?on_conflict=workspace_id,user_id",
    {
      method: "POST",
      body: JSON.stringify([
        {
          id,
          workspace_id: args.workspaceId,
          user_id: args.userId,
          role: args.role,
          status: args.status,
          invited_by: args.invitedBy || null,
          joined_at: nowIso(),
          created_at: nowIso(),
          updated_at: nowIso()
        }
      ])
    },
    "workspace_team_upsert_member"
  );
}

async function getMemberRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
  const response = await supabaseRestOrThrow(
    `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=role&limit=1`,
    {},
    "workspace_team_get_member_role"
  );
  const rows = await readJsonSafe<Array<{ role?: string }>>(response);
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? normalizeRole(row.role, "member") : null;
}

async function loadTeamPayload(workspaceId: string, currentUserId: string, currentUserRole: WorkspaceRole, req: any) {
  const [members, invites] = await Promise.all([fetchWorkspaceMembers(workspaceId), fetchPendingInvites(workspaceId)]);
  return {
    workspaceId,
    currentUserRole,
    members: members.map((row) => ({
      id: asString(row.id),
      userId: asString(row.user_id),
      role: normalizeRole(row.role, "member"),
      status: asString(row.status || "active"),
      joinedAt: asString(row.joined_at || ""),
      updatedAt: asString(row.updated_at || ""),
      isCurrentUser: asString(row.user_id) === currentUserId
    })),
    invites: invites.map((row) => {
      const token = asString(row.invite_token);
      return {
        id: asString(row.id),
        email: asString(row.email).toLowerCase(),
        role: normalizeRole(row.role, "member"),
        status: asString(row.status || "pending"),
        invitedByUserId: asString(row.invited_by_user_id || ""),
        expiresAt: asString(row.expires_at || ""),
        createdAt: asString(row.created_at || ""),
        updatedAt: asString(row.updated_at || ""),
        inviteUrl: buildInviteUrl(req, token),
        inviteToken: token
      };
    })
  };
}

export default async function handler(req: any, res: any) {
  const traceId = asString(req.headers?.["x-trace-id"]).trim() || `trace_workspace_team_${Date.now().toString(36)}`;
  try {
    const ctx = await requireRequestContext(req, "api/workspace/team");
    const workspaceId = ctx.workspaceId;
    const userId = ctx.userId;
    const actorRole = ctx.role;

    if (req.method === "GET") {
      const payload = await loadTeamPayload(workspaceId, userId, actorRole, req);
      res.status(200).json({ ok: true, ...payload, traceId });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed", traceId });
      return;
    }

    const body = (req.body || {}) as AnyRecord;
    const action = asString(body.action).trim().toLowerCase();

    if (action === "invite_user") {
      const email = asString(body.email).trim().toLowerCase();
      const inviteRole = normalizeRole(body.role, "member");
      if (!validEmail(email)) {
        res.status(400).json({ ok: false, error: "invalid_email", traceId });
        return;
      }
      if (!canInvite(actorRole, inviteRole)) {
        res.status(403).json({ ok: false, error: "insufficient_role_for_invite", traceId });
        return;
      }

      const existingUser = await findAuthUserByEmail(email);
      if (existingUser) {
        const existingRole = await getMemberRole(workspaceId, existingUser.id);
        if (existingRole) {
          res.status(409).json({ ok: false, error: "user_already_member", traceId });
          return;
        }
        await upsertWorkspaceMember({
          workspaceId,
          userId: existingUser.id,
          role: inviteRole,
          status: "active",
          invitedBy: userId
        });
        const payload = await loadTeamPayload(workspaceId, userId, actorRole, req);
        res.status(200).json({
          ok: true,
          status: "member_added",
          message: "Пользователь уже зарегистрирован и добавлен в workspace.",
          ...payload,
          traceId
        });
        return;
      }

      const token = buildInviteToken();
      const inviteId = `wsi_${Math.random().toString(36).slice(2, 12)}_${Date.now().toString(36)}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await supabaseRestOrThrow(
        "workspace_invites",
        {
          method: "POST",
          body: JSON.stringify([
            {
              id: inviteId,
              workspace_id: workspaceId,
              email,
              role: inviteRole,
              status: "pending",
              invite_token: token,
              invited_by_user_id: userId,
              accepted_by_user_id: null,
              expires_at: expiresAt,
              accepted_at: null,
              canceled_at: null,
              created_at: nowIso(),
              updated_at: nowIso()
            }
          ])
        },
        "workspace_team_insert_invite"
      );

      const payload = await loadTeamPayload(workspaceId, userId, actorRole, req);
      res.status(200).json({
        ok: true,
        status: "invited",
        inviteUrl: buildInviteUrl(req, token),
        inviteToken: token,
        ...payload,
        traceId
      });
      return;
    }

    if (action === "remove_user") {
      const targetUserId = asString(body.targetUserId).trim();
      if (!targetUserId) {
        res.status(400).json({ ok: false, error: "targetUserId_required", traceId });
        return;
      }
      const targetRole = await getMemberRole(workspaceId, targetUserId);
      if (!targetRole) {
        res.status(404).json({ ok: false, error: "member_not_found", traceId });
        return;
      }
      if (targetUserId === userId) {
        res.status(400).json({ ok: false, error: "cannot_remove_self", traceId });
        return;
      }
      if (!canRemove(actorRole, targetRole)) {
        res.status(403).json({ ok: false, error: "insufficient_role_for_remove", traceId });
        return;
      }
      await supabaseRestOrThrow(
        `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(targetUserId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "disabled",
            updated_at: nowIso()
          })
        },
        "workspace_team_remove_member"
      );
      const payload = await loadTeamPayload(workspaceId, userId, actorRole, req);
      res.status(200).json({ ok: true, status: "removed", ...payload, traceId });
      return;
    }

    if (action === "change_role") {
      const targetUserId = asString(body.targetUserId).trim();
      const nextRole = normalizeRole(body.nextRole, "member");
      if (!targetUserId) {
        res.status(400).json({ ok: false, error: "targetUserId_required", traceId });
        return;
      }
      const currentRole = await getMemberRole(workspaceId, targetUserId);
      if (!currentRole) {
        res.status(404).json({ ok: false, error: "member_not_found", traceId });
        return;
      }
      if (targetUserId === userId) {
        res.status(400).json({ ok: false, error: "cannot_change_own_role", traceId });
        return;
      }
      if (!canChangeRole(actorRole, currentRole, nextRole)) {
        res.status(403).json({ ok: false, error: "insufficient_role_for_change_role", traceId });
        return;
      }
      await supabaseRestOrThrow(
        `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(targetUserId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: nextRole,
            updated_at: nowIso()
          })
        },
        "workspace_team_change_role"
      );
      const payload = await loadTeamPayload(workspaceId, userId, actorRole, req);
      res.status(200).json({ ok: true, status: "role_changed", ...payload, traceId });
      return;
    }

    res.status(400).json({
      ok: false,
      error: "unsupported_action",
      supported: ["invite_user", "remove_user", "change_role"],
      traceId
    });
  } catch (error: any) {
    if (error?.code?.startsWith?.("auth_") || error?.code?.startsWith?.("workspace_")) {
      const failure = authErrorPayload(error, traceId);
      res.status(failure.status).json(failure.body);
      return;
    }
    res.status(500).json({ ok: false, error: error?.message || "workspace_team_failed", traceId });
  }
}

