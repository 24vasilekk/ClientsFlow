declare const process: { env: Record<string, string | undefined> };

type AnyRecord = Record<string, any>;
type SafeSupabaseOptions = {
  traceId?: string;
  context?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function getSupabaseConfig() {
  const baseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/, "");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { baseUrl, serviceKey };
}

export async function supabaseRest(path: string, init: RequestInit = {}): Promise<Response> {
  const { baseUrl, serviceKey } = getSupabaseConfig();
  const url = `${baseUrl}/rest/v1/${path.replace(/^\/+/, "")}`;
  const headers = new Headers(init.headers || {});
  headers.set("apikey", serviceKey);
  headers.set("Authorization", `Bearer ${serviceKey}`);
  headers.set("Content-Type", "application/json");
  if (!headers.has("Prefer")) headers.set("Prefer", "return=representation");
  return fetch(url, { ...init, headers });
}

export class SupabaseRestError extends Error {
  status: number;
  path: string;
  details: unknown;
  traceId: string | null;
  context: string | null;
  code: string | null;

  constructor(path: string, status: number, message: string, details: unknown, extras?: { traceId?: string; context?: string; code?: string }) {
    super(message);
    this.status = status;
    this.path = path;
    this.details = details;
    this.traceId = typeof extras?.traceId === "string" && extras.traceId.trim() ? extras.traceId.trim() : null;
    this.context = typeof extras?.context === "string" && extras.context.trim() ? extras.context.trim() : null;
    this.code = typeof extras?.code === "string" && extras.code.trim() ? extras.code.trim() : null;
  }
}

function extractErrorMessage(body: unknown, status: number): string {
  const row = (body || {}) as AnyRecord;
  return (
    (typeof row.message === "string" && row.message) ||
    (typeof row.error === "string" && row.error) ||
    (typeof row.details === "string" && row.details) ||
    (typeof row.hint === "string" && row.hint) ||
    `supabase_http_${status}`
  );
}

function extractErrorCode(body: unknown): string | null {
  const row = (body || {}) as AnyRecord;
  const candidates = [row.code, row.error_code, row.errorCode];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function safeSupabaseCall(path: string, init: RequestInit = {}, options?: SafeSupabaseOptions): Promise<Response> {
  const response = await supabaseRest(path, init);
  if (response.ok) return response;
  const body = await readJsonSafe<unknown>(response);
  const message = extractErrorMessage(body, response.status);
  const traceId = typeof options?.traceId === "string" && options.traceId.trim() ? options.traceId.trim() : "";
  const context = typeof options?.context === "string" && options.context.trim() ? options.context.trim() : "";
  const decorated = [context, message, traceId ? `traceId=${traceId}` : ""].filter(Boolean).join(":");
  throw new SupabaseRestError(path, response.status, decorated || message, body, {
    traceId: traceId || undefined,
    context: context || undefined,
    code: extractErrorCode(body) || undefined
  });
}

export async function supabaseRestOrThrow(path: string, init: RequestInit = {}, context?: string): Promise<Response> {
  return safeSupabaseCall(path, init, { context });
}

export async function readJsonSafe<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}
