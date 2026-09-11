import { z } from "zod";

export const RunStatus = z.enum([
  "created",
  "planning",
  "generating",
  "evaluating",
  "improving",
  "completed",
  "failed",
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const MediaBrief = z.object({
  objective: z.string().min(1, "Brief objective is required"),
  audience: z.string().optional(),
  format: z.enum(["vertical", "landscape", "square"]).default("vertical"),
  duration: z.number().int().min(1).max(300).optional(),
  style: z.string().optional(),
  cta: z.string().optional(),
});
export type MediaBrief = z.infer<typeof MediaBrief>;

export const Run = z.object({
  id: z.string(),
  projectId: z.string().nullable().default(null),
  brief: MediaBrief,
  status: RunStatus,
  currentVersion: z.number().int().nonnegative(),
  totalCost: z.number().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Run = z.infer<typeof Run>;

export type CreateRunInput = z.infer<typeof MediaBrief>;
