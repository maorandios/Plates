import type { Point } from "./extract";

/** Resolved cutting defaults affecting marking preview (batch + thickness band). */
export interface MarkingPreviewRuleFlags {
  /** When false, plate marking is off in production — omit preview text. */
  markPartName: boolean;
  /** When true and client code is non-empty, append ` | CLIENT_CODE`. */
  includeClientCode: boolean;
}

export type MarkingPartFields = {
  partName: string;
  clientCode: string;
};

/**
 * Production-style marking string: part name, optionally with client code.
 * Returns empty string when `markPartName` is false.
 */
export function getMarkingText(
  part: MarkingPartFields,
  options: MarkingPreviewRuleFlags
): string {
  if (!options.markPartName) return "";
  const name = part.partName?.trim() || "—";
  const code = part.clientCode?.trim();
  if (options.includeClientCode && code) {
    return `${name} | ${code}`;
  }
  return name;
}

export type MarkingPositionMm = {
  x: number;
  y: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

/**
 * Axis-aligned bbox center of the outer contour (mm), for centered plate marking.
 */
export function getMarkingPositionMm(outerContour: Point[]): MarkingPositionMm | null {
  if (outerContour.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outerContour) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null;
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Font size in **screen pixels** from outer bbox width (mm) and view scale (mm → px).
 * Clamped so labels stay readable on tiny or huge plates.
 */
export function getMarkingFontSizePx(bboxWidthMm: number, viewScale: number): number {
  const screenW = bboxWidthMm * viewScale;
  const raw = screenW * 0.052;
  return Math.min(56, Math.max(11, raw));
}
