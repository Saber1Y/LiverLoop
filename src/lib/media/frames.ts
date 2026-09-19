import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import ffmpegStatic from "ffmpeg-static";
import type { LlmImagePart } from "../llm/types";
import type { MediaArtifactType } from "../domain/media";
import { downloadArtifactUrl } from "./inspect";

const execFileAsync = promisify(execFile);
const FFMPEG_TIMEOUT_MS = 60_000;
const MAX_FRAMES = 4;

export type VisualFrameSample = {
  timestampSec: number;
  dataUrl: string;
};

function ffmpegExecutable(): string {
  if (!ffmpegStatic) {
    throw new Error("ffmpeg-static did not resolve a binary for this platform.");
  }
  return ffmpegStatic;
}

async function downloadToTemp(url: string): Promise<{ dir: string; path: string }> {
  const buffer = await downloadArtifactUrl(url);
  const dir = await mkdtemp(join(tmpdir(), "liverloop-frames-"));
  const containerHint = url.includes(".mp4") ? ".mp4" : url.includes(".webm") ? ".webm" : url.includes(".mov") ? ".mov" : ".bin";
  const path = join(dir, `${randomUUID().slice(0, 8)}${containerHint}`);
  await writeFile(path, buffer);
  return { dir, path };
}

function pickTimestamps(durationSec: number): number[] {
  if (durationSec <= 0) return [1];
  if (durationSec > 15) {
    const start = Math.min(1, durationSec * 0.15);
    const middle = durationSec / 2;
    const ctaFrame = Math.max(0, durationSec - 1.5);
    const styleFrame = Math.max(0, durationSec - 4);
    const unique = new Set<number>([start, middle, styleFrame, ctaFrame].map((t) => Math.round(t)));
    return [...unique].sort((a, b) => a - b).slice(0, MAX_FRAMES);
  }
  if (durationSec > 10) {
    const start = Math.min(1, durationSec * 0.1);
    const styleFrame = Math.max(0, durationSec - 4);
    const ctaFrame = Math.max(0, durationSec - 1.2);
    const unique = new Set<number>([start, styleFrame, Math.min(durationSec - 0.2, ctaFrame)].map((t) => Math.round(t * 10) / 10));
    return [...unique].sort((a, b) => a - b).slice(0, MAX_FRAMES);
  }
  const start = Math.min(0.5, durationSec * 0.1);
  const ctaFrame = Math.max(0, durationSec - 1.2);
  return [start, ctaFrame].map((t) => Math.round(t * 10) / 10);
}

async function extractFrame(
  inputPath: string,
  timestampSec: number,
  outPath: string,
): Promise<void> {
  await execFileAsync(
    ffmpegExecutable(),
    [
      "-v", "error",
      "-ss", String(timestampSec),
      "-i", inputPath,
      "-frames:v", "1",
      "-vf", "scale=960:-2",
      "-q:v", "2",
      "-y",
      outPath,
    ],
    { timeout: FFMPEG_TIMEOUT_MS },
  );
  const buffer = await readFile(outPath);
  if (buffer.byteLength === 0) {
    throw new Error(`ffmpeg produced an empty frame at ${timestampSec}s`);
  }
}

export async function sampleVideoFrames(
  url: string,
  durationSec: number,
): Promise<VisualFrameSample[]> {
  const { dir, path } = await downloadToTemp(url);
  try {
    const timestamps = pickTimestamps(durationSec);
    const frames: VisualFrameSample[] = [];
    for (const timestampSec of timestamps) {
      try {
        const outPath = join(dir, `frame-${timestampSec}.jpg`);
        await extractFrame(path, timestampSec, outPath);
        const buffer = await readFile(outPath);
        frames.push({
          timestampSec,
          dataUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`,
        });
      } catch {
        // Skip timestamps that fail to decode; keep the rest.
      }
    }
    return frames;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function imageToDataUrl(url: string): Promise<string> {
  const contentType = await fetch(url, { method: "HEAD", redirect: "follow" })
    .then((response) => response.headers.get("content-type"))
    .catch(() => null);
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(90_000) });
  if (!response.ok) {
    throw new Error(`Image fetch failed with HTTP ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = (contentType ?? "").toLowerCase().includes("png") ? "image/png"
    : (contentType ?? "").toLowerCase().includes("webp") ? "image/webp"
    : (contentType ?? "").toLowerCase().includes("gif") ? "image/gif"
    : "image/jpeg";
  return `data:${extension};base64,${bytes.toString("base64")}`;
}

export async function artifactToImageParts(params: {
  url: string;
  type: MediaArtifactType;
  durationSec?: number;
}): Promise<{ images: LlmImagePart[]; labels: string[] }> {
  if (params.type === "video") {
    const frames = await sampleVideoFrames(params.url, params.durationSec ?? 10);
    return {
      images: frames.map((frame) => ({ dataUrl: frame.dataUrl, label: `frame at ${frame.timestampSec}s` })),
      labels: frames.map((frame) => `${frame.timestampSec}s`),
    };
  }
  if (params.type === "image") {
    const dataUrl = await imageToDataUrl(params.url);
    return { images: [{ dataUrl, label: "generated image" }], labels: ["still"] };
  }
  return { images: [], labels: [] };
}