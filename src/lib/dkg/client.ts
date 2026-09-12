export type V10Quad = {
  subject: string;
  predicate: string;
  object: string;
};

export type V10Publication = {
  kaId: string;
  status: string;
  ual: string;
  txHash: string;
  assertionUri: string;
  authorAddress: string;
  merkleRoot: string;
  blockNumber: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.includes("REPLACE")) {
    throw new Error(`${name} is not configured. DKG publication cannot continue.`);
  }
  return value;
}

function baseUrl(): string {
  const endpoint = requiredEnv("DKG_ENDPOINT");
  const port = Number(process.env.DKG_PORT ?? "9200");
  if (!Number.isInteger(port) || port <= 0) throw new Error("DKG_PORT must be a valid port number.");
  const trimmed = endpoint.replace(/\/+$/, "");
  return `${trimmed}:${port}`;
}

function contextGraphId(): string {
  return process.env.DKG_CONTEXT_GRAPH ?? "0xc376B7120f0F895a7853cc445B7b139374e1c0f8/liverloop";
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: init.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`DKG V10 API ${path} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

export async function createKnowledgeAsset(params: {
  name: string;
  quads: V10Quad[];
}): Promise<Record<string, unknown>> {
  return request("/api/knowledge-assets", {
    body: {
      contextGraphId: contextGraphId(),
      name: params.name,
      quads: params.quads,
      finalize: true,
      alsoShareSwm: true,
    },
  });
}

export async function shareKnowledgeAsset(params: {
  name: string;
}): Promise<Record<string, unknown>> {
  return request(`/api/knowledge-assets/${encodeURIComponent(params.name)}/swm/share`, {
    body: { contextGraphId: contextGraphId() },
  });
}

export async function publishKnowledgeAssetToVm(params: {
  name: string;
}): Promise<V10Publication> {
  return request(`/api/knowledge-assets/${encodeURIComponent(params.name)}/vm/publish`, {
    body: { contextGraphId: contextGraphId(), options: {} },
  });
}

export async function queryContextGraph(params: {
  sparql: string;
  includeSharedMemory?: boolean;
}): Promise<{ result: { bindings?: Record<string, string>[] } }> {
  return request("/api/query", {
    body: {
      sparql: params.sparql,
      contextGraphId: contextGraphId(),
      includeSharedMemory: params.includeSharedMemory ?? false,
    },
  });
}

export function dkgNetwork(): string {
  return process.env.DKG_BLOCKCHAIN ?? "base:84532";
}

export async function dkgNodeInfo(): Promise<Record<string, unknown>> {
  return request("/api/status", { method: "GET" });
}