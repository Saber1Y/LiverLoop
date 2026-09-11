import { z } from "zod";
import { EvaluationResult } from "./evaluation";

export const MediaArtifactType = z.enum(["image", "video", "audio", "composition"]);
export type MediaArtifactType = z.infer<typeof MediaArtifactType>;

export const MediaArtifact = z.object({
  id: z.string(),
  versionId: z.string(),
  type: MediaArtifactType,
  url: z.string(),
  capability: z.string(),
  purpose: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});
export type MediaArtifact = z.infer<typeof MediaArtifact>;

export const MediaVersion = z.object({
  id: z.string(),
  runId: z.string(),
  versionNumber: z.number().int().positive(),
  artifacts: z.array(MediaArtifact).default([]),
  evaluation: EvaluationResult.nullable(),
  selected: z.boolean().default(false),
  createdAt: z.string(),
});
export type MediaVersion = z.infer<typeof MediaVersion>;

export const GenerationJob = z.object({
  id: z.string(),
  runId: z.string(),
  stepId: z.string(),
  capability: z.string(),
  prompt: z.string(),
  params: z.record(z.string(), z.unknown()).default({}),
  inputArtifacts: z.array(z.string()).default([]),
  status: z.enum(["pending", "running", "completed", "failed"]),
  outputUrl: z.string().nullable().default(null),
  cost: z.number().default(0),
  error: z.string().nullable().default(null),
  startedAt: z.string(),
  completedAt: z.string().nullable().default(null),
});
export type GenerationJob = z.infer<typeof GenerationJob>;