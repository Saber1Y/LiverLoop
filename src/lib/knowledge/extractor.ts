import type { Run } from "../domain/run";
import type { MediaVersion } from "../domain/media";
import type { PublicKnowledgeAsset } from "../dkg/types";
import { extractKnowledgeLessons } from "../agent/director";
import { MediaRunKnowledgeAsset } from "../domain/knowledge";

export async function extractRunKnowledge(params: {
  run: Run;
  versions: MediaVersion[];
  finalVersionNumber: number;
}): Promise<PublicKnowledgeAsset> {
  const iterations = params.versions.map((version) => ({
    version: `v${version.versionNumber}`,
    evaluation: Object.fromEntries(
      (version.evaluation?.dimensions ?? []).map((dimension) => [dimension.name, dimension.score]),
    ),
    failure: version.evaluation?.issues.map((issue) => issue.description).join(" ") || undefined,
  }));
  const lessonsResult = await extractKnowledgeLessons({
    brief: params.run.brief,
    iterations,
    finalVersionNumber: params.finalVersionNumber,
  });
  const lessons = lessonsResult.lessons.filter((lesson) => lesson.trim().length > 0).slice(0, 8);
  const selected = params.versions.find((version) => version.versionNumber === params.finalVersionNumber);
  const asset = MediaRunKnowledgeAsset.parse({
    type: "MediaRunKnowledgeAsset",
    project: params.run.projectId ?? "liverloop",
    run: params.run.id,
    brief: params.run.brief,
    iterations,
    finalVersion: `v${params.finalVersionNumber}`,
    lessons,
  });

  return {
    ...asset,
    sourceReferences: selected?.artifacts.map((artifact) => artifact.url) ?? [],
    generationHistory: params.versions.flatMap((version) => version.artifacts.map((artifact) => ({
      version: version.versionNumber,
      capability: artifact.capability,
      purpose: artifact.purpose,
      costUsd: artifact.metadata.costUsd,
    }))),
    transformationHistory: params.versions.map((version) => ({
      version: version.versionNumber,
      selected: version.versionNumber === params.finalVersionNumber,
      evaluation: version.evaluation,
    })),
    decisionRationale: selected?.evaluation
      ? `Selected v${params.finalVersionNumber} with an overall score of ${selected.evaluation.overall}.`
      : `Selected v${params.finalVersionNumber} as the final available version.`,
  };
}
