declare const process: { env: Record<string, string | undefined> };

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function baseUrl(): string {
  const value = asString(process.env.SUPABASE_URL).trim().replace(/\/+$/, "");
  if (!value) throw new Error("SUPABASE_URL is not set");
  return value;
}

function anonKey(): string {
  const anon = asString(process.env.SUPABASE_ANON_KEY).trim();
  if (anon) return anon;
  const fallback = asString(process.env.SUPABASE_SERVICE_ROLE_KEY).trim();
  if (fallback) return fallback;
  throw new Error("SUPABASE_ANON_KEY is not set");
}

export async function callSupabaseAuth(path: string, init: RequestInit): Promise<Response> {
  const url = `${baseUrl()}/auth/v1/${path.replace(/^\/+/, "")}`;
  const headers = new Headers(init.headers || {});
  headers.set("apikey", anonKey());
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers });
}

