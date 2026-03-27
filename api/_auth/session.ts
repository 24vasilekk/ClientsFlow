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

function supabaseBaseUrl(): string {
  const raw = asString(process.env.SUPABASE_URL).trim().replace(/\/+$/, "");
  if (!raw) throw new Error("SUPABASE_URL is not set");
  return raw;
}

function supabaseAnonKey(): string {
  const anon = asString(process.env.SUPABASE_ANON_KEY).trim();
  if (anon) return anon;
  const fallback = asString(process.env.SUPABASE_SERVICE_ROLE_KEY).trim();
  if (fallback) return fallback;
  throw new Error("SUPABASE_ANON_KEY is not set");
}

function allowDevBypass(): boolean {
  const nodeEnv = asString(process.env.NODE_ENV).trim().toLowerCase();
  if (nodeEnv === "production") return false;
  const raw = asString(process.env.CFLOW_ALLOW_DEV_AUTH_BYPASS || "false").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function parseCookie(req: any, key: string): string {
  const raw = asString(req?.headers?.cookie || "");
  if (!raw) return "";
  const parts = raw.split(";").map((item) => item.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq) === key) return decodeURIComponent(part.slice(eq + 1));
  }
  return "";
}

function extractAccessToken(req: any): string {
  const authHeader = asString(req?.headers?.authorization || "").trim();
  if (/^Bearer\s+/i.test(authHeader)) return authHeader.replace(/^Bearer\s+/i, "").trim();
  const cookieToken = parseCookie(req, "cflow_access_token");
  if (cookieToken) return cookieToken;
  return asString(req?.headers?.["x-access-token"] || "").trim();
}

class AuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 401, code = "auth_required") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function authErrorPayload(error: unknown, traceId?: string) {
  const e = error as AuthError;
  if (typeof e?.status === "number" && typeof e?.code === "string") {
    return { status: e.status, body: { error: e.message, code: e.code, traceId: asString(traceId) || null } };
  }
  return { status: 500, body: { error: "auth_guard_failed", code: "auth_guard_failed", traceId: asString(traceId) || null } };
}

async function fetchSupabaseAuthUser(accessToken: string): Promise<{ id: string; email?: string }> {
  const response = await fetch(`${supabaseBaseUrl()}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey(),
      Authorization: `Bearer ${accessToken}`
    }
  });
  const data = await readJsonSafe<AnyRecord>(response);
  if (!response.ok || !asString(data?.id).trim()) {
    throw new AuthError("invalid_or_expired_access_token", 401, "auth_invalid_token");
  }
  return { id: asString(data.id), email: asString(data.email) || undefined };
}

async function ensureWorkspaceForUser(userId: string): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const memberResp = await supabaseRestOrThrow(
    `workspace_members?user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=workspace_id,role&order=updated_at.desc&limit=1`,
    {},
    "auth_load_workspace_member"
  );
  const members = await readJsonSafe<Array<{ workspace_id?: string; role?: string }>>(memberResp);
  const first = Array.isArray(members) ? members[0] : null;
  if (first?.workspace_id) {
    const role = asString(first.role, "member") as WorkspaceRole;
    return { workspaceId: asString(first.workspace_id), role: role || "member" };
  }

  const workspaceId = `ws_${userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "user"}`;
  await supabaseRestOrThrow("workspaces?on_conflict=id", {
    method: "POST",
    body: JSON.stringify([
      {
        id: workspaceId,
        name: `Workspace ${userId.slice(0, 8)}`,
        owner_user_id: userId,
        status: "active",
        created_at: nowIso(),
        updated_at: nowIso()
      }
    ])
  }, "auth_upsert_workspace");

  await supabaseRestOrThrow("workspace_members?on_conflict=workspace_id,user_id", {
    method: "POST",
    body: JSON.stringify([
      {
        id: `wm_${workspaceId}_${userId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180),
        workspace_id: workspaceId,
        user_id: userId,
        role: "owner",
        status: "active",
        joined_at: nowIso(),
        created_at: nowIso(),
        updated_at: nowIso()
      }
    ])
  }, "auth_upsert_workspace_member");

  return { workspaceId, role: "owner" };
}

async function ensureRequestedWorkspaceMembership(userId: string, workspaceId: string): Promise<{ workspaceId: string; role: WorkspaceRole }> {
  const response = await supabaseRestOrThrow(
    `workspace_members?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=workspace_id,role&limit=1`,
    {},
    "auth_check_workspace_membership"
  );
  const rows = await readJsonSafe<Array<{ workspace_id?: string; role?: string }>>(response);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.workspace_id) {
    throw new AuthError("workspace_access_denied", 403, "workspace_access_denied");
  }
  const role = asString(row.role, "member") as WorkspaceRole;
  return { workspaceId: asString(row.workspace_id), role: role || "member" };
}

export async function requireAuthenticatedRequest(req: any, source: string): Promise<{ userId: string; email?: string; accessToken: string }> {
  if (allowDevBypass()) {
    const devUserId = asString(req?.headers?.["x-dev-user-id"] || "").trim();
    if (devUserId) {
      return { userId: devUserId, email: asString(req?.headers?.["x-dev-user-email"] || "") || undefined, accessToken: "dev_bypass" };
    }
  }
  const accessToken = extractAccessToken(req);
  if (!accessToken) throw new AuthError(`auth_required:${source}`, 401, "auth_required");
  const user = await fetchSupabaseAuthUser(accessToken);
  return { userId: user.id, email: user.email, accessToken };
}

export async function requireRequestContext(req: any, source: string): Promise<{
  userId: string;
  email?: string;
  workspaceId: string;
  role: WorkspaceRole;
  accessToken: string;
}> {
  const auth = await requireAuthenticatedRequest(req, source);

  const requestedWorkspace =
    asString(req?.headers?.["x-workspace-id"] || "").trim() ||
    asString(req?.query?.workspaceId || "").trim() ||
    asString(req?.body?.workspaceId || "").trim();

  const workspace = requestedWorkspace
    ? await ensureRequestedWorkspaceMembership(auth.userId, requestedWorkspace)
    : await ensureWorkspaceForUser(auth.userId);

  if (req?.body && typeof req.body === "object") {
    req.body.userId = auth.userId;
    req.body.workspaceId = workspace.workspaceId;
  }
  if (req?.query && typeof req.query === "object") {
    req.query.userId = auth.userId;
    req.query.workspaceId = workspace.workspaceId;
  }

  return {
    userId: auth.userId,
    email: auth.email,
    workspaceId: workspace.workspaceId,
    role: workspace.role,
    accessToken: auth.accessToken
  };
}
