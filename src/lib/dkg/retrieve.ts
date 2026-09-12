import { MediaRunKnowledgeAsset } from "../domain/knowledge";
import { escapeLiteral, knowledgeAssetSubject, unescapeLiteral } from "./publish";
import { queryContextGraph } from "./client";
import type { PublicKnowledgeAsset } from "./types";

const LL = "https://liverloop.media/ontology/";

type QuadRow = { s: string; p: string; o: string };

function unescapeObject(object: string): string {
  const match = object.match(/^"([\s\S]*)"$/);
  return match ? unescapeLiteral(match[1]) : object;
}

export async function retrieveKnowledgeAsset(
  ual: string,
  run?: string,
): Promise<PublicKnowledgeAsset> {
  const sparql = run
    ? `SELECT ?p ?o WHERE { <${knowledgeAssetSubject(run)}> ?p ?o }`
    : `SELECT ?p ?o WHERE { ?s <${LL}payload> ?o }`;
  const result = await queryContextGraph({ sparql });
  const rows = (result.result.bindings ?? []) as QuadRow[];
  const payload = rows.find((row) => row.p === `${LL}payload`);
  if (!payload) {
    throw new Error(`No DKG content found for ${ual}.`);
  }
  const parsed = JSON.parse(unescapeObject(payload.o)) as Record<string, unknown>;
  const asset = MediaRunKnowledgeAsset.safeParse(parsed);
  if (!asset.success) {
    throw new Error(`Content for ${ual} could not be parsed as a knowledge asset.`);
  }
  return {
    ...asset.data,
    ual,
    sourceReferences: Array.isArray(parsed.sourceReferences) ? parsed.sourceReferences.map(String) : [],
    generationHistory: Array.isArray(parsed.generationHistory)
      ? parsed.generationHistory.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : [],
    transformationHistory: Array.isArray(parsed.transformationHistory)
      ? parsed.transformationHistory.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : [],
    decisionRationale: String(parsed.decisionRationale ?? ""),
  };
}

export async function queryKnowledgeByProject(project: string): Promise<unknown> {
  const escaped = escapeLiteral(project);
  const result = await queryContextGraph({
    sparql: `PREFIX ll: <https://liverloop.media/ontology/>\nSELECT ?asset ?run ?finalVersion WHERE { ?asset ll:project "${escaped}" . ?asset ll:run ?run . ?asset ll:finalVersion ?finalVersion . }`,
  });
  return result.result;
}