/**
 * Geometric calculations: area, perimeter, bounding box, winding, classification.
 */

import type { Point } from "./extract";
import { reconstructIfCircle } from "./circleDetect";

// ─── Area ─────────────────────────────────────────────────────────────────────

/**
 * Signed area via the Shoelace formula.
 * Positive → CCW winding (standard math / DXF convention, y-up).
 * Negative → CW winding.
 */
export function signedArea(contour: Point[]): number {
  const n = contour.length;
  if (n < 3) return 0;

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += contour[i][0] * contour[j][1];
    area -= contour[j][0] * contour[i][1];
  }
  return area / 2;
}

/**
 * Absolute area of a polygon in mm².
 */
export function polygonArea(contour: Point[]): number {
  return Math.abs(signedArea(contour));
}

/**
 * Net area = outer area − sum of hole areas (mm²).
 */
export function netArea(outer: Point[], holes: Point[][]): number {
  const outerArea = polygonArea(outer);
  const holeArea = holes.reduce((sum, h) => sum + polygonArea(h), 0);
  return Math.max(0, outerArea - holeArea);
}

// ─── Perimeter ───────────────────────────────────────────────────────────────

/**
 * Perimeter (total edge length) of a contour in mm.
 * Handles both open and closed contours.
 */
export function polygonPerimeter(contour: Point[]): number {
  const n = contour.length;
  if (n < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < n - 1; i++) {
    const dx = contour[i + 1][0] - contour[i][0];
    const dy = contour[i + 1][1] - contour[i][1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

// ─── Bounding box ─────────────────────────────────────────────────────────────

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Compute the axis-aligned bounding box of a contour.
 */
export function polygonBoundingBox(contour: Point[]): BoundingBox {
  if (contour.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = contour[0][0],
    maxX = contour[0][0];
  let minY = contour[0][1],
    maxY = contour[0][1];

  for (const [x, y] of contour) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Bounding box of all vertices across contours (for debug fit-to-view). */
export function boundingBoxUnionOfContours(contours: Point[][]): BoundingBox {
  if (contours.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  let any = false;
  for (const c of contours) {
    for (const [x, y] of c) {
      any = true;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!any) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ─── Winding / orientation ────────────────────────────────────────────────────

/** Returns true if the contour winds CCW (positive signed area, y-up coords). */
export function isCCW(contour: Point[]): boolean {
  return signedArea(contour) > 0;
}

/**
 * Ensure a contour winds CCW (outer boundary convention in DXF y-up space).
 * Returns the contour, reversing it if needed.
 */
export function ensureCCW(contour: Point[]): Point[] {
  return isCCW(contour) ? contour : [...contour].reverse();
}

/**
 * Ensure a contour winds CW (hole convention).
 */
export function ensureCW(contour: Point[]): Point[] {
  return isCCW(contour) ? [...contour].reverse() : contour;
}

// ─── Point-in-polygon ────────────────────────────────────────────────────────

/**
 * Ray-casting point-in-polygon test.
 * Returns true if `point` is strictly inside `polygon`.
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    if (yi === yj) continue; // horizontal edge
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Return a representative interior point of a contour for containment tests.
 * Uses the midpoint between vertex 0 and the vertex at ≈ 1/3 of the way around.
 */
export function representativePoint(contour: Point[]): Point {
  if (contour.length === 0) return [0, 0];
  const idx = Math.floor(contour.length / 3);
  return [
    (contour[0][0] + contour[idx][0]) / 2,
    (contour[0][1] + contour[idx][1]) / 2,
  ];
}

// ─── Contour classification ───────────────────────────────────────────────────

export interface ClassifiedContours {
  outer: Point[];
  holes: Point[][];
  /** Closed loops that are not the outer and not inside the outer (debug / sheet scrap) */
  discardedOutsideOuter: Point[][];
}

/**
 * Classify a set of closed contours into one outer boundary and zero or more holes.
 *
 * Strategy:
 * 1. Sort by absolute area (descending) → largest is the outer candidate.
 * 2. For each remaining contour, test whether a representative point lies
 *    inside the outer → if so, it is a hole.
 * 3. Contours outside the outer are returned in `discardedOutsideOuter` for debugging.
 * 4. Correct winding: outer → CCW, holes → CW.
 * 5. Reconstruct degenerate circles (only for holes, not outer boundary).
 */
export function classifyContours(contours: Point[][]): ClassifiedContours {
  if (contours.length === 0) {
    return { outer: [], holes: [], discardedOutsideOuter: [] };
  }

  const sorted = [...contours].sort((a, b) => polygonArea(b) - polygonArea(a));
  const outer = ensureCCW(sorted[0]);
  const holes: Point[][] = [];
  const discardedOutsideOuter: Point[][] = [];

  for (let i = 1; i < sorted.length; i++) {
    const testPt = representativePoint(sorted[i]);
    if (pointInPolygon(testPt, outer)) {
      // Reconstruct diameter polylines / degenerate circles (holes only)
      const hole = ensureCW(sorted[i]);
      const reconstructed = reconstructIfCircle(hole);
      holes.push(reconstructed);
      if (reconstructed.length !== hole.length) {
        console.log(
          `[classify] Hole ${i}: reconstructed ${hole.length} → ${reconstructed.length} pts (circle from DXF diameter / low-poly)`
        );
      }
    } else {
      discardedOutsideOuter.push(sorted[i]);
    }
  }

  return { outer, holes, discardedOutsideOuter };
}
