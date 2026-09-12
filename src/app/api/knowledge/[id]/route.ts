import { retrieveKnowledgeAsset } from "@/lib/dkg/retrieve";
import { getKnowledgeAssetById } from "@/lib/knowledge/repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const stored = getKnowledgeAssetById(id);
  if (!stored) return Response.json({ error: "Knowledge asset not found." }, { status: 404 });
  if (!stored.ual) return Response.json({ asset: stored, verification: "unavailable" });

  try {
    const verified = await retrieveKnowledgeAsset(stored.ual, stored.content.run);
    return Response.json({ asset: stored, verified, verification: "verified" });
  } catch (error) {
    return Response.json({
      asset: stored,
      verification: "failed",
      error: error instanceof Error ? error.message : "Knowledge asset verification failed.",
    });
  }
}
