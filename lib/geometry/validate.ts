/**
 * Geometry validation.
 * Checks that extracted geometry is usable for nesting.
 */

import type { Point } from "./extract";
import { polygonArea, polygonBoundingBox } from "./calc";
import { POINT_TOLERANCE } from "./normalize";

export type GeometryStatus = "valid" | "warning" | "error";

export interface ValidationResult {
  isValid: boolean;
  status: GeometryStatus;
  message?: string;
}

// ─── Individual checks ───────────────────────────────────────────────────────

/** Check that the first and last points are coincident (closed contour). */
export function isContourClosed(
  contour: Point[],
  tolerance = POINT_TOLERANCE
): boolean {
  if (contour.length < 2) return false;
  const first = contour[0];
  const last = contour[contour.length - 1];
  const dx = first[0] - last[0];
  const dy = first[1] - last[1];
  return dx * dx + dy * dy <= tolerance * tolerance;
}

/** Minimum number of distinct vertices for a valid polygon. */
const MIN_VERTICES = 3;

/** Minimum area threshold (mm²) — anything below is degenerate. */
const MIN_AREA_MM2 = 1; // 1 mm²

// ─── Main validation ─────────────────────────────────────────────────────────

/**
 * Validate processed geometry and return a status + message.
 *
 * Valid   — closed, adequate area, usable for nesting.
 * Warning — minor issues detected (e.g. very small area, many holes).
 * Error   — no usable outer contour.
 */
export function validateGeometry(
  outer: Point[],
  holes: Point[][]
): ValidationResult {
  // ── Hard failures ────────────────────────────────────────────────────────
  if (outer.length === 0) {
    return {
      isValid: false,
      status: "error",
      message: "No outer contour found",
    };
  }

  if (outer.length < MIN_VERTICES) {
    return {
      isValid: false,
      status: "error",
      message: `Outer contour has too few points (${outer.length} < ${MIN_VERTICES})`,
    };
  }

  if (!isContourClosed(outer)) {
    return {
      isValid: false,
      status: "error",
      message: "Outer contour is not closed",
    };
  }

  const area = polygonArea(outer);
  if (area < MIN_AREA_MM2) {
    return {
      isValid: false,
      status: "error",
      message: `Outer contour area too small (${area.toFixed(4)} mm²)`,
    };
  }

  // ── Warnings ─────────────────────────────────────────────────────────────
  const bbox = polygonBoundingBox(outer);

  if (bbox.width < 1 || bbox.height < 1) {
    return {
      isValid: true,
      status: "warning",
      message: `Part bounding box is very small (${bbox.width.toFixed(2)} × ${bbox.height.toFixed(2)} mm)`,
    };
  }

  if (holes.length > 50) {
    return {
      isValid: true,
      status: "warning",
      message: `Unusually high hole count (${holes.length})`,
    };
  }

  // Warn if any hole is not closed
  const openHoles = holes.filter((h) => !isContourClosed(h));
  if (openHoles.length > 0) {
    return {
      isValid: true,
      status: "warning",
      message: `${openHoles.length} hole(s) are not properly closed`,
    };
  }

  // ── All good ─────────────────────────────────────────────────────────────
  return { isValid: true, status: "valid" };
}
