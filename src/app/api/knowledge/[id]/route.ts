import { dkgNetworkFacts, getVerifiedAsset } from "@/lib/dkg/verify";
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

  const facts = dkgNetworkFacts();
  try {
    const verified = await getVerifiedAsset(stored.ual);
    return Response.json({ asset: stored, facts, verified, verification: "verified" });
  } catch (error) {
    return Response.json({
      asset: stored,
      facts,
      verification: "failed",
      error: error instanceof Error ? error.message : "Knowledge asset verification failed.",
    });
  }
}