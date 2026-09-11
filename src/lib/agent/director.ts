import { llmJson } from "../llm/client";
import type { ProductionPlan, DirectorDecision } from "../domain/plan";
import { ProductionPlan as ProductionPlanSchema, DirectorDecision as DirectorDecisionSchema } from "../domain/plan";
import type { MediaBrief } from "../domain/run";
import type { MediaRunKnowledgeAsset } from "../domain/knowledge";
import type { LivepeerCapability } from "../livepeer/types";
import { classifyCapability } from "../livepeer/capabilities";
import { LlmError } from "../llm/types";
import {
  DIRECTOR_SYSTEM_PROMPT,
  DIRECTOR_PLAN_SCHEMA,
  DIRECTOR_CORRECTION_SYSTEM_PROMPT,
  DIRECTOR_CORRECTION_SCHEMA,
  buildPlannerUserPrompt,
  buildCorrectionUserPrompt,
  buildKnowledgeLessonPrompt,
} from "./prompts";

const MAX_PLAN_ATTEMPTS = 3;
const MAX_DECISION_ATTEMPTS = 3;
const PREFERRED_CAPABILITIES: Record<string, string[]> = {
  image: ["flux-schnell", "ideogram-v4", "flux-dev"],
  video: ["ltx-25-i2v-fast", "ltx-25-t2v-pro", "flux-3-draft-i2v", "ray-32-i2v"],
  audio: ["gemini-tts", "chatterbox-tts", "music", "minimax-music-3"],
  tool: ["ffmpeg-concat", "ffmpeg-burn-subtitles", "ffmpeg-colorgrade"],
};

function summarizeCapabilities(caps: LivepeerCapability[]): string {
  const grouped = new Map<string, LivepeerCapability[]>();
  for (const capability of caps) {
    const type = classifyCapability(capability);
    const group = grouped.get(type) ?? [];
    group.push(capability);
    grouped.set(type, group);
  }

  return [...grouped.entries()]
    .flatMap(([type, group]) => {
      const preferred = PREFERRED_CAPABILITIES[type] ?? [];
      return group
        .sort((a, b) => {
          const aIndex = preferred.indexOf(a.name);
          const bIndex = preferred.indexOf(b.name);
          return (aIndex < 0 ? 100 : aIndex) - (bIndex < 0 ? 100 : bIndex);
        })
        .slice(0, type === "tool" ? 4 : 8);
    })
    .map((c) => {
      const kind = classifyCapability(c);
      const price = c.display_price_usd != null
        ? `$${c.display_price_usd}/${c.display_unit ?? "unit"}`
        : "price unknown";
      const description = c.description ? ` | ${c.description.slice(0, 120)}` : "";
      return `- ${c.name} [${kind}] ${c.model_id}${description} (${price})`;
    })
    .join("\n");
}

function capabilityCostMap(
  steps: { id: string; capability: string }[],
  caps: LivepeerCapability[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const step of steps) {
    const cap = caps.find((c) => c.name === step.capability);
    map[step.capability] = cap?.display_price_usd ?? 0;
  }
  return map;
}

export async function createProductionPlan(params: {
  brief: MediaBrief;
  capabilities: LivepeerCapability[];
  knowledge: MediaRunKnowledgeAsset[];
}): Promise<{ plan: ProductionPlan; knowledgeUsed: string[] }> {
  const lessons = params.knowledge.flatMap((a) => a.lessons);
  const userPrompt = buildPlannerUserPrompt({
    brief: params.brief,
    capabilitiesSummary: summarizeCapabilities(params.capabilities),
    knowledgeLessons: lessons,
  });

  const schemaHint =
    lessons.length > 0
      ? `${DIRECTOR_PLAN_SCHEMA}\n\nKnowledge is available. Incorporate the retrieved lessons into the plan's steps or constraints, and list them in "knowledgeUsed".`
      : DIRECTOR_PLAN_SCHEMA;

  let lastError: Error | null = null;
  for (let i = 0; i < MAX_PLAN_ATTEMPTS; i += 1) {
    try {
      const raw = await llmJson<ProductionPlan>({
        system: `${DIRECTOR_SYSTEM_PROMPT}\n\n${schemaHint}`,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 2400,
      });
      const plan = ProductionPlanSchema.parse(raw);
      return { plan, knowledgeUsed: plan.knowledgeUsed ?? [] };
    } catch (err) {
      lastError = err as Error;
      if (err instanceof LlmError && !err.retryable) break;
    }
  }
  throw new Error(`Director failed to produce a valid plan after ${MAX_PLAN_ATTEMPTS} attempts: ${lastError?.message}`);
}

export async function directorDecide(params: {
  steps: { id: string; capability: string }[];
  evaluation: unknown;
  versionNumber: number;
  capabilityCosts: LivepeerCapability[];
  iterationCosts: Record<string, number>;
}): Promise<DirectorDecision> {
  const costByCapability = capabilityCostMap(params.steps, params.capabilityCosts);

  let lastError: Error | null = null;
  for (let i = 0; i < MAX_DECISION_ATTEMPTS; i += 1) {
    try {
      const raw = await llmJson<DirectorDecision>({
        system: `${DIRECTOR_CORRECTION_SYSTEM_PROMPT}\n\n${DIRECTOR_CORRECTION_SCHEMA}`,
        user: buildCorrectionUserPrompt({
          planSteps: params.steps,
          evaluation: params.evaluation,
          versionNumber: params.versionNumber,
          iterationCosts: params.iterationCosts,
        }),
        temperature: 0.2,
      });
      const decision = DirectorDecisionSchema.parse(raw);
      const validStepIds = new Set(params.steps.map((s) => s.id));
      const redo = decision.stepsToRedo.filter((id) => validStepIds.has(id));
      const keep = decision.stepsToKeep.filter((id) => validStepIds.has(id));

      const costOfRedo = redo.reduce((sum, id) => {
        const cap = params.steps.find((s) => s.id === id)?.capability;
        return sum + (cap ? (costByCapability[cap] ?? 0) : 0);
      }, 0);

      const fullCost = Object.values(costByCapability).reduce((a, b) => a + b, 0);

      return {
        ...decision,
        stepsToRedo: redo,
        stepsToKeep: keep,
        estimatedCost: decision.estimatedCost ?? costOfRedo,
        fullRegenerationCost: decision.fullRegenerationCost ?? fullCost,
      };
    } catch (err) {
      lastError = err as Error;
      if (err instanceof LlmError && !err.retryable) break;
    }
  }
  throw new Error(`Director failed to produce a valid decision after ${MAX_DECISION_ATTEMPTS} attempts: ${lastError?.message}`);
}

export function extractKnowledgeLessons(params: {
  brief: unknown;
  iterations: unknown;
  finalVersionNumber: number;
}): Promise<{ lessons: string[] }> {
  return llmJson<{ lessons: string[] }>({
    system:
      "You are the knowledge extractor for a media production system. You convert completed runs into durable, reusable lessons. Reply ONLY with valid JSON matching { \"lessons\": [...] }.",
    user: buildKnowledgeLessonPrompt({
      brief: params.brief,
      iterations: params.iterations,
      finalVersionNumber: params.finalVersionNumber,
    }),
    temperature: 0.2,
  });
}
