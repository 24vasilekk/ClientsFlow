declare const process: { env: Record<string, string | undefined> };

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nowMs(): number {
  return Date.now();
}

function parseBearer(headerValue: unknown): string {
  const raw = asString(headerValue).trim();
  if (!raw) return "";
  if (!/^Bearer\s+/i.test(raw)) return "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

export function resolveInternalDispatchToken(): string {
  return asString(process.env.CFLOW_INTERNAL_DISPATCH_TOKEN || process.env.CRON_SECRET).trim();
}

export function buildInternalAuthHeaders(traceId?: string): Record<string, string> {
  const token = resolveInternalDispatchToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (traceId) headers["x-trace-id"] = asString(traceId).trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers["x-cflow-internal-token"] = token;
  }
  return headers;
}

export function isInternalDispatchRequest(req: any): boolean {
  const token = resolveInternalDispatchToken();
  if (!token) return false;
  const authBearer = parseBearer(req?.headers?.authorization);
  const xToken = asString(req?.headers?.["x-cflow-internal-token"]).trim();
  return authBearer === token || xToken === token;
}

export function isDeferredDispatchEnabled(): boolean {
  const raw = asString(process.env.CFLOW_ENABLE_DEFERRED_DISPATCH || "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function resolveBaseUrl(): string {
  const explicit = asString(process.env.APP_BASE_URL).trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const vercelUrl = asString(process.env.VERCEL_URL).trim().replace(/\/+$/, "");
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}

export async function enqueueDeferredInternalCall(args: {
  path: string;
  payload: Record<string, unknown>;
  traceId: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; deferred: boolean; reason?: string; status?: number }> {
  const token = resolveInternalDispatchToken();
  if (!token) {
    return { ok: false, deferred: false, reason: "missing_internal_dispatch_token" };
  }
  const base = resolveBaseUrl();
  const path = args.path.startsWith("/") ? args.path : `/${args.path}`;
  const traceId = asString(args.traceId).trim() || `trace_defer_${nowMs().toString(36)}`;
  const timeoutMs = Math.max(1000, Number(args.timeoutMs || 4500));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-cflow-internal-token": token,
        "x-trace-id": traceId
      },
      body: JSON.stringify(args.payload),
      signal: controller.signal
    });

    if (!response.ok) {
      return { ok: false, deferred: false, reason: `deferred_call_http_${response.status}`, status: response.status };
    }
    return { ok: true, deferred: true, status: response.status };
  } catch (error: any) {
    return { ok: false, deferred: false, reason: asString(error?.message, "deferred_call_failed") };
  } finally {
    clearTimeout(timer);
  }
}
