import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  brief: text("brief", { mode: "json" }).notNull(),
  status: text("status").notNull().default("created"),
  currentVersion: integer("current_version").notNull().default(0),
  totalCost: real("total_cost").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  versionNumber: integer("version_number").notNull(),
  artifacts: text("artifacts", { mode: "json" }).notNull().default("[]"),
  evaluation: text("evaluation", { mode: "json" }),
  selected: integer("selected", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  versionId: text("version_id").notNull(),
  runId: text("run_id").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  capability: text("capability").notNull(),
  purpose: text("purpose"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type RunEventType =
  | "RUN_CREATED"
  | "KNOWLEDGE_RETRIEVED"
  | "PLAN_CREATED"
  | "CAPABILITY_SELECTED"
  | "JOB_STARTED"
  | "JOB_COMPLETED"
  | "ARTIFACT_CREATED"
  | "EVALUATION_STARTED"
  | "EVALUATION_COMPLETED"
  | "ISSUE_DETECTED"
  | "DIRECTOR_DECISION"
  | "RETRY_STARTED"
  | "VERSION_CREATED"
  | "FINAL_VERSION_SELECTED"
  | "KNOWLEDGE_EXTRACTED"
  | "KNOWLEDGE_PUBLISHED"
  | "RUN_COMPLETED"
  | "RUN_FAILED";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  versionNumber: integer("version_number"),
  type: text("type").notNull(),
  data: text("data", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const knowledgeAssets = sqliteTable("knowledge_assets", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  content: text("content", { mode: "json" }).notNull(),
  ual: text("ual"),
  network: text("network"),
  status: text("status").notNull().default("pending"),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
