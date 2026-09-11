import { MediaRunKnowledgeAsset } from "../domain/knowledge";
import { getDkgClient, dkgNetwork } from "./client";
import type { DkgAssetResponse, DkgPublication, PublicKnowledgeAsset } from "./types";

function findTransactionHash(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, nested] of Object.entries(value)) {
    if (key.toLowerCase().includes("transactionhash") && typeof nested === "string") return nested;
    const result = findTransactionHash(nested);
    if (result) return result;
  }
  return undefined;
}

function toPublicJsonLd(asset: PublicKnowledgeAsset): Record<string, unknown> {
  const validated = MediaRunKnowledgeAsset.parse(asset);
  return {
    "@context": {
      schema: "https://schema.org/",
      liverloop: "https://liverloop.media/ontology/",
    },
    "@id": `urn:liverloop:media-run:${validated.run}`,
    "@type": "liverloop:MediaRunKnowledgeAsset",
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
    const result = (await getDkgClient().asset.create(
      { public: toPublicJsonLd(asset) },
      {
        epochsNum: 2,
        minimumNumberOfFinalizationConfirmations: 3,
        minimumNumberOfNodeReplications: 1,
      },
    )) as DkgAssetResponse;

    if (!result.UAL) {
      return {
        status: "failed",
        network,
        datasetRoot: result.datasetRoot,
        error: "OriginTrail completed without returning a UAL.",
      };
    }

    return {
      status: "published",
      network,
      ual: result.UAL,
      datasetRoot: result.datasetRoot,
      transactionHash: findTransactionHash(result.operation),
    };
  } catch (error) {
    return {
      status: "failed",
      network,
      error: error instanceof Error ? error.message : "OriginTrail publication failed.",
    };
  }
}
