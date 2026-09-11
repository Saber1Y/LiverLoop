import { checkLivepeerJob, runLivepeerCapability } from "./client";
import type { LivepeerRunOptions, LivepeerRunResult } from "./types";

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_WAIT_MS = 5 * 60 * 1000;

export interface JobPollOptions {
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

export async function runMediaJob(
  options: LivepeerRunOptions,
): Promise<LivepeerRunResult & { outputUrl?: string }> {
  const result = await runLivepeerCapability(options);

  if (result.job_id && result.status !== "done") {
    const final = await pollJob(result.job_id, {
      pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      maxWaitMs: options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
    });
    return {
      ...result,
      ok: final.status === "done",
      url: final.url ?? result.url,
      status: final.status,
      error: final.error,
      cost_usd_estimated: final.cost_usd_estimated ?? result.cost_usd_estimated,
      outputUrl: final.url ?? result.url,
    };
  }

  return {
    ...result,
    outputUrl: result.url,
  };
}

export async function pollJob(
  jobId: string,
  opts: JobPollOptions = {},
): Promise<{ status: string; url?: string; error?: string; cost_usd_estimated?: number }> {
  const interval = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxWait = opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const startedAt = Date.now();

  for (;;) {
    const status = await checkLivepeerJob(jobId);
    if (status.status === "done") return status;
    if (status.status === "failed") {
      return { status: "failed", error: status.error ?? "Livepeer job failed" };
    }
    if (Date.now() - startedAt > maxWait) {
      return { status: "failed", error: `Livepeer job timed out after ${maxWait}ms` };
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

export function mediaUrlFrom(maybeProxiedUrl: string | undefined): string | undefined {
  if (!maybeProxiedUrl) return undefined;
  return maybeProxiedUrl;
}