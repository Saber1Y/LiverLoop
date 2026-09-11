import type { MediaArtifactType } from "../domain/media";
import { MAX_ITERATIONS, type ProductionPlan, type PlanStep } from "../domain/plan";
import { updateRun, getRun } from "../ledger/runs";
import { recordEvent } from "../ledger/events";
import {
  createVersion,
  getRunVersions,
  setSelectedVersion,
  updateVersionEvaluation,
} from "../ledger/versions";
import { getCapabilities, classifyCapability } from "../livepeer/capabilities";
import { runMediaJob } from "../livepeer/jobs";
import type { LivepeerCapability } from "../livepeer/types";
import { aggregateEvaluations, evaluateArtifact } from "./critic";
import { createProductionPlan, directorDecide } from "./director";
import { getPublishedKnowledgeAssets } from "../knowledge/repository";
import { retrieveKnowledgeAsset } from "../dkg/retrieve";
import { finalizeRunKnowledge } from "../knowledge/publisher";
import type { MediaRunKnowledgeAsset } from "../domain/knowledge";

type StepArtifact = {
  stepId: string;
  type: MediaArtifactType;
  url: string;
  capability: string;
  purpose: string;
  metadata: Record<string, unknown>;
};

function artifactTypeFor(
  outputKind: string | undefined,
  capability: LivepeerCapability | undefined,
): MediaArtifactType {
  if (outputKind === "image" || outputKind === "video" || outputKind === "audio") {
    return outputKind;
  }
  const type = capability ? classifyCapability(capability) : "video";
  if (type === "image" || type === "audio") return type;
  return "video";
}

function buildStepPrompt(
  step: PlanStep,
  brief: Record<string, unknown>,
): string {
  return [
    step.purpose,
    `Creative brief: ${JSON.stringify(brief)}`,
    "Preserve the requested format, duration, audience, style, and CTA where applicable.",
  ].join("\n");
}

function normalizeCapabilityInputs(
  step: PlanStep,
): Record<string, unknown> {
  const inputs = { ...step.params };
  if (step.capability === "ltx-25-i2v-fast" && typeof inputs.camera_motion === "string") {
    const allowed = new Set([
      "dolly_in",
      "dolly_out",
      "dolly_left",
      "dolly_right",
      "jib_up",
      "jib_down",
      "static",
      "focus_shift",
    ]);
    if (!allowed.has(inputs.camera_motion)) inputs.camera_motion = "dolly_in";
  }
  if (step.capability === "ffmpeg-burn-subtitles") {
    for (const key of ["cues", "inline_cues"]) {
      const cues = inputs[key];
      if (!Array.isArray(cues)) continue;
      inputs[key] = cues.map((cue) => {
        if (!cue || typeof cue !== "object") return cue;
        const item = cue as Record<string, unknown>;
        return {
          ...item,
          start_sec: item.start_sec ?? item.start,
          end_sec: item.end_sec ?? item.end,
        };
      });
    }
  }
  return inputs;
}

async function executeSteps(params: {
  runId: string;
  plan: ProductionPlan;
  capabilities: LivepeerCapability[];
  stepsToRun: PlanStep[];
  existing: Map<string, StepArtifact>;
}): Promise<{ artifacts: StepArtifact[]; cost: number }> {
  const artifacts = new Map(params.existing);
  let cost = 0;

  for (const step of params.stepsToRun) {
    const capability = params.capabilities.find((item) => item.name === step.capability);
    if (!capability) {
      throw new Error(`Livepeer capability is no longer available: ${step.capability}`);
    }

    recordEvent({
      runId: params.runId,
      type: "CAPABILITY_SELECTED",
      data: { stepId: step.id, capability: step.capability, purpose: step.purpose },
    });

    const sourceArtifact = step.inputRefs
      .map((inputRef) => artifacts.get(inputRef))
      .find((artifact) => artifact?.url);
    const mediaType = classifyCapability(capability);
    recordEvent({
      runId: params.runId,
      type: "JOB_STARTED",
      data: { stepId: step.id, capability: step.capability },
    });

    const result = await runMediaJob({
      capability: step.capability,
      prompt: buildStepPrompt(step, params.plan.constraints),
      sourceUrl: sourceArtifact?.url,
      inputs: normalizeCapabilityInputs(step),
      async: (mediaType === "video" || mediaType === "audio")
        && Number(params.plan.constraints.duration ?? 0) > 10,
      timeout: mediaType === "image" ? 90 : 900,
      maxWaitMs: 10 * 60 * 1000,
    });

    if (!result.ok || !result.outputUrl) {
      throw new Error(result.error ?? `Livepeer did not return an artifact for ${step.id}`);
    }

    const stepArtifact: StepArtifact = {
      stepId: step.id,
      type: artifactTypeFor(result.output_kind, capability),
      url: result.outputUrl,
      capability: step.capability,
      purpose: step.purpose,
      metadata: {
        costUsd: result.cost_usd_estimated ?? 0,
        outputKind: result.output_kind,
        livepeer: true,
      },
    };
    artifacts.set(step.id, stepArtifact);
    cost += result.cost_usd_estimated ?? 0;
    recordEvent({
      runId: params.runId,
      type: "JOB_COMPLETED",
      data: { stepId: step.id, capability: step.capability, costUsd: result.cost_usd_estimated ?? 0 },
    });
    recordEvent({
      runId: params.runId,
      type: "ARTIFACT_CREATED",
      data: { stepId: step.id, url: result.outputUrl, type: stepArtifact.type },
    });
  }

  return { artifacts: [...artifacts.values()], cost };
}

function versionInput(runId: string, artifacts: StepArtifact[]) {
  return {
    runId,
    artifacts: artifacts.map((artifact) => ({
      type: artifact.type,
      url: artifact.url,
      capability: artifact.capability,
      purpose: artifact.purpose,
      metadata: { ...artifact.metadata, stepId: artifact.stepId },
    })),
  };
}

export async function executeRun(runId: string): Promise<void> {
  const run = getRun(runId);
  if (!run) throw new Error(`Run ${runId} was not found`);

  try {
    const capabilities = await getCapabilities();
    const priorKnowledge: MediaRunKnowledgeAsset[] = [];
    const storedKnowledge = getPublishedKnowledgeAssets().filter(
      (asset) => asset.content.project === (run.projectId ?? "liverloop"),
    );
    for (const stored of storedKnowledge) {
      if (!stored.ual) continue;
      try {
        const retrieved = await retrieveKnowledgeAsset(stored.ual);
        priorKnowledge.push(retrieved);
        recordEvent({ runId, type: "KNOWLEDGE_RETRIEVED", data: { ual: stored.ual, lessons: retrieved.lessons } });
      } catch (error) {
        recordEvent({
          runId,
          type: "KNOWLEDGE_RETRIEVED",
          data: { ual: stored.ual, status: "failed", error: error instanceof Error ? error.message : "Retrieval failed" },
        });
      }
    }
    updateRun(run.id, { status: "planning" });
    const { plan } = await createProductionPlan({
      brief: run.brief,
      capabilities,
      knowledge: priorKnowledge,
    });
    recordEvent({ runId, type: "PLAN_CREATED", data: { plan } });

    let totalCost = 0;
    const currentPlan = plan;
    let existing = new Map<string, StepArtifact>();
    let finalVersionId: string | null = null;

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
      updateRun(run.id, {
        status: iteration === 1 ? "generating" : "improving",
        currentVersion: iteration,
      });
      if (iteration > 1) {
        recordEvent({ runId, type: "RETRY_STARTED", versionNumber: iteration, data: { iteration } });
      }

      const stepsToRun = iteration === 1
        ? currentPlan.steps
        : currentPlan.steps.filter((step) => !existing.has(step.id));
      const executed = await executeSteps({
        runId,
        plan: currentPlan,
        capabilities,
        stepsToRun,
        existing,
      });
      existing = new Map(executed.artifacts.map((artifact) => [artifact.stepId, artifact]));
      totalCost += executed.cost;
      updateRun(run.id, { totalCost });

      const version = createVersion({
        ...versionInput(runId, executed.artifacts),
        versionNumber: iteration,
      });
      recordEvent({ runId, versionNumber: iteration, type: "VERSION_CREATED", data: { versionId: version.id } });
      updateRun(run.id, { status: "evaluating" });
      recordEvent({ runId, versionNumber: iteration, type: "EVALUATION_STARTED", data: {} });

      const evaluations = [];
      for (const artifact of version.artifacts) {
        evaluations.push(await evaluateArtifact({
          brief: run.brief,
          artifact,
          artifactDescription: `Step ${artifact.metadata.stepId ?? "unknown"} produced this real Livepeer artifact for the stated purpose: ${artifact.purpose}`,
        }));
      }
      const evaluation = aggregateEvaluations(evaluations);
      updateVersionEvaluation(version.id, evaluation);
      recordEvent({
        runId,
        versionNumber: iteration,
        type: "EVALUATION_COMPLETED",
        data: { evaluation },
      });

      if (evaluation.decision === "pass" || iteration === MAX_ITERATIONS) {
        setSelectedVersion(runId, version.id);
        finalVersionId = version.id;
        recordEvent({ runId, versionNumber: iteration, type: "FINAL_VERSION_SELECTED", data: { versionId: version.id, evaluation } });
        break;
      }

      const decision = await directorDecide({
        steps: currentPlan.steps.map((step) => ({ id: step.id, capability: step.capability })),
        evaluation,
        versionNumber: iteration,
        capabilityCosts: capabilities,
        iterationCosts: Object.fromEntries(
          version.artifacts.map((artifact) => [artifact.capability, Number(artifact.metadata.costUsd ?? 0)]),
        ),
      });
      recordEvent({ runId, versionNumber: iteration, type: "DIRECTOR_DECISION", data: { decision } });

      if (decision.action === "abandon" || decision.action === "pass") {
        setSelectedVersion(runId, version.id);
        finalVersionId = version.id;
        break;
      }

      existing = new Map(
        executed.artifacts
          .filter((artifact) => decision.stepsToKeep.includes(artifact.stepId))
          .map((artifact) => [artifact.stepId, artifact]),
      );
    }

    if (!finalVersionId) throw new Error("Run completed without a selected version");
    updateRun(run.id, { status: "completed" });
    recordEvent({ runId, type: "RUN_COMPLETED", data: { finalVersionId, totalCost } });

    try {
      const finalVersions = getRunVersions(runId);
      const finalVersion = finalVersions.find((version) => version.id === finalVersionId);
      if (!finalVersion) throw new Error("Selected final version could not be loaded.");
      recordEvent({ runId, type: "KNOWLEDGE_EXTRACTED", data: { version: finalVersion.versionNumber } });
      const knowledge = await finalizeRunKnowledge({
        run,
        versions: finalVersions,
        finalVersionNumber: finalVersion.versionNumber,
      });
      recordEvent({
        runId,
        type: "KNOWLEDGE_PUBLISHED",
        data: { status: knowledge.publication.status, ual: knowledge.publication.ual, network: knowledge.publication.network, error: knowledge.publication.error },
      });
    } catch (error) {
      recordEvent({
        runId,
        type: "KNOWLEDGE_PUBLISHED",
        data: { status: "failed", error: error instanceof Error ? error.message : "Knowledge publication failed" },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown run failure";
    updateRun(run.id, { status: "failed" });
    recordEvent({ runId, type: "RUN_FAILED", data: { message } });
    throw error;
  }
}

export function getRunSnapshot(runId: string) {
  return {
    run: getRun(runId),
    versions: getRunVersions(runId),
  };
}
