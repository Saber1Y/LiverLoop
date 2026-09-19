import { llmComplete, currentVisionModel } from "../llm/client";
import { sampleVideoFrames } from "../media/frames";
import { recordEvent } from "../ledger/events";
import type { EvaluationIssue } from "../domain/evaluation";

const MAX_CHECK_FRAMES = 3;
const NO_TEXT_MARKER = "NO_TEXT";
const SOURCE_GENERATION_CAPABILITY = /^ltx-25-(i2v|t2v)-(fast|pro)$/;

const CHECK_SYSTEM_PROMPT =
  "You are a video-content forensics tool. Video can contain text baked into the generated footage (unwanted) or burned in afterward (intended overlay). Your job is to report only text that is RENDERED INTO THE FOOTAGE itself.";

const CHECK_USER_PROMPT = `Inspect the attached video frames.

Report VERBATIM every piece of text that is part of the footage itself: letters, words, numbers, phrases, labels, logos, badges, captions, subtitles, watermarks, timestamps, or title cards visible in any frame.

If NO text of any kind is visible in any frame, reply with exactly: ${NO_TEXT_MARKER}

Do not describe the scene. Do not mention objects that merely resemble text. Output only the quoted text lines or the marker.`;

export type BakedTextFinding = {
  hasBakedText: boolean;
  textFound: string[];
};

export async function detectBakedTextInVideo(params: {
  url: string;
  durationSec?: number;
}): Promise<BakedTextFinding> {
  const frames = await sampleVideoFrames(params.url, params.durationSec ?? 10);
  if (frames.length === 0) {
    return { hasBakedText: false, textFound: [] };
  }
  const images = frames.slice(0, MAX_CHECK_FRAMES).map((frame) => ({ dataUrl: frame.dataUrl }));

  const response = await llmComplete({
    model: currentVisionModel(),
    system: CHECK_SYSTEM_PROMPT,
    user: CHECK_USER_PROMPT,
    images,
    temperature: 0,
    maxTokens: 400,
  });

  const content = (response.content ?? "").trim();
  if (!content || content.toUpperCase() === NO_TEXT_MARKER) {
    return { hasBakedText: false, textFound: [] };
  }
  const textFound = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^(frame|clip|none|no text|"|')$/i.test(line));
  return { hasBakedText: textFound.length > 0, textFound };
}

type SourceClipArtifact = {
  stepId: string;
  capability: string;
  url: string;
  durationSec?: number;
};

export async function detectBakedTextAcrossPlan(params: {
  runId: string;
  iteration: number;
  planSteps: { id: string; capability: string; inputRefs?: string[] }[];
  artifacts: SourceClipArtifact[];
}): Promise<EvaluationIssue[]> {
  const issues: EvaluationIssue[] = [];
  const byStepId = new Map(params.artifacts.map((artifact) => [artifact.stepId, artifact]));

  const sourceSteps = params.planSteps.filter((step) =>
    SOURCE_GENERATION_CAPABILITY.test(step.capability),
  );
  if (sourceSteps.length === 0) return issues;

  for (const step of sourceSteps) {
    const artifact = byStepId.get(step.id);
    if (!artifact?.url) continue;
    let finding;
    try {
      finding = await detectBakedTextInVideo({ url: artifact.url, durationSec: artifact.durationSec });
    } catch {
      continue;
    }
    if (!finding.hasBakedText || finding.textFound.length === 0) continue;

    recordEvent({
      runId: params.runId,
      versionNumber: params.iteration,
      type: "BAKED_TEXT_DETECTED",
      data: { stepId: step.id, capability: step.capability, text: finding.textFound },
    });
    issues.push({
      category: "baked-text",
      severity: "high",
      description:
        `Source generation step "${step.id}" (${step.capability}) produced footage with text rendered INTO the video itself: "${finding.textFound.join(' | ')}". ` +
        `This is a SOURCE defect: re-burning the CTA overlay cannot remove text baked into the footage. ` +
        `Regenerate step "${step.id}" with stronger no-text suppression in its prompt.`,
    });
  }
  return issues;
}