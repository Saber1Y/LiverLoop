import { llmJson } from "../llm/client";
import { currentFastModel } from "../llm/client";
import type { ProductionPlan, DirectorDecision } from "../domain/plan";
import { ProductionPlan as ProductionPlanSchema, DirectorDecision as DirectorDecisionSchema } from "../domain/plan";
import type { MediaBrief } from "../domain/run";
import type { MediaRunKnowledgeAsset } from "../domain/knowledge";
import type { MediaArtifactType } from "../domain/media";
import type { LivepeerCapability } from "../livepeer/types";
import { classifyCapability } from "../livepeer/capabilities";
import { getCapabilityContract, resolveContractOutputType, summarizeCapabilityContracts } from "../livepeer/contracts";
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
  video: ["ltx-25-i2v-fast", "ltx-25-t2v-fast", "flux-3-draft-i2v", "ray-32-i2v"],
  audio: ["gemini-tts", "chatterbox-tts", "music", "minimax-music-3"],
  tool: ["ffmpeg-concat", "ffmpeg-burn-subtitles", "ffmpeg-colorgrade"],
};

const COMPOSITION_DIMENSIONS = new Set(["cta", "messaging"]);
const COMPOSITION_ISSUE_KEYWORDS = /(\bcta\b|\blegib\w*|\btext\b|\bspelling\b|\btypo\b|\boverlay\b|\bsupers?\b)/i;
const BAKED_TEXT_KEYWORDS = /(\bbaked[- ]?in\b|\brendered text\b|\bmodel[- ]?generated text\b|\bunwanted text\b|\bcompeting text\b|\bextra text\b|\bstray text\b|\btext in the footage\b|\btext.*(footage|frame|clip)\b)/i;

function isSourceGenerationStep(stepId: string, steps: { id: string; capability: string }[]): boolean {
  const cap = steps.find((s) => s.id === stepId)?.capability;
  if (!cap) return false;
  return !cap.startsWith("ffmpeg");
}

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

export function lessonConflictsWithBrief(lesson: string, brief: MediaBrief): boolean {
  const lower = lesson.toLowerCase();
  const quoted = [...lesson.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]);
  if (brief.cta && quoted.some((q) => q.toLowerCase() !== brief.cta!.toLowerCase())) return true;
  if (brief.duration != null) {
    const durationMatch = lower.match(/(\d+)\s*(?:seconds?|\bsec\b|\bs\b)\b/);
    if (durationMatch && Number(durationMatch[1]) !== brief.duration) return true;
  }
  return false;
}

function dedupeLessons(lessons: string[], brief?: MediaBrief): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const lesson of lessons) {
    const normalized = lesson.toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) continue;
    if (brief && lessonConflictsWithBrief(lesson, brief)) continue;
    if (result.some((existing) => existing.toLowerCase().replace(/\s+/g, " ").includes(normalized.slice(0, 40)))) continue;
    seen.add(normalized);
    result.push(lesson);
    if (result.length >= 10) break;
  }
  return result;
}

export function validatePlanAgainstContracts(
  plan: ProductionPlan,
  capabilities: LivepeerCapability[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const available = new Set(capabilities.map((cap) => cap.name));

  const stepOutputTypes = new Map<string, MediaArtifactType>();
  for (const step of plan.steps) {
    const output = resolveContractOutputType(step.capability);
    if (output) stepOutputTypes.set(step.id, output);
  }

  const targetDuration = typeof plan.constraints.duration === "number" ? plan.constraints.duration : undefined;
  if (targetDuration && targetDuration > 0) {
    const videoGenerators = plan.steps.filter((step) =>
      /^ltx-25-(i2v|t2v)-(fast|pro)$/.test(step.capability),
    );
    if (videoGenerators.length > 0) {
      let nominalTotal = 0;
      for (const step of videoGenerators) {
        const value = step.params.duration;
        if (value === "auto") nominalTotal += 10.3;
        else if (typeof value === "number") nominalTotal += value;
      }
      if (nominalTotal < targetDuration) {
        const combo = (() => {
          if (targetDuration <= 10) return `${Math.ceil(targetDuration / 10) * 10}`;
          if (targetDuration <= 16) return "8 + 8";
          if (targetDuration <= 20) return "10 + 10";
          const count = Math.ceil(targetDuration / 10);
          return Array(count).fill("10").join(" + ");
        })();
        errors.push(
          `Plan under-produces video: generated clip durations sum to ${nominalTotal}s but the brief needs ${targetDuration}s. Clips can only be SHORTENED (ffmpeg-trim cuts, never extends), so the nominal sum must be >= the brief. Use a combination from {6, 8, 10, auto} summing to at least ${targetDuration}s (for a ${targetDuration}s brief, ${combo} works), then finish with ffmpeg-trim params {"start_sec":0,"duration_sec":${targetDuration}} as the FINAL step to land exactly on target.`,
        );
      }
    }
  }

  for (const step of plan.steps) {
    if (!available.has(step.capability)) {
      errors.push(`Step "${step.id}" uses capability "${step.capability}" which is not available on Livepeer.`);
      continue;
    }
    const contract = getCapabilityContract(step.capability);
    if (!contract) continue;

    if (contract.consumes.length > 0 && step.inputRefs.length < contract.consumes.length) {
      errors.push(`Step "${step.id}" (${step.capability}) consumes [${contract.consumes.join(" + ")}] but declares no inputRefs.`);
      continue;
    }
    if (contract.multiInput) {
      if (step.inputRefs.length < 2) {
        errors.push(`Step "${step.id}" (${step.capability}) needs at least 2 inputRefs to join multiple clips.`);
        continue;
      }
      const provided = step.inputRefs.map((r) => stepOutputTypes.get(r) ?? "unknown");
      if (provided.some((t) => !contract.consumes.includes(t as MediaArtifactType))) {
        errors.push(`Step "${step.id}" (${step.capability}) joins [${contract.consumes.join(", ")}] clips but got [${provided.join(", ")}].`);
        continue;
      }
    } else if (step.inputRefs.length > contract.consumes.length) {
      const provided = step.inputRefs.map((r) => stepOutputTypes.get(r) ?? "unknown").join(", ");
      errors.push(
        `Step "${step.id}" (${step.capability}) declares ${step.inputRefs.length} inputRefs but its contract consumes exactly ${contract.consumes.length}: [${contract.consumes.join(" + ")}]. To join multiple clips, add an ffmpeg-concat step before ${step.id}. Inputs provided: [${provided}].`,
      );
      continue;
    } else if (step.inputRefs.length === contract.consumes.length) {
      if (contract.consumes.length > 0) {
        const provided = step.inputRefs.map((r) => stepOutputTypes.get(r) ?? "unknown");
        const mismatches: string[] = [];
        for (let i = 0; i < contract.consumes.length; i += 1) {
          if (contract.consumes[i] !== provided[i]) {
            mismatches.push(`inputRef ${step.inputRefs[i]} (${provided[i]}) does not match expected ${contract.consumes[i]}`);
          }
        }
        if (mismatches.length > 0) {
          errors.push(`Step "${step.id}" (${step.capability}) input type mismatch: ${mismatches.join("; ")}. Use ffmpeg-concat to join multiple video clips before muxing.`);
          continue;
        }
      }
    }

    const allowed = new Set(Object.keys(contract.params));
    const unknownParams = Object.keys(step.params).filter((key) => !allowed.has(key));
    if (unknownParams.length > 0) {
      errors.push(`Step "${step.id}" (${step.capability}) used params not in its contract: ${unknownParams.join(", ")}.`);
    }
    if (step.capability === "ffmpeg-trim") {
      const hasStart = step.params.start_sec !== undefined || step.params.start !== undefined;
      const hasDuration = step.params.duration_sec !== undefined || step.params.duration !== undefined;
      const hasEnd = step.params.end_sec !== undefined;
      if (!hasStart) {
        errors.push(`Step "${step.id}" (${step.capability}) is missing required param "start_sec" (the tool rejects the request without it). Use {"start_sec":0,"duration_sec":${typeof plan.constraints.duration === "number" && plan.constraints.duration > 0 ? plan.constraints.duration : ".."}} as the final trim.`);
      }
      if (!hasDuration && !hasEnd) {
        errors.push(`Step "${step.id}" (${step.capability}) must set exactly one of "duration_sec" or "end_sec".`);
      }
      if (hasDuration && hasEnd) {
        errors.push(`Step "${step.id}" (${step.capability}) set both "duration_sec" and "end_sec"; use exactly one.`);
      }
    }
    for (const [key, spec] of Object.entries(contract.params)) {
      if (!spec.allowed || !(key in step.params)) continue;
      const value = step.params[key];
      if (!spec.allowed.includes(value as string | number)) {
        const accepted = spec.allowed.map((v) => JSON.stringify(v)).join(", ");
        const hint = (() => {
          if (key !== "duration") return "";
          const target = typeof plan.constraints.duration === "number" ? plan.constraints.duration : undefined;
          if (typeof target !== "number") return "";
          const valid = spec.allowed.filter((v) => typeof v === "number") as number[];
          if (valid.length === 0) return "";
          let total = 0;
          while (total < target) total += valid[valid.length - 1];
          return ` For a ${target}-second brief, keep every clip duration in {${accepted}}, choose the combination whose nominal sum is >= ${target}s (clips can only be shortened), then make ffmpeg-trim the FINAL step with params {"start_sec":0,"duration_sec":${target}} to land exactly on target.`;
        })();
        errors.push(
          `Step "${step.id}" (${step.capability}) param "${key}" = ${JSON.stringify(value)} is not accepted; accepted values are: ${accepted}.${hint}`,
        );
      }
    }
  }

  const lastTrimIndex = plan.steps.map((s) => s.capability).lastIndexOf("ffmpeg-trim");
  if (lastTrimIndex >= 0 && lastTrimIndex < plan.steps.length - 1) {
    const encodeAfter = plan.steps.slice(lastTrimIndex + 1).find((s) =>
      ["ffmpeg-mux", "ffmpeg-burn-subtitles", "ffmpeg-concat", "ffmpeg-kenburns"].includes(s.capability),
    );
    if (encodeAfter) {
      errors.push(
        `Step "${encodeAfter.id}" (${encodeAfter.capability}) comes AFTER the ffmpeg-trim step "${plan.steps[lastTrimIndex].id}". A re-encode after the final trim can add ~1ms and push the output over an exact-duration limit. Use the canonical order: clip generation step(s) -> (ffmpeg-concat if multiple clips) -> audio step -> ffmpeg-mux -> ffmpeg-burn-subtitles -> ffmpeg-trim LAST. Every mux/burn/concat step must be BEFORE the trim, so the trim is the absolute final encoding step.`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function createProductionPlan(params: {
  brief: MediaBrief;
  capabilities: LivepeerCapability[];
  knowledge: MediaRunKnowledgeAsset[];
}): Promise<{ plan: ProductionPlan; knowledgeUsed: string[] }> {
  const lessons = dedupeLessons(params.knowledge.flatMap((a) => a.lessons), params.brief);
  let userPrompt = buildPlannerUserPrompt({
    brief: params.brief,
    capabilitiesSummary: summarizeCapabilities(params.capabilities),
    capabilityContracts: summarizeCapabilityContracts(params.capabilities),
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
        model: currentFastModel(),
        system: `${DIRECTOR_SYSTEM_PROMPT}\n\n${schemaHint}`,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 2200,
      });
      const plan = ProductionPlanSchema.parse(raw);
      const contractCheck = validatePlanAgainstContracts(plan, params.capabilities);
      if (!contractCheck.ok) {
        lastError = new Error(contractCheck.errors.join(" "));
        userPrompt = `${userPrompt}\n\nYour previous plan was rejected for these contract violations. Fix ALL of them:\n${contractCheck.errors.map((error) => `- ${error}`).join("\n")}`;
        continue;
      }
      return { plan, knowledgeUsed: plan.knowledgeUsed ?? [] };
    } catch (err) {
      lastError = err as Error;
      if (err instanceof LlmError && !err.retryable) break;
    }
  }
  throw new Error(`Director failed to produce a valid plan after ${MAX_PLAN_ATTEMPTS} attempts: ${lastError?.message}`);
}

export async function directorDecide(params: {
  steps: { id: string; capability: string; purpose?: string; inputRefs?: string[]; params?: Record<string, unknown> }[];
  evaluation: unknown;
  versionNumber: number;
  capabilityCosts: LivepeerCapability[];
  iterationCosts: Record<string, number>;
  constraints?: Record<string, unknown>;
}): Promise<DirectorDecision> {
  const costByCapability = capabilityCostMap(params.steps, params.capabilityCosts);

  let lastError: Error | null = null;
  for (let i = 0; i < MAX_DECISION_ATTEMPTS; i += 1) {
    try {
      const raw = await llmJson<DirectorDecision>({
        model: currentFastModel(),
        system: `${DIRECTOR_CORRECTION_SYSTEM_PROMPT}\n\n${DIRECTOR_CORRECTION_SCHEMA}`,
        user: buildCorrectionUserPrompt({
          planSteps: params.steps,
          evaluation: params.evaluation,
          versionNumber: params.versionNumber,
          iterationCosts: params.iterationCosts,
          constraints: params.constraints,
          capabilitiesSummary: summarizeCapabilityContracts(params.capabilityCosts),
        }),
        temperature: 0.2,
      });
      let decision = DirectorDecisionSchema.parse(raw);
      const validStepIds = new Set(params.steps.map((s) => s.id));
      let redo = decision.stepsToRedo.filter((id) => validStepIds.has(id));

      const evaluation = params.evaluation as { dimensions?: { name?: string; score?: number }[]; issues?: { category?: string; description?: string }[] } | undefined;
      const failedDims = (evaluation?.dimensions ?? []).filter((d) => (d.score ?? 10) < 5);
      const compositionOnly =
        failedDims.length > 0 &&
        failedDims.every((d) => d.name !== undefined && COMPOSITION_DIMENSIONS.has(d.name));
      const hasTextIssue = (evaluation?.issues ?? []).some((issue) =>
        COMPOSITION_ISSUE_KEYWORDS.test(issue.description ?? ""),
      );
      const hasBakedTextIssue = (evaluation?.issues ?? []).some((issue) =>
        issue.category === "baked-text" ||
        BAKED_TEXT_KEYWORDS.test(issue.description ?? ""),
      );

      // Baked-in text is a SOURCE defect: the footage itself contains rendered
      // text that ffmpeg-burn cannot remove. Regenerating the source generation
      // step (with stronger no-text suppression) is the only corrective path, so
      // source steps must stay in redo. Only strip source steps for overlay-style
      // composition defects (small/misplaced CTA) that an assembly step can fix.
      if (hasBakedTextIssue) {
        // The critic demonstrably misses baked-in text (it samples a handful of
        // frames and can read an unlucky frame as the intended CTA), so a "pass"
        // on a baked-text-carrying version is never acceptable: force the action
        // to a retry and guarantee every source step named in a baked-text issue
        // is regenerated. Baked-text issues are emitted by detectBakedTextAcrossPlan
        // with the verbatim source step id quoted in the description.
        const bakedStepIds = new Set(
          (evaluation?.issues ?? [])
            .filter((issue) => issue.category === "baked-text" || BAKED_TEXT_KEYWORDS.test(issue.description ?? ""))
            .flatMap((issue) => [...(issue.description ?? "").matchAll(/"([^"]+)"/g)])
            .map((match) => match[1])
            .filter((stepId) => params.steps.some((step) => step.id === stepId && isSourceGenerationStep(step.id, params.steps))),
        );
        if (bakedStepIds.size > 0) {
          const action = decision.action === "abandon" ? decision.action : "targeted_retry";
          redo = [...new Set([...redo, ...bakedStepIds])];
          decision = { ...decision, action };
        }
      } else if (compositionOnly && hasTextIssue) {
        const surgicalRedo = redo.filter((id) => !isSourceGenerationStep(id, params.steps));
        if (surgicalRedo.length > 0) {
          redo = surgicalRedo;
        } else if (redo.length > 0) {
          const lastStep = params.steps[params.steps.length - 1];
          if (lastStep && !isSourceGenerationStep(lastStep.id, params.steps)) {
            redo = [lastStep.id];
          }
        }
      }

      const keep = params.steps.map((s) => s.id).filter((id) => !redo.includes(id));
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
  fast?: boolean;
}): Promise<{ lessons: string[] }> {
  return llmJson<{ lessons: string[] }>({
    model: params.fast === false ? undefined : currentFastModel(),
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
