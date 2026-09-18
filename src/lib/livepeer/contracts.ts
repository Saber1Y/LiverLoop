import { classifyCapability } from "./capabilities";
import type { LivepeerCapability } from "./types";
import type { MediaArtifactType } from "../domain/media";

export type ParamSpec = {
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  note?: string;
  allowed?: (string | number)[];
};

export type CapabilityContract = {
  name: string;
  outputType: MediaArtifactType;
  consumes: MediaArtifactType[];
  params: Record<string, ParamSpec>;
  multiInput?: boolean;
};

const CONTRACTS: Record<string, CapabilityContract> = {
  "ltx-25-t2v-fast": {
    name: "ltx-25-t2v-fast",
    outputType: "video",
    consumes: [],
    params: {
      prompt: { type: "string", required: true },
      resolution: { type: "string", note: "720p recommended; never 1080p for short clips" },
      duration: { type: "number", note: "seconds; accepted 6, 8, 10 or auto", allowed: [6, 8, 10, "auto"] },
      aspect_ratio: { type: "string", note: "e.g. 9:16, 16:9, 1:1" },
    },
  },
  "ltx-25-i2v-fast": {
    name: "ltx-25-i2v-fast",
    outputType: "video",
    consumes: ["image"],
    params: {
      prompt: { type: "string", required: true },
      image: { type: "string", note: "URL of the input image" },
      resolution: { type: "string", note: "720p recommended" },
      duration: { type: "number", note: "seconds; accepted 6, 8, 10 or auto", allowed: [6, 8, 10, "auto"] },
      aspect_ratio: { type: "string" },
      camera_motion: { type: "string", note: "dolly_in|dolly_out|static|... (normalized)" },
    },
  },
  "ltx-25-a2v-fast": {
    name: "ltx-25-a2v-fast",
    outputType: "audio",
    consumes: ["video"],
    params: {
      prompt: { type: "string", required: true },
      video: { type: "string", note: "URL of the input video for sound design" },
    },
  },
  "flux-schnell": {
    name: "flux-schnell",
    outputType: "image",
    consumes: [],
    params: {
      prompt: { type: "string", required: true },
      size: { type: "string" },
    },
  },
  "flux-dev": {
    name: "flux-dev",
    outputType: "image",
    consumes: [],
    params: {
      prompt: { type: "string", required: true },
      size: { type: "string" },
    },
  },
  "gemini-tts": {
    name: "gemini-tts",
    outputType: "audio",
    consumes: [],
    params: {
      prompt: { type: "string", required: true, note: "the text to speak (use prompt, not text)" },
      voice: { type: "string" },
      language: { type: "string" },
    },
  },
  "chatterbox-tts": {
    name: "chatterbox-tts",
    outputType: "audio",
    consumes: [],
    params: {
      prompt: { type: "string", required: true },
      voice: { type: "string" },
    },
  },
  "music": {
    name: "music",
    outputType: "audio",
    consumes: [],
    params: {
      prompt: { type: "string", required: true, note: "describe the track/mood/duration" },
    },
  },
  "minimax-music-3": {
    name: "minimax-music-3",
    outputType: "audio",
    consumes: [],
    params: {
      prompt: { type: "string", required: true },
    },
  },
  "ffmpeg-mux": {
    name: "ffmpeg-mux",
    outputType: "video",
    consumes: ["video", "audio"],
    params: {
      video_url: { type: "string", note: "URL of the video input" },
      audio_url: { type: "string", note: "URL of the audio input" },
      mix_mode: { type: "string", note: "replace|mix" },
    },
  },
  "ffmpeg-audio-mix": {
    name: "ffmpeg-audio-mix",
    outputType: "audio",
    consumes: ["audio"],
    params: {
      tracks: { type: "array", note: "audio track URLs with optional gain/delay" },
    },
  },
  "ffmpeg-burn-subtitles": {
    name: "ffmpeg-burn-subtitles",
    outputType: "video",
    consumes: ["video"],
    params: {
      srt_url: { type: "string" },
      cues: { type: "array", note: "[{text, start_sec, end_sec}]" },
      position: { type: "string", note: "bottom|top (normalized)" },
      font_size: { type: "number" },
    },
  },
  "ffmpeg-concat": {
    name: "ffmpeg-concat",
    outputType: "video",
    consumes: ["video"],
    multiInput: true,
    params: {
      clips: { type: "array", note: "2+ video URLs (the inputRefs)" },
      transitions: { type: "boolean" },
    },
  },
  "ffmpeg-trim": {
    name: "ffmpeg-trim",
    outputType: "video",
    consumes: ["video"],
    params: {
      start: { type: "number" },
      duration: { type: "number" },
    },
  },
};

export function getCapabilityContract(name: string): CapabilityContract | null {
  return CONTRACTS[name] ?? null;
}

const KNOWN_AI_NAMES = new Set([
  "ltx-25-t2v-fast",
  "ltx-25-i2v-fast",
  "ltx-25-t2v-pro",
  "ltx-25-i2v-pro",
  "ltx-25-a2v-fast",
  "flux-schnell",
  "flux-dev",
  "flux-3-t2v",
  "flux-3-i2v",
  "gemini-tts",
  "chatterbox-tts",
  "grok-tts",
  "music",
  "minimax-music-3",
]);

export function summarizeCapabilityContracts(caps: LivepeerCapability[]): string {
  const known = caps.filter((cap) => KNOWN_AI_NAMES.has(cap.name) || CONTRACTS[cap.name]);
  if (known.length === 0) return "No validated capability contracts available.";

  const lines = known.map((cap) => {
    const contract = getCapabilityContract(cap.name);
    const name = contract?.name ?? cap.name;
    if (!contract) {
      const kind = classifyCapability(cap);
      return `- ${name} (${kind}) - available, no strict contract`;
    }
    const inputs =
      contract.consumes.length > 0 ? ` consumes[${contract.consumes.join(" + ")}]` : "";
    const params = Object.entries(contract.params)
      .map(
        ([key, spec]) =>
          `${key}:${spec.type}${spec.required ? "" : "?"}${spec.note ? ` (${spec.note})` : ""}`,
      )
      .join(", ");
    return `- ${name} -> ${contract.outputType}${inputs} | params { ${params} }`;
  });
  return lines.join("\n");
}

export function resolveContractOutputType(name: string): MediaArtifactType | null {
  const contract = getCapabilityContract(name);
  if (contract) return contract.outputType;
  return null;
}