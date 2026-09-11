import { z } from "zod";

export const Severity = z.enum(["low", "medium", "high"]);
export type Severity = z.infer<typeof Severity>;

export const EvaluationDimension = z.object({
  name: z.string(),
  score: z.number().min(0).max(10),
  reasoning: z.string(),
});
export type EvaluationDimension = z.infer<typeof EvaluationDimension>;

export const EvaluationIssue = z.object({
  category: z.string(),
  severity: Severity,
  description: z.string(),
});
export type EvaluationIssue = z.infer<typeof EvaluationIssue>;

export const EvaluationDecision = z.enum(["pass", "fail"]);
export type EvaluationDecision = z.infer<typeof EvaluationDecision>;

export const EvaluationResult = z.object({
  overall: z.number().min(0).max(10),
  dimensions: z.array(EvaluationDimension),
  issues: z.array(EvaluationIssue),
  decision: EvaluationDecision,
  passThreshold: z.number().min(0).max(10).default(7.5),
});
export type EvaluationResult = z.infer<typeof EvaluationResult>;

export const DEFAULT_PASS_THRESHOLD = 7.5;

export const CRITICAL_DIMENSION_THRESHOLD = 5.0;

export type ArtifactEvaluationInput = {
  artifactUrl: string;
  artifactType: "image" | "video" | "audio";
  brief: string;
  audience?: string;
  style?: string;
  cta?: string;
  format?: string;
  duration?: number;
};