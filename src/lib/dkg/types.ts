import type { MediaRunKnowledgeAsset } from "../domain/knowledge";

export type DkgPublicationStatus = "published" | "failed" | "unavailable";

export type DkgPublication = {
  status: DkgPublicationStatus;
  ual?: string;
  network: string;
  datasetRoot?: string;
  transactionHash?: string;
  error?: string;
};

export type PublicKnowledgeAsset = MediaRunKnowledgeAsset & {
  sourceReferences: string[];
  generationHistory: Record<string, unknown>[];
  transformationHistory: Record<string, unknown>[];
  decisionRationale: string;
};

export type DkgAssetResponse = {
  UAL?: string;
  datasetRoot?: string;
  transactionHash?: string;
  operation?: Record<string, unknown>;
};
