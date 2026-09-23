import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { ffmpegExecutable } from "./ffmpegPath";

export const CTA_OVERLAY_WIDTH = 1920;
export const CTA_OVERLAY_HEIGHT = 400;

const FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/System/Library/Fonts/Helvetica.ttc",
  "/System/Library/Fonts/Supplemental/Helvetica.ttc",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
];

function findFontFile(): string | undefined {
  return FONT_CANDIDATES.find((path) => existsSync(path));
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'")
    .replace(/,/g, "\\,");
}

export function renderCtaOverlayPng(
  text: string,
  opts: { fontfile?: string; fontSize?: number; borderWidth?: number; width?: number; height?: number } = {},
): Buffer {
  const fontSize = opts.fontSize ?? 180;
  const borderWidth = opts.borderWidth ?? 12;
  const width = opts.width ?? CTA_OVERLAY_WIDTH;
  const height = opts.height ?? CTA_OVERLAY_HEIGHT;
  const fontfile = opts.fontfile ?? findFontFile();
  const fontSpec = fontfile
    ? `fontfile='${fontfile}'`
    : "font='Sans'";

  const filter =
    `color=c=black@0.0:s=${width}x${height}:d=1,format=rgba` +
    `,drawtext=${fontSpec}:fontcolor=white:fontsize=${fontSize}:borderw=${borderWidth}:bordercolor=black:` +
    `text='${escapeDrawtext(text)}':x=(w-text_w)/2:y=(h-text_h)/2`;

  try {
    return execFileSync(ffmpegExecutable(), [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      filter,
      "-frames:v",
      "1",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "pipe:1",
    ]);
  } catch (error) {
    if (!fontfile) {
      throw new Error(
        `Failed to render CTA overlay PNG: ${error instanceof Error ? error.message : String(error)}. ` +
          "No supported font file was found and the drawtext font fallback also failed.",
      );
    }
    throw new Error(
      `Failed to render CTA overlay PNG: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}