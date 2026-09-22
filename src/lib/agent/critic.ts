import { EvaluationResult as EvaluationResultSchema } from "../domain/evaluation";
import type { EvaluationResult } from "../domain/evaluation";
import type { MediaBrief } from "../domain/run";
import type { MediaArtifact, MediaArtifactType } from "../domain/media";
import { llmJson, currentFastModel, currentVisionModel } from "../llm/client";
import type { LlmImagePart } from "../llm/types";
import { LlmError } from "../llm/types";
import { artifactToImageParts } from "../media/frames";
import {
  CRITIC_SCHEMA,
  CRITIC_SYSTEM_PROMPT,
  buildCriticUserPrompt,
} from "./prompts";

const PASS_THRESHOLD = 7.5;
const CRITICAL_THRESHOLD = 5;

function enforceDecision(result: EvaluationResult): EvaluationResult {
  const threshold = result.passThreshold || PASS_THRESHOLD;
  const average = result.dimensions.length > 0
    ? result.dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / result.dimensions.length
    : 0;
  const criticalFailure = result.dimensions.some(
    (dimension) => dimension.score < CRITICAL_THRESHOLD,
  );
  const overall = Math.round(Math.min(10, Math.max(0, average)) * 10) / 10;

  return {
    ...result,
    overall,
    passThreshold: threshold,
    decision: overall >= threshold && !criticalFailure ? "pass" : "fail",
  };
}

async function buildVisualEvidence(artifact: MediaArtifact): Promise<{
  images: LlmImagePart[];
  frameTimes: string[];
  _error?: string;
}> {
  const mediaInspection = artifact.metadata?.mediaInspection as
    | { durationSec?: number }
    | undefined;
  const durationSec = mediaInspection?.durationSec;
  try {
    const { images, labels } = await artifactToImageParts({
      url: artifact.url,
      type: artifact.type,
      durationSec,
      maxFrames: 2,
    });
    return { images, frameTimes: labels };
  } catch (error) {
    return {
      images: [],
      frameTimes: [],
      _error: error instanceof Error ? error.message : "Frame extraction failed",
    };
  }
}

export async function evaluateArtifact(params: {
  brief: MediaBrief;
  artifact: MediaArtifact;
  artifactType?: MediaArtifactType;
  artifactDescription?: string;
}): Promise<EvaluationResult> {
  let lastError: Error | null = null;
  const visualEvidence = await buildVisualEvidence(params.artifact);
  const hasFrames = visualEvidence.images.length > 0;
  const visionFallbackError = visualEvidence._error;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const raw = await llmJson<EvaluationResult>({
        model: hasFrames ? currentVisionModel() : attempt >= 1 ? currentFastModel() : undefined,
        system: `${CRITIC_SYSTEM_PROMPT}\n\n${CRITIC_SCHEMA}`,
        user: buildCriticUserPrompt({
          brief: params.brief,
          artifact: params.artifact,
          artifactType: params.artifactType ?? params.artifact.type,
          artifactUrl: params.artifact.url,
          artifactDescription: visionFallbackError
            ? `${params.artifactDescription ?? ""}\n\nVisual analysis: frame extraction failed (${visionFallbackError}). Visual scores must rely only on verified media metadata.`.trim()
            : params.artifactDescription,
          frameTimes: visualEvidence.frameTimes,
        }),
        images: hasFrames ? visualEvidence.images : undefined,
        temperature: 0.1,
        maxTokens: 1800,
      });
      return enforceDecision(EvaluationResultSchema.parse({
        ...raw,
        passThreshold: raw.passThreshold ?? PASS_THRESHOLD,
      }));
    } catch (error) {
      lastError = error as Error;
      if (error instanceof LlmError && !error.retryable) break;
    }
  }

  throw new Error(`Critic failed to evaluate artifact: ${lastError?.message ?? "unknown error"}`);
}

export function aggregateEvaluations(evaluations: EvaluationResult[]): EvaluationResult {
  if (evaluations.length === 0) {
    return {
      overall: 0,
      dimensions: [],
      issues: [{
        category: "evaluation",
        severity: "high",
        description: "No artifact evaluations were produced.",
      }],
      decision: "fail",
      passThreshold: PASS_THRESHOLD,
    };
  }

  const dimensions = evaluations.flatMap((evaluation) => evaluation.dimensions);
  const issues = evaluations.flatMap((evaluation) => evaluation.issues);
  return enforceDecision({
    overall: 0,
    dimensions,
    issues,
    decision: "fail",
    passThreshold: PASS_THRESHOLD,
  });
}
