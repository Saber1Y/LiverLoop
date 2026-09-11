export type CapabilityKind = "ai" | "tool" | "mcp";

export interface LivepeerCapability {
  name: string;
  model_id: string;
  description?: string;
  kind?: CapabilityKind;
  capacity?: number;
  display_price_usd?: number | null;
  display_unit?: string;
  unit_kind?: string;
}

export interface LivepeerCapabilitiesResponse {
  count: number;
  capabilities: LivepeerCapability[];
}

export type LivepeerOutputKind = "image" | "video" | "audio";

export interface LivepeerRunResult {
  ok: boolean;
  capability: string;
  output_kind?: LivepeerOutputKind;
  url?: string;
  cost_usd_estimated?: number;
  cost_unit_kind?: string;
  cost_units?: number;
  budget_headroom_usd?: number;
  job_id?: string;
  status?: string;
  error?: string;
  [key: string]: unknown;
}

export interface LivepeerRunResponse {
  result?: {
    content?: Array<{ type: string; text?: string }>;
    structuredContent?: LivepeerRunResult;
    job_id?: string;
    isError?: boolean;
  };
  error?: { message?: string; code?: number };
}

export interface LivepeerRunOptions {
  capability: string;
  prompt?: string;
  sourceUrl?: string;
  inputs?: Record<string, unknown>;
  timeout?: number;
  async?: boolean;
  pollIntervalMs?: number;
  maxWaitMs?: number;
}

export interface JobStatus {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  url?: string;
  error?: string;
  capability?: string;
  cost_usd_estimated?: number;
}

export interface LivepeerErrors {
  UNAVAILABLE: string;
  AUTH: string;
  CAPABILITY_NOT_FOUND: string;
  BUDGET_EXCEEDED: string;
  UNKNOWN: string;
}

export const LIVE_PEER_ERRORS: LivepeerErrors = {
  UNAVAILABLE: "Livepeer unavailable. This run cannot continue.",
  AUTH: "Livepeer authentication failed. Check LIVEPEER_API_KEY.",
  CAPABILITY_NOT_FOUND: "Requested Livepeer capability is not available on the network.",
  BUDGET_EXCEEDED: "Livepeer demo/account budget exhausted for this session.",
  UNKNOWN: "Livepeer request failed with an unknown error.",
};

export type MediaCapabilityType = "image" | "video" | "audio" | "analysis" | "tool";