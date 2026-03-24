type SpecRecord = {
  id: string;
  sessionId: string;
  createdAt: string;
  round: number;
  engine: "openrouter" | "algorithm";
  guidance: string;
  profile: {
    businessName: string;
    niche: string;
    city: string;
    goal: string;
    style: string;
    mustHave: string[];
  };
  draft: unknown;
};

const KV_API_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const SPEC_KEY = "clientsflow:site-spec:session:";

function memoryStore(): Map<string, string> {
  const root = globalThis as unknown as { __clientsflowSpecStore?: Map<string, string> };
  if (!root.__clientsflowSpecStore) root.__clientsflowSpecStore = new Map<string, string>();
  return root.__clientsflowSpecStore;
}

async function kvGet(key: string): Promise<string | null> {
  if (!KV_API_URL || !KV_TOKEN) {
    return memoryStore().get(key) ?? null;
  }
  const response = await fetch(`${KV_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { result?: string | null };
  return typeof data.result === "string" ? data.result : null;
}

async function kvSet(key: string, value: string): Promise<void> {
  if (!KV_API_URL || !KV_TOKEN) {
    memoryStore().set(key, value);
    return;
  }
  await fetch(`${KV_API_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(value)
  });
}

function keyBySession(sessionId: string) {
  return `${SPEC_KEY}${sessionId}`;
}

export async function appendSpecRecord(record: SpecRecord): Promise<SpecRecord[]> {
  const key = keyBySession(record.sessionId);
  const raw = await kvGet(key);
  let prev: SpecRecord[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SpecRecord[];
      if (Array.isArray(parsed)) prev = parsed;
    } catch {
      prev = [];
    }
  }
  const next = [...prev, record].slice(-20);
  await kvSet(key, JSON.stringify(next));
  return next;
}

export async function getSpecHistory(sessionId: string): Promise<SpecRecord[]> {
  const key = keyBySession(sessionId);
  const raw = await kvGet(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SpecRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
