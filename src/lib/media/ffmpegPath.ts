import { execFileSync } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

let systemFfmpeg: string | undefined;

function findSystemFfmpeg(): string | undefined {
  if (systemFfmpeg !== undefined) return systemFfmpeg;
  try {
    const resolved = execFileSync("which", ["ffmpeg"], { encoding: "utf8" }).trim();
    systemFfmpeg = resolved || undefined;
  } catch {
    systemFfmpeg = undefined;
  }
  return systemFfmpeg;
}

export function ffmpegExecutable(): string {
  const system = findSystemFfmpeg();
  if (system) return system;
  if (!ffmpegStatic) {
    throw new Error("No ffmpeg binary found: system ffmpeg is missing and ffmpeg-static did not resolve a binary for this platform.");
  }
  return ffmpegStatic;
}