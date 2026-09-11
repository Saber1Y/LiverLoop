import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import { events, type RunEventType } from "../db/schema";

export type LedgerEvent = {
  id: string;
  runId: string;
  versionNumber: number | null;
  type: RunEventType;
  data: Record<string, unknown>;
  createdAt: string;
};

export function recordEvent(params: {
  runId: string;
  type: RunEventType;
  versionNumber?: number | null;
  data?: Record<string, unknown>;
}): LedgerEvent {
  const event = {
    id: nanoid(),
    runId: params.runId,
    versionNumber: params.versionNumber ?? null,
    type: params.type,
    data: params.data ?? {},
    createdAt: new Date().toISOString(),
  };
  db.insert(events).values(event).run();
  return event;
}

export function getRunEvents(runId: string): LedgerEvent[] {
  return db
    .select()
    .from(events)
    .where(eq(events.runId, runId))
    .orderBy(desc(events.createdAt))
    .all()
    .map((event) => ({
      id: event.id,
      runId: event.runId,
      versionNumber: event.versionNumber,
      type: event.type as RunEventType,
      data: (event.data ?? {}) as Record<string, unknown>,
      createdAt: event.createdAt,
    }));
}
