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
    styleReference?: string;
    mustHave: string[];
  };
  draft: unknown;
};

const KV_API_URL = String(process.env.KV_REST_API_URL || "").trim();
const KV_TOKEN = String(process.env.KV_REST_API_TOKEN || "")
  .replace(/[\r\n]+/g, "")
  .trim();
const SPEC_KEY = "clientsflow:site-spec:session:";

function hasValidKvConfig() {
  if (!KV_API_URL || !KV_TOKEN) return false;
  try {
    const parsed = new URL(KV_API_URL);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function memoryStore(): Map<string, string> {
  const root = globalThis as unknown as { __clientsflowSpecStore?: Map<string, string> };
  if (!root.__clientsflowSpecStore) root.__clientsflowSpecStore = new Map<string, string>();
  return root.__clientsflowSpecStore;
}

async function kvGet(key: string): Promise<string | null> {
  if (!hasValidKvConfig()) {
    return memoryStore().get(key) ?? null;
  }
  try {
    const response = await fetch(`${KV_API_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    if (!response.ok) return memoryStore().get(key) ?? null;
    const data = (await response.json()) as { result?: string | null };
    return typeof data.result === "string" ? data.result : memoryStore().get(key) ?? null;
  } catch {
    return memoryStore().get(key) ?? null;
  }
}

async function kvSet(key: string, value: string): Promise<void> {
  if (!hasValidKvConfig()) {
    memoryStore().set(key, value);
    return;
  }
  try {
    await fetch(`${KV_API_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
  } catch {
    memoryStore().set(key, value);
  }
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
