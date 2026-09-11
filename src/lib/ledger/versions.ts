import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import { artifacts, versions } from "../db/schema";
import type { EvaluationResult } from "../domain/evaluation";
import type { MediaArtifact, MediaArtifactType, MediaVersion } from "../domain/media";

export type CreateVersionInput = {
  runId: string;
  versionNumber: number;
  artifacts: {
    type: MediaArtifactType;
    url: string;
    capability: string;
    purpose: string;
    metadata?: Record<string, unknown>;
  }[];
  evaluation?: EvaluationResult | null;
};

export function createVersion(input: CreateVersionInput): MediaVersion {
  const versionId = nanoid(12);
  const createdAt = new Date().toISOString();
  const artifactRows = input.artifacts.map((artifact) => ({
    id: nanoid(12),
    versionId,
    runId: input.runId,
    type: artifact.type,
    url: artifact.url,
    capability: artifact.capability,
    purpose: artifact.purpose,
    metadata: artifact.metadata ?? {},
    createdAt,
  }));

  db.insert(versions).values({
    id: versionId,
    runId: input.runId,
    versionNumber: input.versionNumber,
    artifacts: artifactRows,
    evaluation: input.evaluation ?? null,
    selected: false,
    createdAt,
  }).run();

  if (artifactRows.length > 0) db.insert(artifacts).values(artifactRows).run();

  return {
    id: versionId,
    runId: input.runId,
    versionNumber: input.versionNumber,
    artifacts: artifactRows.map((artifact) => ({
      id: artifact.id,
      versionId: artifact.versionId,
      type: artifact.type as MediaArtifactType,
      url: artifact.url,
      capability: artifact.capability,
      purpose: artifact.purpose ?? "",
      metadata: (artifact.metadata ?? {}) as Record<string, unknown>,
      createdAt: artifact.createdAt,
    })) satisfies MediaArtifact[],
    evaluation: input.evaluation ?? null,
    selected: false,
    createdAt,
  };
}

export function setSelectedVersion(runId: string, versionId: string): void {
  db.transaction((tx) => {
    tx.update(versions).set({ selected: false }).where(eq(versions.runId, runId)).run();
    tx.update(versions).set({ selected: true }).where(eq(versions.id, versionId)).run();
  });
}

export function updateVersionEvaluation(
  versionId: string,
  evaluation: EvaluationResult,
): void {
  db.update(versions)
    .set({ evaluation })
    .where(eq(versions.id, versionId))
    .run();
}

export function getRunVersions(runId: string): MediaVersion[] {
  return db
    .select()
    .from(versions)
    .where(eq(versions.runId, runId))
    .orderBy(asc(versions.versionNumber))
    .all()
    .map((version) => ({
      id: version.id,
      runId: version.runId,
      versionNumber: version.versionNumber,
      artifacts: (version.artifacts ?? []) as MediaArtifact[],
      evaluation: version.evaluation as EvaluationResult | null,
      selected: version.selected,
      createdAt: version.createdAt,
    }));
}
