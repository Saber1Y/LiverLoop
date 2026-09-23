import { dkgNetwork, getKnowledgeAssetRecord } from "./client";

export type VerifiedAsset = {
  state: string;
  memoryLayer: string;
  assertionGraph: string;
  publishedUal: string | null;
  reservedUal: string | null;
  kaNumber: string | null;
  status: string | null;
  wmCurrentAssertion: string | null;
  swmCurrentAssertion: string | null;
  vmCurrentAssertion: string | null;
  currentShareOperationId: string | null;
  agentAddress: string | null;
};

export type DkgNetworkFacts = {
  network: string;
  networkName: string;
  chainId: string;
  hubAddress: string;
  blockExplorerUrl: string;
  blockExplorerAddressUrl: string;
};

export function dkgNetworkFacts(): DkgNetworkFacts {
  const hubAddress = process.env.DKG_HUB_ADDRESS ?? "0xC056e67Da4F51377Ad1B01f50F655fFdcCD809F6";
  const blockExplorerUrl = process.env.DKG_BLOCK_EXPLORER_URL ?? "https://sepolia.basescan.org";
  return {
    network: dkgNetwork(),
    networkName: "DKG V10 Base Testnet",
    chainId: "base:84532",
    hubAddress,
    blockExplorerUrl,
    blockExplorerAddressUrl: `${blockExplorerUrl}/address/${hubAddress}`,
  };
}

export async function getVerifiedAsset(ual: string): Promise<VerifiedAsset> {
  const raw = await getKnowledgeAssetRecord(ual);
  return {
    state: String(raw.state ?? "unknown"),
    memoryLayer: String(raw.memoryLayer ?? "unknown"),
    assertionGraph: String(raw.assertionGraph ?? ""),
    publishedUal: typeof raw.publishedUal === "string" ? raw.publishedUal : null,
    reservedUal: typeof raw.reservedUal === "string" ? raw.reservedUal : null,
    kaNumber: typeof raw.kaNumber === "string" ? raw.kaNumber : null,
    status: typeof raw.status === "string" ? raw.status : null,
    wmCurrentAssertion: typeof raw.wmCurrentAssertion === "string" ? raw.wmCurrentAssertion : null,
    swmCurrentAssertion: typeof raw.swmCurrentAssertion === "string" ? raw.swmCurrentAssertion : null,
    vmCurrentAssertion: typeof raw.vmCurrentAssertion === "string" ? raw.vmCurrentAssertion : null,
    currentShareOperationId: typeof raw.currentShareOperationId === "string" ? raw.currentShareOperationId : null,
    agentAddress: typeof raw.agentAddress === "string" ? raw.agentAddress : null,
  };
}