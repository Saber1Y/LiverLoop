import { z } from "zod";
import type { MediaBrief } from "./run";
import type { EvaluationResult } from "./evaluation";

export const KnowledgeIteration = z.object({
  version: z.string(),
  evaluation: z.record(z.string(), z.number()),
  failure: z.string().optional(),
});
export type KnowledgeIteration = z.infer<typeof KnowledgeIteration>;

export const MediaRunKnowledgeAsset = z.object({
  type: z.literal("MediaRunKnowledgeAsset"),
  project: z.string(),
  run: z.string(),
  brief: z.unknown(),
  iterations: z.array(KnowledgeIteration),
  finalVersion: z.string(),
  lessons: z.array(z.string()),
  publishedAt: z.string().optional(),
  ual: z.string().optional(),
  network: z.string().optional(),
});
export type MediaRunKnowledgeAsset = z.infer<typeof MediaRunKnowledgeAsset>;

export type KnowledgeExtractionInput = {
  runId: string;
  projectId: string | null;
  brief: MediaBrief;
  iterations: {
    versionNumber: number;
    evaluation: EvaluationResult | null;
    failure?: string | null;
  }[];
  finalVersionNumber: number;
  lessons: string[];
};

export type RetrievedKnowledge = {
  asset: MediaRunKnowledgeAsset;
  retrievalOption: "DKG" | "ledger";
  ual?: string;
};