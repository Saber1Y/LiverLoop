import type {
  LivepeerCapabilitiesResponse,
  LivepeerRunOptions,
  LivepeerRunResponse,
  LivepeerRunResult,
} from "./types";
import { LIVE_PEER_ERRORS } from "./types";

const AGENT_BASE_URL = "https://agent.livepeer.org";
const CAPABILITIES_PATH = "/api/capabilities";
const MCP_RAW_PATH = "/api/mcp/raw";
const MCP_PROTOCOL_VERSION = "2025-03-26";

interface McpSession {
  id: string | null;
}

function authHeaders(): Record<string, string> {
  const key = process.env.LIVEPEER_API_KEY;
  if (key && key.length > 8 && !key.includes("REPLACE")) {
    return { Authorization: `Bearer ${key}` };
  }
  return {};
}

async function jsonRpc(
  method: string,
  params: Record<string, unknown>,
  session: McpSession = { id: null },
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...authHeaders(),
  };
  if (session.id) headers["Mcp-Session-Id"] = session.id;

  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };

  let res: Response;
  try {
    res = await fetch(`${AGENT_BASE_URL}${MCP_RAW_PATH}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new Error(LIVE_PEER_ERRORS.UNAVAILABLE);
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(LIVE_PEER_ERRORS.AUTH);
    }
    throw new Error(`${LIVE_PEER_ERRORS.UNKNOWN} (HTTP ${res.status})`);
  }

  const text = await res.text();
  const lines = text
    .split("\n")
    .filter((l) => l.trim().startsWith("{"));
  let payload: unknown = null;
  for (const line of lines) {
    try {
      payload = JSON.parse(line);
      break;
    } catch {
      continue;
    }
  }

  if (!payload) {
    throw new Error(LIVE_PEER_ERRORS.UNKNOWN);
  }

  const parsed = payload as {
    result?: unknown;
    error?: { message?: string };
  };
  if (parsed.error) {
    throw new Error(parsed.error.message ?? LIVE_PEER_ERRORS.UNKNOWN);
  }
  return parsed.result;
}

export async function initializeMcp(): Promise<McpSession> {
  const result = (await jsonRpc("initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "liverloop", version: "1.0.0" },
  })) as { serverInfo?: { name?: string }; id?: string };

  const session: McpSession = {
    id: (result as Record<string, unknown>).id
      ? String((result as Record<string, unknown>).id)
      : null,
  };

  if (session.id) {
    try {
      await jsonRpc("notifications/initialized", {}, session);
    } catch {
      // Non-fatal if the server is permissive without session state.
    }
  }
  return session;
}

export async function fetchLivepeerCapabilities(
  limit = 250,
): Promise<LivepeerCapabilitiesResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders(),
  };
  try {
    const res = await fetch(`${AGENT_BASE_URL}${CAPABILITIES_PATH}?limit=${limit}`, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`${LIVE_PEER_ERRORS.UNKNOWN} (HTTP ${res.status})`);
    }
    const data = (await res.json()) as LivepeerCapabilitiesResponse;
    return data;
  } catch {
    throw new Error(LIVE_PEER_ERRORS.UNAVAILABLE);
  }
}

export async function runLivepeerCapability(
  options: LivepeerRunOptions,
): Promise<LivepeerRunResult> {
  const session = await initializeMcp();

  const args: Record<string, unknown> = {};
  if (options.capability) args.capability = options.capability;
  if (options.prompt) args.prompt = options.prompt;
  if (options.sourceUrl) args.source_url = options.sourceUrl;
  if (options.inputs) args.inputs = options.inputs;
  if (options.timeout) args.timeout = options.timeout;
  if (options.async !== undefined) args.async = options.async;

  const result = (await jsonRpc(
    "tools/call",
    { name: "run_capability", arguments: args },
    session,
  )) as LivepeerRunResponse;

  const content = result?.result?.structuredContent;
  if (!content) {
    const err = result?.error?.message ?? result?.result?.isError
      ? "Livepeer run_capability returned an error"
      : LIVE_PEER_ERRORS.UNKNOWN;
    throw new Error(err);
  }
  if (content.ok === false || content.error) {
    throw new Error(content.error ?? LIVE_PEER_ERRORS.UNKNOWN);
  }
  return content;
}

export async function checkLivepeerJob(jobId: string): Promise<{
  status: string;
  url?: string;
  error?: string;
  cost_usd_estimated?: number;
}> {
  const session = await initializeMcp();
  const result = (await jsonRpc(
    "tools/call",
    { name: "get_create_media", arguments: { job_id: jobId } },
    session,
  )) as LivepeerRunResponse;
  const c = result?.result?.structuredContent;
  return {
    status: c?.status ?? "queued",
    url: c?.url,
    error: c?.error,
    cost_usd_estimated: c?.cost_usd_estimated,
  };
}