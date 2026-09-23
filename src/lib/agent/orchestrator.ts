import type { MediaArtifact, MediaArtifactType } from "../domain/media";
import { MAX_ITERATIONS, type DirectorDecision, type ProductionPlan, type PlanStep } from "../domain/plan";
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
import { uploadLivepeerAsset } from "../livepeer/client";
import { renderCtaOverlayPng } from "../media/ctaOverlay";
import type { LivepeerCapability } from "../livepeer/types";
import { inspectArtifactUrl, expectedTypeForInspection, type MediaInspection } from "../media/inspect";
import { getCapabilityContract } from "../livepeer/contracts";
import { aggregateEvaluations, evaluateArtifact } from "./critic";
import { createProductionPlan, directorDecide } from "./director";
import { detectBakedTextAcrossPlan } from "./bakedtext";
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
  if (/^ltx-25-(i2v|t2v)-(fast|pro)$/.test(step.capability)) {
    if (!inputs.resolution) inputs.resolution = "720p";
    if (typeof inputs.prompt === "string") {
      const TEXT_SUPPRESSION =
        "The frame must contain NO text anywhere: no letters, words, captions, subtitles, numbers, logos, badges, labels, banners, watermarks, timestamps, timecodes, camera HUD readouts, UI chrome, or file-name overlays. ALL on-screen text and the call-to-action are added in post-production.";
      if (!inputs.prompt.includes("post-production")) {
        inputs.prompt = `${inputs.prompt.trim()} ${TEXT_SUPPRESSION}`;
      }
    }
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
  if (step.capability === "ffmpeg-trim") {
    if (inputs.start_sec === undefined && inputs.start !== undefined) {
      inputs.start_sec = inputs.start;
    }
    if (inputs.start_sec === undefined) {
      inputs.start_sec = 0;
    }
    delete inputs.start;
    if (inputs.duration_sec === undefined && inputs.duration !== undefined) {
      inputs.duration_sec = inputs.duration;
    }
    delete inputs.duration;
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
      inputs.cues = [{ text, start_sec: Math.max(0, duration - 4), end_sec: Math.max(0.5, duration - 0.1) }];
    }
    if (inputs.font_size === undefined) inputs.font_size = 120;
    if (!inputs.position) inputs.position = "bottom";
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

    // A sub-title burn placed at the TOP is rewritten to an ffmpeg-overlay so the
    // CTA renders as large white text with a dark outline anchored to the top of
    // the frame. ffmpeg-burn-subtitles centers a "top"-positioned cue around the
    // vertical middle of the frame and cannot supply an outline, while
    // ffmpeg-overlay takes x/y placement + start/end timing and preserves audio.
    let overlayInputsOverride: Record<string, unknown> | undefined;
    if (executionStep.capability === "ffmpeg-burn-subtitles" && (sourceArtifact?.type === "video" || sourceArtifact?.type === undefined)) {
      const burnNormalized = normalizeCapabilityInputs(executionStep, params.plan.constraints);
      if (burnNormalized.position === "top") {
        const overlayCap = params.capabilities.find((item) => item.name === "ffmpeg-overlay");
        if (!overlayCap) {
          throw new Error("A TOP-positioned CTA requires ffmpeg-overlay, which is not available on the network.");
        }
        if (!sourceArtifact?.url) {
          throw new Error("ffmpeg-overlay requires a video artifact to composite the CTA onto.");
        }
        const cues = Array.isArray(burnNormalized.cues) ? burnNormalized.cues : [];
        const cue = cues[0] && typeof cues[0] === "object" ? (cues[0] as Record<string, unknown>) : undefined;
        const ctaText =
          (typeof cue?.text === "string" && cue.text.trim()) ||
          (typeof params.plan.constraints.cta === "string" && params.plan.constraints.cta.trim()) ||
          "Learn more";
        const duration = typeof params.plan.constraints.duration === "number" ? params.plan.constraints.duration : 20;
        const startSec = typeof cue?.start_sec === "number" ? cue.start_sec : Math.max(0, duration - 4);
        const endSec = typeof cue?.end_sec === "number" ? cue.end_sec : Math.max(0.5, duration - 0.1);
        const png = renderCtaOverlayPng(ctaText, { fontSize: 180, borderWidth: 12 });
        const overlayUrl = await uploadLivepeerAsset(png, "image/png", `cta-${step.id}.png`);
        const sourceUrl = sourceArtifact.url;
        executionStep = { ...step, capability: "ffmpeg-overlay", params: {} };
        capability = overlayCap;
        overlayInputsOverride = {
          video_url: sourceUrl,
          base_url: sourceUrl,
          source_url: sourceUrl,
          overlay_url: overlayUrl,
          image_url: overlayUrl,
          x: 0.5,
          y: 0.055,
          scale: 0.42,
          start_sec: startSec,
          end_sec: endSec,
        };
      }
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
      inputs: overlayInputsOverride ?? multiInputInputs(executionStep, inputArtifacts, params.plan.constraints),
      async: mediaType === "video" || mediaType === "audio" || Boolean(overlayInputsOverride),
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
  const burn = video.find(
    (artifact) => artifact.capability === "ffmpeg-burn-subtitles" || artifact.capability === "ffmpeg-overlay",
  );
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
    let currentPlan = plan;
    let existing = new Map<string, StepArtifact>();
    let finalVersionId: string | null = null;
    let lastDecision: DirectorDecision | null = null;
    let bestVersion: { id: string; score: number; clean: boolean } | null = null;

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration += 1) {
      updateRun(run.id, {
        status: iteration === 1 ? "generating" : "improving",
        currentVersion: iteration,
      });
      if (iteration > 1) {
        recordEvent({ runId, type: "RETRY_STARTED", versionNumber: iteration, data: { iteration } });
      }

      let stepsToRun: PlanStep[];
      if (iteration === 1) {
        stepsToRun = currentPlan.steps;
      } else {
        stepsToRun = currentPlan.steps.filter((step) => !existing.has(step.id));
        if (lastDecision) {
          const previous = lastDecision;
          if (previous.paramOverrides) {
            stepsToRun = stepsToRun.map((step) => {
              const overrides = previous.paramOverrides[step.id];
              return overrides && Object.keys(overrides).length > 0
                ? { ...step, params: { ...step.params, ...overrides } }
                : step;
            });
          }
          const inserted = (previous.stepsToInsert ?? []).filter(
            (newStep) =>
              newStep.id &&
              !currentPlan.steps.some((step) => step.id === newStep.id) &&
              capabilities.some((cap) => cap.name === newStep.capability) &&
              newStep.inputRefs.every((ref) => currentPlan.steps.some((step) => step.id === ref)),
          );
          if (inserted.length > 0) {
            currentPlan = { ...currentPlan, steps: [...currentPlan.steps, ...inserted] };
            stepsToRun = [...stepsToRun, ...inserted];
            recordEvent({ runId, versionNumber: iteration, type: "STEPS_INSERTED", data: { inserted } });
          }
        }

        // Cascade: any step consuming the output of a step being re-run must also
        // re-run, otherwise the final artifact is assembled from stale upstream output.
        for (let pass = 0; pass < currentPlan.steps.length; pass += 1) {
          const reRunIds = new Set(stepsToRun.map((step) => step.id));
          let added = false;
          for (const step of currentPlan.steps) {
            if (reRunIds.has(step.id)) continue;
            if (step.inputRefs.some((ref) => reRunIds.has(ref))) {
              stepsToRun = [...stepsToRun, step];
              added = true;
            }
          }
          if (!added) break;
        }
      }

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

      // Inspect source generation clips for text baked into the footage,
      // regardless of the critic's verdict. The critic samples only a handful
      // of frames and can read a lucky frame as the intended CTA, so baked-in
      // text can slip past a passing evaluation. Baked text is a SOURCE defect:
      // ffmpeg-burn can only add an overlay, never remove text already rendered
      // into the video, so a passing version with baked text must be downgraded
      // to fail and routed to the director for regeneration. Checks only raw
      // ltx source clips, so the intended burned CTA is never a false positive.
      const bakedTextIssues = await detectBakedTextAcrossPlan({
        runId,
        iteration,
        planSteps: currentPlan.steps,
        artifacts: [...executed.artifacts].map((artifact) => ({
          stepId: artifact.stepId,
          capability: artifact.capability,
          url: artifact.url,
          durationSec: (artifact.metadata.mediaInspection as MediaInspection | undefined)?.durationSec,
        })),
      });
      const hasBakedTextIssue = bakedTextIssues.length > 0;
      const evaluationWithEvidence = hasBakedTextIssue
        ? { ...evaluation, decision: "fail", issues: [...evaluation.issues, ...bakedTextIssues] }
        : evaluation;

      const candidate = {
        id: version.id,
        score: evaluation.overall,
        clean: !hasBakedTextIssue,
      };
      if (
        !bestVersion ||
        candidate.score > bestVersion.score ||
        (candidate.score === bestVersion.score && candidate.clean && !bestVersion.clean)
      ) {
        bestVersion = candidate;
      }

      if (evaluationWithEvidence.decision === "pass") {
        setSelectedVersion(runId, version.id);
        finalVersionId = version.id;
        recordEvent({ runId, versionNumber: iteration, type: "FINAL_VERSION_SELECTED", data: { versionId: version.id, evaluation } });
        break;
      }

      if (iteration === MAX_ITERATIONS) {
        const selectedId = bestVersion?.id ?? version.id;
        setSelectedVersion(runId, selectedId);
        finalVersionId = selectedId;
        recordEvent({
          runId,
          versionNumber: iteration,
          type: "FINAL_VERSION_SELECTED",
          data: {
            versionId: selectedId,
            evaluation,
            bestScore: bestVersion?.score,
            reason: "budget-exhausted",
          },
        });
        break;
      }

      const decision = await directorDecide({
        steps: currentPlan.steps.map((step) => ({
          id: step.id,
          capability: step.capability,
          purpose: step.purpose,
          inputRefs: step.inputRefs,
          params: step.params,
        })),
        evaluation: evaluationWithEvidence,
        versionNumber: iteration,
        capabilityCosts: capabilities,
        iterationCosts: Object.fromEntries(
          version.artifacts.map((artifact) => [artifact.capability, Number(artifact.metadata.costUsd ?? 0)]),
        ),
        constraints: currentPlan.constraints,
      });
      lastDecision = decision;
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
