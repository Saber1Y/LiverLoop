import type { MediaArtifactType } from "../domain/media";

export type MediaStreamInfo = {
  kind: "video" | "audio" | "image" | "other";
  codec?: string;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
};

export type MediaInspection = {
  ok: boolean;
  container?: string;
  durationSec?: number;
  streams: MediaStreamInfo[];
  inferredType: "video" | "audio" | "image" | "unknown";
  width?: number;
  height?: number;
  error?: string;
};

const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 90_000;

type MediaTrack = Record<string, unknown>;

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function trackKind(track: MediaTrack): MediaStreamInfo["kind"] {
  const type = String(track["@type"] ?? track.TrackType ?? "");
  const normalized = type.toLowerCase();
  if (normalized.startsWith("video")) return "video";
  if (normalized.startsWith("audio")) return "audio";
  if (normalized.startsWith("image")) return "image";
  return "other";
}

export function inferredMediaTypeFromStreams(streams: MediaStreamInfo[]): MediaInspection["inferredType"] {
  const hasVideo = streams.some((stream) => stream.kind === "video");
  const hasAudio = streams.some((stream) => stream.kind === "audio");
  const hasImage = streams.some((stream) => stream.kind === "image");
  if (hasVideo) return "video";
  if (hasImage) return "image";
  if (hasAudio) return "audio";
  return "unknown";
}

const DOWNLOAD_CACHE_TTL_MS = 20 * 60 * 1000;
const DOWNLOAD_CACHE_MAX_BYTES = 512 * 1024 * 1024;
const downloadCache = new Map<string, { at: number; buffer: Buffer }>();
let downloadCacheBytes = 0;

export async function downloadArtifactUrl(url: string): Promise<Buffer> {
  const cached = downloadCache.get(url);
  if (cached && Date.now() - cached.at < DOWNLOAD_CACHE_TTL_MS) {
    return cached.buffer;
  }

  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Media probe download failed with HTTP ${response.status} for ${url}`);
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Media probe rejected artifact larger than ${MAX_DOWNLOAD_BYTES} bytes: ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Media probe rejected artifact larger than ${MAX_DOWNLOAD_BYTES} bytes: ${url}`);
  }
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength <= MAX_DOWNLOAD_BYTES) {
    while (downloadCacheBytes + buffer.byteLength > DOWNLOAD_CACHE_MAX_BYTES && downloadCache.size > 0) {
      const oldest = downloadCache.keys().next().value!;
      const entry = downloadCache.get(oldest)!;
      downloadCache.delete(oldest);
      downloadCacheBytes -= entry.buffer.byteLength;
    }
    downloadCache.set(url, { at: Date.now(), buffer });
    downloadCacheBytes += buffer.byteLength;
  }

  return buffer;
}

async function analyzeBuffer(buffer: Buffer): Promise<MediaInspection> {
  const { default: mediaInfoFactory } = await import("mediainfo.js");
  const mediaInfo = await mediaInfoFactory({ format: "object" });
  try {
    const getSize = () => buffer.length;
    const readChunk = (size: number, offset: number) => buffer.subarray(offset, offset + size);
    const result = await mediaInfo.analyzeData(getSize, readChunk);
    const tracks = (result.media?.track ?? []) as unknown as MediaTrack[];

    const general = tracks.find((track) => String(track["@type"] ?? "").toLowerCase() === "general");
    const generalDuration = toNumber(general?.Duration);
    const trackDurations = tracks
      .filter((track) => ["video", "audio", "image"].includes(trackKind(track)))
      .map((track) => toNumber(track.Duration))
      .filter((duration): duration is number => duration !== undefined);

    const streams = tracks
      .map((track): MediaStreamInfo => {
        const kind = trackKind(track);
        return {
          kind,
          codec: track.Format ? String(track.Format) : track.CodecID ? String(track.CodecID) : undefined,
          width: toNumber(track.Width),
          height: toNumber(track.Height),
          sampleRate: toNumber(track.SamplingRate ?? track.Sampling_Rate),
          channels: toNumber(track.Channels ?? track.ChannelCount ?? track.Channel_s_),
        };
      })
      .filter((stream) => stream.kind !== "other");

    const durationSec = generalDuration ?? (trackDurations.length > 0 ? Math.max(...trackDurations) : undefined);

    const video = streams.find((stream) => stream.kind === "video");

    return {
      ok: true,
      container: general?.Format ? String(general.Format) : undefined,
      durationSec,
      streams,
      inferredType: inferredMediaTypeFromStreams(streams),
      width: video?.width,
      height: video?.height,
    };
  } finally {
    mediaInfo.close();
  }
}

export async function inspectArtifactUrl(url: string): Promise<MediaInspection> {
  try {
    const buffer = await downloadArtifactUrl(url);
    const inspection = await analyzeBuffer(buffer);
    return inspection;
  } catch (error) {
    return {
      ok: false,
      streams: [],
      inferredType: "unknown",
      error: error instanceof Error ? error.message : "Media probe failed",
    };
  }
}

export function expectedTypeForInspection(declared: MediaArtifactType, inspection: MediaInspection): MediaArtifactType {
  if (inspection.inferredType !== "unknown") return inspection.inferredType;
  return declared;
}