export const AUTH_KEY = "clientsflow_auth_v1";
export const WORKBENCH_AUTH_KEY = "clientsflow_workbench_auth_v1";
export const USER_CONTEXT_KEY = "clientsflow_user_context_v1";

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  user: { id: string; email?: string | null };
};

export type StoredUserContext = {
  workspaceId: string;
  userId: string;
  role?: "owner" | "admin" | "member";
  email?: string;
  source: "auth_session";
  updatedAt: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toEpochSeconds(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isClientDemoContextAllowed(): boolean {
  const flag = String(import.meta.env.VITE_ALLOW_DEMO_CONTEXT || "")
    .trim()
    .toLowerCase();
  return import.meta.env.DEV && (flag === "true" || flag === "1" || flag === "yes");
}

function writeTokenCookie(accessToken: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `cflow_access_token=${encodeURIComponent(accessToken)}; Path=/; SameSite=Lax${secure}`;
}

function clearTokenCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "cflow_access_token=; Path=/; Max-Age=0; SameSite=Lax";
}

export function saveAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  localStorage.setItem(WORKBENCH_AUTH_KEY, JSON.stringify({ isAuth: true, userId: session.user.id }));
  writeTokenCookie(session.accessToken);
}

export function readAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    const accessToken = asString(parsed.accessToken).trim();
    const refreshToken = asString(parsed.refreshToken).trim();
    const userId = asString(parsed.user?.id).trim();
    if (!accessToken || !refreshToken || !userId) return null;
    return {
      accessToken,
      refreshToken,
      expiresAt: Number(parsed.expiresAt || 0),
      tokenType: asString(parsed.tokenType || "bearer") || "bearer",
      user: {
        id: userId,
        email: asString(parsed.user?.email || "") || null
      }
    };
  } catch {
    return null;
  }
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(WORKBENCH_AUTH_KEY);
  localStorage.removeItem(USER_CONTEXT_KEY);
  clearTokenCookie();
}

export function isAuthenticatedClient(): boolean {
  const session = readAuthSession();
  if (!session) return false;
  if (!session.expiresAt) return true;
  return session.expiresAt > Math.floor(Date.now() / 1000) - 30;
}

export function saveUserContext(context: StoredUserContext): void {
  localStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(context));
}

export function readUserContext(): StoredUserContext | null {
  try {
    const raw = localStorage.getItem(USER_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUserContext>;
    const workspaceId = asString(parsed.workspaceId).trim();
    const userId = asString(parsed.userId).trim();
    if (!workspaceId || !userId) return null;
    return {
      workspaceId,
      userId,
      role: parsed.role === "owner" || parsed.role === "admin" || parsed.role === "member" ? parsed.role : undefined,
      email: asString(parsed.email).trim() || undefined,
      source: "auth_session",
      updatedAt: asString(parsed.updatedAt).trim() || new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export function resolveClientUserContext(): StoredUserContext | null {
  return readUserContext();
}

async function postJson<T>(url: string, body: Record<string, unknown>, accessToken?: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    throw new Error(asString(data?.error || data?.message || `${url}_failed`));
  }
  return data as T;
}

function normalizeSessionPayload(data: any): AuthSession {
  const accessToken = asString(data?.access_token || data?.session?.access_token).trim();
  const refreshToken = asString(data?.refresh_token || data?.session?.refresh_token).trim();
  const tokenType = asString(data?.token_type || data?.session?.token_type || "bearer").trim() || "bearer";
  const expiresIn = toEpochSeconds(data?.expires_in || data?.session?.expires_in);
  const nowSec = Math.floor(Date.now() / 1000);
  const user = (data?.user || data?.session?.user || {}) as any;
  const userId = asString(user?.id).trim();
  if (!accessToken || !refreshToken || !userId) {
    throw new Error("auth_session_incomplete");
  }
  return {
    accessToken,
    refreshToken,
    tokenType,
    expiresAt: nowSec + Math.max(1, expiresIn || 3600),
    user: { id: userId, email: asString(user?.email) || null }
  };
}

export async function loginWithPassword(email: string, password: string): Promise<AuthSession> {
  const payload = await postJson<any>("/api/auth/login", { email, password });
  const session = normalizeSessionPayload(payload);
  saveAuthSession(session);
  return session;
}

export async function registerWithPassword(email: string, password: string): Promise<{ requiresEmailConfirmation: boolean }> {
  const payload = await postJson<any>("/api/auth/signup", { email, password });
  if (payload?.session?.access_token || payload?.access_token) {
    const session = normalizeSessionPayload(payload);
    saveAuthSession(session);
  }
  return { requiresEmailConfirmation: !payload?.session };
}

export async function sendMagicLink(email: string, emailRedirectTo?: string): Promise<void> {
  await postJson("/api/auth/magic-link", { email, emailRedirectTo: emailRedirectTo || window.location.origin + "/login" });
}

export async function requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
  await postJson("/api/auth/reset-password", { email, redirectTo: redirectTo || window.location.origin + "/login" });
}

export async function logoutCurrentSession(): Promise<void> {
  const session = readAuthSession();
  if (session?.accessToken) {
    try {
      await postJson("/api/auth/logout", {}, session.accessToken);
    } catch {
      // ignore logout API error, clear local session anyway
    }
  }
  clearAuthSession();
}

export async function refreshSessionFromToken(): Promise<StoredUserContext> {
  const session = readAuthSession();
  if (!session?.accessToken) {
    throw new Error("auth_session_missing");
  }
  const response = await fetch("/api/auth/session", {
    method: "GET",
    headers: { Authorization: `Bearer ${session.accessToken}` }
  });
  const data = (await response.json().catch(() => ({}))) as any;
  if (!response.ok) {
    throw new Error(asString(data?.error || "auth_session_invalid"));
  }
  const workspaceId = asString(data?.workspace?.id).trim();
  const userId = asString(data?.user?.id).trim();
  if (!workspaceId || !userId) {
    throw new Error("auth_context_incomplete");
  }
  const ctx: StoredUserContext = {
    workspaceId,
    userId,
    role: data?.workspace?.role === "owner" || data?.workspace?.role === "admin" || data?.workspace?.role === "member" ? data.workspace.role : undefined,
    email: asString(data?.user?.email).trim() || undefined,
    source: "auth_session",
    updatedAt: new Date().toISOString()
  };
  saveUserContext(ctx);
  return ctx;
}
