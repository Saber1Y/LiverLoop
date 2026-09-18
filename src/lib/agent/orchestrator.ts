import type { MediaArtifact, MediaArtifactType } from "../domain/media";
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
import { inspectArtifactUrl, expectedTypeForInspection, type MediaInspection } from "../media/inspect";
import { getCapabilityContract } from "../livepeer/contracts";
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
  if (capability?.name === "ffmpeg-audio-mix") return "audio";
  if (capability?.name === "ffmpeg-mux" || capability?.name === "ffmpeg-burn-subtitles" || capability?.name === "ffmpeg-concat") return "video";
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
  constraints: Record<string, unknown> = {},
): Record<string, unknown> {
  const contract = getCapabilityContract(step.capability);
  const inputs: Record<string, unknown> = {};
  if (contract) {
    const allowed = new Set(Object.keys(contract.params));
    for (const [key, value] of Object.entries(step.params)) {
      if (allowed.has(key) && value !== undefined && value !== null) inputs[key] = value;
    }
  } else {
    Object.assign(inputs, step.params);
  }
  if (/^ltx-25-(i2v|t2v)-fast$/.test(step.capability) && !inputs.resolution) {
    inputs.resolution = "720p";
  }
  if (/tts|-tts$|chatterbox/i.test(step.capability) && typeof inputs.text === "string" && !inputs.prompt) {
    inputs.prompt = inputs.text;
    delete inputs.text;
  }
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
    if (inputs.position === "bottom-center" || inputs.position === "bottom_center") inputs.position = "bottom";
    if (inputs.position === "top-center" || inputs.position === "top_center") inputs.position = "top";
    const cues = Array.isArray(inputs.cues)
      ? inputs.cues
      : inputs.inline_cues ?? (typeof inputs.cue === "string"
        ? [{ text: inputs.cue, start: inputs.start, end: inputs.end }]
        : undefined);
    if (Array.isArray(cues)) {
      inputs.cues = cues.map((cue) => {
        if (typeof cue === "string") {
          return { text: cue, start_sec: 17, end_sec: 20 };
        }
        if (!cue || typeof cue !== "object") return cue;
        const item = cue as Record<string, unknown>;
        return {
          text: item.text,
          start_sec: item.start_sec ?? item.start,
          end_sec: item.end_sec ?? item.end,
        };
      });
    }
    if (!inputs.srt_url && (!Array.isArray(inputs.cues) || inputs.cues.length === 0)) {
      const text = typeof constraints.cta === "string" && constraints.cta.trim()
        ? constraints.cta.trim()
        : "Learn more";
      const duration = typeof constraints.duration === "number" ? constraints.duration : 20;
      inputs.cues = [{ text, start_sec: Math.max(0, duration - 3), end_sec: duration }];
    }
    delete inputs.inline_cues;
    delete inputs.cue;
    delete inputs.start;
    delete inputs.end;
    delete inputs.font;
  }
  return inputs;
}

function multiInputInputs(
  step: PlanStep,
  artifacts: StepArtifact[],
  constraints: Record<string, unknown>,
): Record<string, unknown> {
  const inputs = normalizeCapabilityInputs(step, constraints);
  const urls = artifacts.filter((artifact) => artifact.url).map((artifact) => artifact.url);
  if (step.capability === "ffmpeg-audio-mix") {
    inputs.tracks = urls;
  } else if (step.capability === "ffmpeg-mux") {
    const video = artifacts.find((artifact) => artifact.type === "video");
    const audio = artifacts.find((artifact) => artifact.type === "audio");
    if (video) inputs.video_url = video.url;
    if (audio) inputs.audio_url = audio.url;
  } else if (step.capability === "ffmpeg-concat") {
    const clips = artifacts
      .filter((artifact) => artifact.type === "video" && artifact.url)
      .map((artifact) => artifact.url);
    inputs.clips = clips.length >= 2 ? clips : urls;
  }
  return inputs;
}

function executionInputs(step: PlanStep, artifacts: Map<string, StepArtifact>) {
  const inputArtifacts = step.inputRefs
    .map((inputRef) => artifacts.get(inputRef))
    .filter((artifact): artifact is StepArtifact => Boolean(artifact?.url));
  const sourceArtifact = inputArtifacts.find(
    (artifact) => artifact.url && (step.capability !== "ltx-25-i2v-fast" || artifact.type === "image"),
  );
  return { inputArtifacts, sourceArtifact };
}

function planBatches(steps: PlanStep[]): PlanStep[][] {
  const depth = new Map<string, number>();
  for (const step of steps) {
    let d = 1;
    for (const ref of step.inputRefs) {
      const refDepth = depth.get(ref);
      if (refDepth !== undefined) d = Math.max(d, refDepth + 1);
    }
    depth.set(step.id, d);
  }
  const groups = new Map<number, PlanStep[]>();
  for (const step of steps) {
    const d = depth.get(step.id)!;
    const group = groups.get(d) ?? [];
    group.push(step);
    groups.set(d, group);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, group]) => group);
}

async function executeSteps(params: {
  runId: string;
  plan: ProductionPlan;
  capabilities: LivepeerCapability[];
  stepsToRun: PlanStep[];
  existing: Map<string, StepArtifact>;
}): Promise<{ artifacts: StepArtifact[]; cost: number }> {
  const artifacts = new Map(params.existing);

  const runStep = async (step: PlanStep): Promise<StepArtifact> => {
    let executionStep = step;
    let capability = params.capabilities.find((item) => item.name === step.capability);
    if (!capability) {
      throw new Error(`Livepeer capability is no longer available: ${step.capability}`);
    }

    const { inputArtifacts, sourceArtifact } = executionInputs(step, artifacts);

    if (step.capability === "ltx-25-i2v-fast" && sourceArtifact?.type !== "image") {
      const fallback = params.capabilities.find((item) => item.name === "ltx-25-t2v-fast");
      if (!fallback) {
        throw new Error("Image-to-video requires an image input, and no text-to-video fallback is available.");
      }
      executionStep = { ...step, capability: fallback.name };
      capability = fallback;
    }

    if (step.capability === "ffmpeg-audio-mix" && inputArtifacts.some((artifact) => artifact.type === "video") && inputArtifacts.some((artifact) => artifact.type === "audio")) {
      const fallback = params.capabilities.find((item) => item.name === "ffmpeg-mux");
      if (!fallback) {
        throw new Error("Combining video and audio requires ffmpeg-mux, which is not available.");
      }
      executionStep = { ...step, capability: fallback.name };
      capability = fallback;
    }

    if (executionStep.capability === "ffmpeg-mux") {
      const hasVideo = inputArtifacts.some((artifact) => artifact.type === "video");
      const hasAudio = inputArtifacts.some((artifact) => artifact.type === "audio");
      if (!hasVideo || !hasAudio) {
        const actual = inputArtifacts.map((artifact) => `${artifact.stepId}:${artifact.type}`).join(", ");
        throw new Error(
          hasVideo && !hasAudio
            ? "ffmpeg-mux requires an audio artifact alongside the video, but the referenced audio artifact is not actually audio. Cancelling to avoid producing an audio-only result."
            : `ffmpeg-mux requires one video artifact and one audio artifact. Referenced artifacts: ${actual || "none"}`,
        );
      }
    }
    if (executionStep.capability === "ffmpeg-burn-subtitles" && sourceArtifact?.type !== "video") {
      throw new Error(`ffmpeg-burn-subtitles requires a video artifact as its input, but the referenced artifact is ${sourceArtifact?.type ?? "missing"}.`);
    }
    if (executionStep.capability === "ffmpeg-concat" && inputArtifacts.some((artifact) => artifact.type !== "video")) {
      const actual = inputArtifacts.map((artifact) => `${artifact.stepId}:${artifact.type}`).join(", ");
      throw new Error(`ffmpeg-concat requires video-only inputs, but referenced artifacts are: ${actual}`);
    }

    recordEvent({
      runId: params.runId,
      type: "CAPABILITY_SELECTED",
      data: {
        stepId: step.id,
        capability: executionStep.capability,
        requestedCapability: step.capability !== executionStep.capability ? step.capability : undefined,
        purpose: step.purpose,
      },
    });

    const mediaType = classifyCapability(capability);
    recordEvent({
      runId: params.runId,
      type: "JOB_STARTED",
      data: { stepId: step.id, capability: executionStep.capability },
    });

    const result = await runMediaJob({
      capability: executionStep.capability,
      prompt: buildStepPrompt(executionStep, params.plan.constraints),
      sourceUrl: sourceArtifact?.url,
      inputs: multiInputInputs(executionStep, inputArtifacts, params.plan.constraints),
      async: mediaType === "video" || mediaType === "audio",
      timeout: 900,
      maxWaitMs: 10 * 60 * 1000,
    });

    if (!result.ok || !result.outputUrl) {
      throw new Error(result.error ?? `Livepeer did not return an artifact for ${step.id}`);
    }

    const declaredType = artifactTypeFor(result.output_kind, capability);

    let inspection: MediaInspection | null = null;
    try {
      inspection = await inspectArtifactUrl(result.outputUrl);
    } catch (error) {
      recordEvent({
        runId: params.runId,
        type: "MEDIA_INSPECTED",
        data: {
          stepId: step.id,
          ok: false,
          error: error instanceof Error ? error.message : "Media probe failed",
        },
      });
    }

    const realType = inspection
      ? expectedTypeForInspection(declaredType, inspection)
      : declaredType;

    if (inspection?.ok) {
      recordEvent({
        runId: params.runId,
        type: "MEDIA_INSPECTED",
        data: {
          stepId: step.id,
          ok: true,
          declaredType,
          actualType: realType,
          container: inspection.container,
          durationSec: inspection.durationSec,
          width: inspection.width,
          height: inspection.height,
          streams: inspection.streams,
          mismatch: declaredType !== realType,
        },
      });
    }

    const stepArtifact: StepArtifact = {
      stepId: step.id,
      type: realType,
      url: result.outputUrl,
      capability: executionStep.capability,
      purpose: step.purpose,
      metadata: {
        costUsd: result.cost_usd_estimated ?? 0,
        outputKind: result.output_kind,
        livepeer: true,
        mediaInspection: inspection?.ok
          ? {
              container: inspection.container,
              durationSec: inspection.durationSec,
              width: inspection.width,
              height: inspection.height,
              streams: inspection.streams,
            }
          : { ok: false, error: inspection?.error },
      },
    };
    artifacts.set(step.id, stepArtifact);
    recordEvent({
      runId: params.runId,
      type: "JOB_COMPLETED",
      data: { stepId: step.id, capability: executionStep.capability, costUsd: result.cost_usd_estimated ?? 0 },
    });
    recordEvent({
      runId: params.runId,
      type: "ARTIFACT_CREATED",
      data: { stepId: step.id, url: result.outputUrl, type: stepArtifact.type },
    });
    return stepArtifact;
  };

  let cost = 0;
  for (const batch of planBatches(params.stepsToRun)) {
    const results = await Promise.allSettled(batch.map(runStep));
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      const first = failures[0] as PromiseRejectedResult;
      throw first.reason;
    }
    cost += results.reduce(
      (sum, r) => sum + (r.status === "fulfilled" ? (r.value.metadata.costUsd as number | undefined ?? 0) : 0),
      0,
    );
  }

  return { artifacts: [...artifacts.values()], cost };
}

function selectFinalArtifact(
  artifacts: MediaArtifact[],
  plan: { steps: { id: string }[] },
): MediaArtifact | undefined {
  if (plan.steps.length === 0) return undefined;
  const lastStepId = plan.steps[plan.steps.length - 1].id;
  const stepId = (artifact: MediaArtifact): string | undefined =>
    typeof artifact.metadata?.stepId === "string" ? artifact.metadata.stepId : undefined;
  const byLastStep = artifacts.find((artifact) => stepId(artifact) === lastStepId);
  if (byLastStep) return byLastStep;
  const video = artifacts.filter((artifact) => artifact.type === "video");
  const burn = video.find((artifact) => artifact.capability === "ffmpeg-burn-subtitles");
  if (burn) return burn;
  const mux = video.find((artifact) => artifact.capability === "ffmpeg-mux");
  if (mux) return mux;
  return video[video.length - 1];
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
        const retrieved = await retrieveKnowledgeAsset(stored.ual, stored.content.run);
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
      const finalArtifact = selectFinalArtifact(version.artifacts, currentPlan);
      const judged: MediaArtifact[] = finalArtifact ? [finalArtifact] : version.artifacts;
      for (const artifact of judged) {
        const inspection = artifact.metadata?.mediaInspection as
          | { container?: string; durationSec?: number; width?: number; height?: number; streams?: MediaInspection["streams"]; ok?: boolean; error?: string }
          | undefined;
        const verifiedMedia =
          inspection && inspection.ok
            ? `Verified by local media probe: container=${inspection.container ?? "unknown"}, duration=${inspection.durationSec ?? "unknown"}s, dimensions=${inspection.width ?? "?"}x${inspection.height ?? "?"}, streams=[${(inspection.streams ?? []).map((stream) => `${stream.kind}(${stream.codec ?? "?"}${stream.width ? ` ${stream.width}x${stream.height}` : ""})`).join(", ")}].`
            : "No verified media probe evidence (the probe could not be run or returned no streams). Do not assume the artifact contains a specific stream type.";
        evaluations.push(await evaluateArtifact({
          brief: run.brief,
          artifact,
          artifactDescription: `Step ${artifact.metadata.stepId ?? "unknown"} produced this real Livepeer artifact for the stated purpose: ${artifact.purpose}. The artifact is stored as type "${artifact.type}".\n${verifiedMedia}`,
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
