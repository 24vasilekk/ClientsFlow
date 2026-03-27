declare const process: { env: Record<string, string | undefined> };

export type FollowUpScheduleInput = {
  jobId: string;
  traceId: string;
  runAtIso: string;
  dedupKey: string;
  retries: number;
};

export type FollowUpScheduleResult = {
  provider: "qstash" | "local";
  providerJobId?: string;
  scheduledAt: string;
};

export interface FollowUpProvider {
  schedule(input: FollowUpScheduleInput): Promise<FollowUpScheduleResult>;
}

function toDelayHeader(runAtIso: string): string {
  const ms = new Date(runAtIso).getTime() - Date.now();
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${seconds}s`;
}

class LocalProvider implements FollowUpProvider {
  async schedule(input: FollowUpScheduleInput): Promise<FollowUpScheduleResult> {
    return { provider: "local", providerJobId: `local_${input.jobId}`, scheduledAt: input.runAtIso };
  }
}

class QstashProvider implements FollowUpProvider {
  async schedule(input: FollowUpScheduleInput): Promise<FollowUpScheduleResult> {
    const token = process.env.QSTASH_TOKEN;
    const executeUrl = process.env.FOLLOW_UP_EXECUTE_URL;
    if (!token || !executeUrl) {
      throw new Error("QSTASH_TOKEN or FOLLOW_UP_EXECUTE_URL is not set");
    }

    const response = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(executeUrl)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Delay": toDelayHeader(input.runAtIso),
        "Upstash-Retries": String(Math.max(0, input.retries)),
        "Upstash-Deduplication-Id": input.dedupKey
      },
      body: JSON.stringify({ jobId: input.jobId, traceId: input.traceId })
    });

    const bodyText = await response.text();
    let providerJobId = "";
    try {
      const parsed = JSON.parse(bodyText) as { messageId?: string; id?: string };
      providerJobId = String(parsed.messageId || parsed.id || "");
    } catch {
      providerJobId = "";
    }

    if (!response.ok) {
      throw new Error(`qstash_schedule_failed_${response.status}_${bodyText.slice(0, 200)}`);
    }

    return { provider: "qstash", providerJobId, scheduledAt: input.runAtIso };
  }
}

export function resolveFollowUpProvider(): FollowUpProvider {
  const mode = String(process.env.FOLLOW_UP_PROVIDER || "").toLowerCase().trim();
  if (mode === "qstash") return new QstashProvider();
  return new LocalProvider();
}

