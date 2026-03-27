declare const process: { env: Record<string, string | undefined> };

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

const CONTEXT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9@._:-]{1,127}$/;

function validateContextId(value: string, field: "workspaceId" | "userId") {
  if (!CONTEXT_ID_RE.test(value)) {
    throw new RuntimeContextError(`${field} has invalid format`, 400, "workspace_context_invalid_format");
  }
}

function isTruthy(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isFalsy(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off";
}

export class RuntimeContextError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "runtime_context_invalid") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isDemoContextAllowed(): boolean {
  const nodeEnv = asString(process.env.NODE_ENV).trim().toLowerCase();
  if (nodeEnv === "production") return false;
  const flagRaw = asString(process.env.CFLOW_ALLOW_DEMO_CONTEXT).trim();
  if (!flagRaw) return true;
  if (isTruthy(flagRaw)) return true;
  if (isFalsy(flagRaw)) return false;
  return true;
}

export function resolveWorkspaceUserContext(args: {
  workspaceId?: unknown;
  userId?: unknown;
  traceId?: string;
  source?: string;
}): { workspaceId: string; userId: string; isDemoContext: boolean } {
  const workspaceId = asString(args.workspaceId).trim();
  const userId = asString(args.userId).trim();
  if (workspaceId && userId) {
    validateContextId(workspaceId, "workspaceId");
    validateContextId(userId, "userId");
    return { workspaceId, userId, isDemoContext: false };
  }
  if (workspaceId || userId) {
    throw new RuntimeContextError("workspaceId and userId must be provided together", 400, "workspace_context_partial");
  }

  if (!isDemoContextAllowed()) {
    throw new RuntimeContextError("workspaceId and userId are required", 401, "workspace_context_missing");
  }

  const traceId = asString(args.traceId).trim() || `trace_ctx_${Date.now().toString(36)}`;
  console.warn("[runtime/context] demo_context_fallback", {
    traceId,
    source: asString(args.source).trim() || "unknown_source",
    reason: "missing_workspace_user"
  });
  return { workspaceId: "demo-workspace", userId: "demo-user", isDemoContext: true };
}

export function runtimeContextErrorPayload(error: unknown, traceId?: string) {
  const e = error as RuntimeContextError;
  if (typeof e?.status === "number" && typeof e?.code === "string") {
    return {
      status: e.status,
      body: {
        error: e.message,
        code: e.code,
        traceId: asString(traceId).trim() || null
      }
    };
  }
  return {
    status: 500,
    body: {
      error: "runtime_context_failed",
      code: "runtime_context_failed",
      traceId: asString(traceId).trim() || null
    }
  };
}
