import { MediaRunKnowledgeAsset } from "../domain/knowledge";
import { createKnowledgeAsset, dkgNetwork, publishKnowledgeAssetToVm, shareKnowledgeAsset } from "./client";
import type { V10Quad } from "./client";
import type { DkgAssetResponse, DkgPublication, PublicKnowledgeAsset } from "./types";

const LL = "https://liverloop.media/ontology/";
const SCHEMA = "https://schema.org/";

export function knowledgeAssetSubject(run: string): string {
  return `did:dkg:liverloop:media-run:${run}`;
}

export function knowledgeAssetName(run: string): string {
  return `liverloop-media-run-${run}`;
}

export function escapeLiteral(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\t", "\\t");
}

export function unescapeLiteral(value: string): string {
  return value
    .replaceAll("\\t", "\t")
    .replaceAll("\\r", "\r")
    .replaceAll("\\n", "\n")
    .replaceAll('\\"', '"')
    .replaceAll("\\\\", "\\");
}

function toQuads(asset: PublicKnowledgeAsset): V10Quad[] {
  const subject = knowledgeAssetSubject(asset.run);
  const payload = escapeLiteral(JSON.stringify(toPayload(asset)));
  return [
    { subject, predicate: `${LL}project`, object: `"${escapeLiteral(asset.project)}"` },
    { subject, predicate: `${LL}run`, object: `"${escapeLiteral(asset.run)}"` },
    { subject, predicate: `${LL}finalVersion`, object: `"${escapeLiteral(asset.finalVersion)}"` },
    { subject, predicate: `${SCHEMA}additionalType`, object: `"${escapeLiteral(asset.type)}"` },
    ...asset.lessons.map((lesson) => ({
      subject,
      predicate: `${LL}lesson`,
      object: `"${escapeLiteral(lesson)}"`,
    })),
    { subject, predicate: `${LL}payload`, object: `"${payload}"` },
  ];
}

function toPayload(asset: PublicKnowledgeAsset): Record<string, unknown> {
  const validated = MediaRunKnowledgeAsset.parse(asset);
  return {
    "@context": {
      schema: "https://schema.org/",
      liverloop: "https://liverloop.media/ontology/",
    },
    "@id": `urn:liverloop:media-run:${validated.run}`,
    "@type": "liverloop:MediaRunKnowledgeAsset",
    type: validated.type,
    project: validated.project,
    run: validated.run,
    brief: validated.brief,
    iterations: validated.iterations,
    finalVersion: validated.finalVersion,
    lessons: validated.lessons,
    sourceReferences: asset.sourceReferences,
    generationHistory: asset.generationHistory,
    transformationHistory: asset.transformationHistory,
    decisionRationale: asset.decisionRationale,
  };
}

export async function publishKnowledgeAsset(
  asset: PublicKnowledgeAsset,
): Promise<DkgPublication> {
  const network = dkgNetwork();
  try {
    const name = knowledgeAssetName(asset.run);
    const created = await createKnowledgeAsset({ name, quads: toQuads(asset) });
    if (created.status !== "swm-shared" || created.publishReady !== true) {
      await shareKnowledgeAsset({ name });
    }
    const publication = await publishKnowledgeAssetToVm({ name });

    const response: DkgAssetResponse = {
      UAL: publication.ual,
      datasetRoot: typeof created.merkleRoot === "string" ? created.merkleRoot : undefined,
      transactionHash: publication.txHash,
      operation: { ...publication },
    };

    if (!response.UAL) {
      return {
        status: "failed",
        network,
        datasetRoot: response.datasetRoot,
        error: "OriginTrail completed without returning a UAL.",
      };
    }

    return {
      status: "published",
      network,
      ual: response.UAL,
      datasetRoot: response.datasetRoot,
      transactionHash: response.transactionHash,
    };
  } catch (error) {
    return {
      status: "failed",
      network,
      error: error instanceof Error ? error.message : "OriginTrail publication failed.",
    };
  }
}