import { checkLivepeerJob, runLivepeerCapability } from "./client";
import type { LivepeerRunOptions, LivepeerRunResult } from "./types";

const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_WAIT_MS = 5 * 60 * 1000;
const MAX_JOB_ATTEMPTS = 3;

export interface JobPollOptions {
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

function isTransientJobFailure(error: string | undefined): boolean {
  if (!error) return true;
  return (
    /no heartbeat|stopped responding|no orchestrator|rejected|capacity|unavailable|502|503|504|timed? out|worker/i.test(
      error,
    )
  );
}

export async function runMediaJob(
  options: LivepeerRunOptions,
): Promise<LivepeerRunResult & { outputUrl?: string }> {
  let lastResult: LivepeerRunResult & { outputUrl?: string } | null = null;

  for (let attempt = 0; attempt < MAX_JOB_ATTEMPTS; attempt += 1) {
    const result = await runLivepeerCapability(options);

    if (result.job_id && result.status !== "done") {
      let combined: LivepeerRunResult & { outputUrl?: string };
      try {
        const final = await pollJob(result.job_id, {
          pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
          maxWaitMs: options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
        });
        combined = {
          ...result,
          ok: final.status === "done",
          url: final.url ?? result.url,
          status: final.status,
          error: final.error,
          cost_usd_estimated: final.cost_usd_estimated ?? result.cost_usd_estimated,
          outputUrl: final.url ?? result.url,
        };
      } catch (error) {
        combined = {
          ...result,
          ok: false,
          status: "failed",
          error: error instanceof Error ? error.message : "Livepeer job poll failed",
        };
      }
      lastResult = combined;
      if (combined.ok) return combined;
      if (attempt >= MAX_JOB_ATTEMPTS - 1 || !isTransientJobFailure(combined.error)) {
        return combined;
      }
      await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt));
      continue;
    }

    if (!result.ok || !result.outputUrl) {
      lastResult = { ...result, outputUrl: result.url };
      if (attempt >= MAX_JOB_ATTEMPTS - 1 || !isTransientJobFailure(result.error)) {
        return lastResult;
      }
      await new Promise((r) => setTimeout(r, 3000 * 2 ** attempt));
      continue;
    }

    return {
      ...result,
      outputUrl: result.url,
    };
  }

  throw lastResult?.error ?? new Error("Livepeer job failed");
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