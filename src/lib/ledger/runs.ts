import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { MediaBrief, Run as RunSchema, type MediaBrief as MediaBriefType, type Run, type RunStatus } from "../domain/run";
import { db } from "../db/client";
import { runs } from "../db/schema";
import { recordEvent } from "./events";

function toRun(row: typeof runs.$inferSelect): Run {
  return RunSchema.parse({
    id: row.id,
    projectId: row.projectId,
    brief: row.brief,
    status: row.status,
    currentVersion: row.currentVersion,
    totalCost: row.totalCost,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function createRun(input: MediaBriefType): Run {
  const brief = MediaBrief.parse(input);
  const now = new Date().toISOString();
  const row = {
    id: nanoid(12),
    projectId: null,
    brief,
    status: "created" as const,
    currentVersion: 0,
    totalCost: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(runs).values(row).run();
  recordEvent({ runId: row.id, type: "RUN_CREATED", data: { brief } });
  return toRun(row);
}

export function getRun(id: string): Run | null {
  const row = db.select().from(runs).where(eq(runs.id, id)).get();
  return row ? toRun(row) : null;
}

export function updateRun(
  id: string,
  values: Partial<Pick<Run, "status" | "currentVersion" | "totalCost">>,
): Run {
  const updated = db
    .update(runs)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(runs.id, id))
    .returning()
    .get();
  if (!updated) throw new Error(`Run ${id} was not found`);
  return toRun(updated);
}

export function updateRunStatus(id: string, status: RunStatus): Run {
  return updateRun(id, { status });
}
