import DKG from "dkg.js";
import { BLOCKCHAIN_IDS } from "dkg.js/constants/constants.js";

let client: DKG | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.includes("REPLACE")) {
    throw new Error(`${name} is not configured. DKG publication cannot continue.`);
  }
  return value;
}

export function getDkgClient(): DKG {
  if (client) return client;

  const endpoint = requiredEnv("DKG_ENDPOINT");
  const privateKey = requiredEnv("DKG_PRIVATE_KEY");
  const port = Number(process.env.DKG_PORT ?? "8900");
  if (!Number.isInteger(port) || port <= 0) throw new Error("DKG_PORT must be a valid port number.");

  client = new DKG({
    endpoint,
    port,
    blockchain: {
      name: process.env.DKG_BLOCKCHAIN ?? BLOCKCHAIN_IDS.BASE_TESTNET,
      privateKey,
    },
    maxNumberOfRetries: 300,
    frequency: 2,
    contentType: "all",
    nodeApiVersion: "/v1",
  });
  return client;
}

export function dkgNetwork(): string {
  return process.env.DKG_BLOCKCHAIN ?? BLOCKCHAIN_IDS.BASE_TESTNET;
}

export async function dkgNodeInfo(): Promise<Record<string, unknown>> {
  return getDkgClient().node.info();
}
