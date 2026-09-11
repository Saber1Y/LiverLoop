import { getPublishedKnowledgeAssets } from "@/lib/knowledge/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ assets: getPublishedKnowledgeAssets() });
}
