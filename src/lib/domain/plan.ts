import { z } from "zod";

export const PlanStep = z.object({
  id: z.string(),
  capability: z.string(),
  purpose: z.string(),
  inputRefs: z.array(z.string()).default([]),
  params: z.record(z.string(), z.unknown()).default({}),
});
export type PlanStep = z.infer<typeof PlanStep>;

export const ProductionPlan = z.object({
  goal: z.string(),
  constraints: z.record(z.string(), z.unknown()).default({}),
  steps: z.array(PlanStep).min(1, "Plan must contain at least one step"),
  knowledgeUsed: z.array(z.string()).default([]),
});
export type ProductionPlan = z.infer<typeof ProductionPlan>;

export const DirectorAction = z.enum([
  "pass",
  "targeted_retry",
  "full_retry",
  "abandon",
]);
export type DirectorAction = z.infer<typeof DirectorAction>;

export const DirectorDecision = z.object({
  action: DirectorAction,
  reason: z.string(),
  stepsToRedo: z.array(z.string()).default([]),
  stepsToKeep: z.array(z.string()).default([]),
  estimatedCost: z.number().nonnegative().optional(),
  fullRegenerationCost: z.number().nonnegative().optional(),
});
export type DirectorDecision = z.infer<typeof DirectorDecision>;

export const MAX_ITERATIONS = 3;