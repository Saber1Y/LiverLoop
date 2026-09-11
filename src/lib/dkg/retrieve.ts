import { MediaRunKnowledgeAsset } from "../domain/knowledge";
import { getDkgClient } from "./client";
import type { PublicKnowledgeAsset } from "./types";

function contentFromResponse(response: Record<string, unknown>): Record<string, unknown> {
  const publicContent = response.public;
  if (publicContent && typeof publicContent === "object") {
    return publicContent as Record<string, unknown>;
  }
  const assertion = response.assertion;
  if (assertion && typeof assertion === "object") {
    const nested = (assertion as Record<string, unknown>).public;
    if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  }
  return response;
}

export async function retrieveKnowledgeAsset(
  ual: string,
): Promise<PublicKnowledgeAsset> {
  const result = await getDkgClient().asset.get(ual, { contentType: "public" });
  const content = contentFromResponse(result);
  const asset = MediaRunKnowledgeAsset.parse({
    type: "MediaRunKnowledgeAsset",
    project: String(content.project ?? ""),
    run: String(content.run ?? ""),
    brief: content.brief,
    iterations: content.iterations ?? [],
    finalVersion: String(content.finalVersion ?? ""),
    lessons: content.lessons ?? [],
    ual,
  });

  return {
    ...asset,
    sourceReferences: Array.isArray(content.sourceReferences) ? content.sourceReferences.map(String) : [],
    generationHistory: Array.isArray(content.generationHistory)
      ? content.generationHistory.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : [],
    transformationHistory: Array.isArray(content.transformationHistory)
      ? content.transformationHistory.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : [],
    decisionRationale: String(content.decisionRationale ?? ""),
  };
}

export async function queryKnowledgeByProject(project: string): Promise<unknown> {
  const escaped = project.replaceAll('"', '\\"');
  return getDkgClient().graph.query(
    `PREFIX ll: <https://liverloop.media/ontology/>\nSELECT ?asset ?run ?finalVersion WHERE { ?asset ll:project "${escaped}" . ?asset ll:run ?run . ?asset ll:finalVersion ?finalVersion . }`,
    "SELECT",
  );
}
