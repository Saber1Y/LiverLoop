import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db/client";
import { knowledgeAssets } from "../db/schema";
import type { MediaRunKnowledgeAsset } from "../domain/knowledge";

export type StoredKnowledgeAsset = {
  id: string;
  runId: string;
  content: MediaRunKnowledgeAsset;
  ual: string | null;
  network: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
};

export function saveKnowledgeAsset(params: {
  runId: string;
  content: MediaRunKnowledgeAsset;
  ual?: string;
  network?: string;
  status: "pending" | "published" | "failed";
}): StoredKnowledgeAsset {
  const row = {
    id: nanoid(12),
    runId: params.runId,
    content: params.content,
    ual: params.ual ?? null,
    network: params.network ?? null,
    status: params.status,
    publishedAt: params.status === "published" ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
  };
  db.insert(knowledgeAssets).values(row).run();
  return row;
}

export function getKnowledgeAssetsForProject(projectId: string | null): StoredKnowledgeAsset[] {
  if (!projectId) return [];
  return db.select().from(knowledgeAssets)
    .where(eq(knowledgeAssets.network, projectId))
    .orderBy(desc(knowledgeAssets.createdAt))
    .all()
    .map((row) => ({
      id: row.id,
      runId: row.runId,
      content: row.content as MediaRunKnowledgeAsset,
      ual: row.ual,
      network: row.network,
      status: row.status,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
    }));
}

export function getPublishedKnowledgeAssets(): StoredKnowledgeAsset[] {
  return db.select().from(knowledgeAssets)
    .where(eq(knowledgeAssets.status, "published"))
    .orderBy(desc(knowledgeAssets.createdAt))
    .all()
    .map((row) => ({
      id: row.id,
      runId: row.runId,
      content: row.content as MediaRunKnowledgeAsset,
      ual: row.ual,
      network: row.network,
      status: row.status,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
    }));
}
