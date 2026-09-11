import { fetchLivepeerCapabilities } from "./client";
import type { LivepeerCapability, MediaCapabilityType } from "./types";

let cached: LivepeerCapability[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

const TYPE_HINTS: Record<MediaCapabilityType, RegExp[]> = {
  image: [
    /flux|recraft|gemini-image|seedream|ideogram|grok-imagine|krea|qwen-image|nano-banana|gpt-image|pixelcut|stable-diff|cqwen|uni-1|mai-image|cosmos-3-image|opengen/,
  ],
  video: [
    /veo|ltx|kling|pixverse|seedance|minimax|ray-3|wan-|cosmos-3|animatediff|avatar-x|flux-3|bernini|grok-imagine-video|videogen/,
  ],
  audio: [
    /tts|chatterbox|whisper|wizper|seed-audio|mirelo|sonilo|nemotron|music|lipsync|voice|talking|veed/,
  ],
  analysis: [
    /caption|gemini-text|sam3|yolo|supervision|obscura|detect|segment|ocr|critique|transcribe|analyze|find_moments|autoclip/,
  ],
  tool: [/ffmpeg|cad-render|cdn-vercel|burn-subtitles|overlay|grid|mux|reframe|trim|concat|colorgrade|denoise|kenburns|loop|stabilize|silence/],
};

const CAPABILITY_HEURISTIC: { name: string; type: MediaCapabilityType }[] = [
  { name: "flux-schnell", type: "image" },
  { name: "flux-dev", type: "image" },
  { name: "veo", type: "video" },
  { name: "ltx", type: "video" },
  { name: "gemini-tts", type: "audio" },
  { name: "chatterbox-tts", type: "audio" },
  { name: "wizper", type: "audio" },
  { name: "music", type: "audio" },
  { name: "ffmpeg-concat", type: "tool" },
];

export function classifyCapability(capability: LivepeerCapability): MediaCapabilityType {
  if (capability.kind === "tool") return "tool";
  const name = `${capability.name} ${capability.model_id}`.toLowerCase();
  for (const hint of CAPABILITY_HEURISTIC) {
    if (capability.name.toLowerCase().includes(hint.name.toLowerCase())) {
      return hint.type;
    }
  }
  for (const [type, patterns] of Object.entries(TYPE_HINTS)) {
    if (patterns.some((p) => p.test(name))) return type as MediaCapabilityType;
  }
  return "image";
}

export async function getCapabilities(limit = 250): Promise<LivepeerCapability[]> {
  if (cached && Date.now() - cacheTime < CACHE_TTL_MS) return cached;
  const res = await fetchLivepeerCapabilities(limit);
  cached = res.capabilities;
  cacheTime = Date.now();
  return cached;
}

export async function findCapabilityByName(
  name: string,
): Promise<LivepeerCapability | null> {
  const caps = await getCapabilities();
  return caps.find((c) => c.name === name) ?? null;
}

export async function listCapabilitiesByType(
  type: MediaCapabilityType,
): Promise<LivepeerCapability[]> {
  const caps = await getCapabilities();
  return caps.filter((c) => classifyCapability(c) === type);
}

export function pickDefaultCapability(
  type: MediaCapabilityType,
  capabilities: LivepeerCapability[],
): LivepeerCapability | null {
  const typed = capabilities.filter((c) => classifyCapability(c) === type);
  if (typed.length === 0) return null;
  return (
    typed.find((c) => ["flux-schnell", "veo-2", "gemini-tts", "ffmpeg-concat"].includes(c.name)) ??
    typed[0]
  );
}

export function clearCapabilityCache(): void {
  cached = null;
  cacheTime = 0;
}