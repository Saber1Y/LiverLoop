import type { Run } from "../domain/run";
import type { MediaVersion } from "../domain/media";
import { publishKnowledgeAsset } from "../dkg/publish";
import { extractRunKnowledge } from "./extractor";
import { saveKnowledgeAsset } from "./repository";

export async function finalizeRunKnowledge(params: {
  run: Run;
  versions: MediaVersion[];
  finalVersionNumber: number;
}) {
  const extracted = await extractRunKnowledge(params);
  const publication = await publishKnowledgeAsset(extracted);
  const content = {
    ...extracted,
    ual: publication.ual,
    publishedAt: publication.status === "published" ? new Date().toISOString() : undefined,
    network: publication.network,
  };
  const stored = saveKnowledgeAsset({
    runId: params.run.id,
    content,
    ual: publication.ual,
    network: publication.network,
    status: publication.status === "published" ? "published" : "failed",
  });
  return { publication, stored };
}
