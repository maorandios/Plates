/**
 * Geometry normalization pipeline.
 * - Converts units to mm
 * - Removes duplicate/coincident points
 * - Closes open contours
 * - Merges open chains with small gaps
 * - Uses Clipper.js to simplify and clean polygons
 */

import type { Point, Contour } from "./extract";

// Tolerance for "same point" (mm)
export const POINT_TOLERANCE = 0.01;

// Maximum gap to auto-close or merge (mm)
export const GAP_TOLERANCE = 0.5;

// Clipper scale factor — coordinates are multiplied before integer rounding
const CLIPPER_SCALE = 1000;

// ─── Clipper integration ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ClipperLib = require("clipper-lib") as {
  Clipper: {
    SimplifyPolygon: (
      poly: Array<{ X: number; Y: number }>,
      fillType: number
    ) => Array<Array<{ X: number; Y: number }>>;
    CleanPolygon: (
      poly: Array<{ X: number; Y: number }>,
      distance: number
    ) => Array<{ X: number; Y: number }>;
  };
  PolyFillType: { pftNonZero: number; pftEvenOdd: number };
};

function toClipperPoly(pts: Point[]): Array<{ X: number; Y: number }> {
  return pts.map(([x, y]) => ({
    X: Math.round(x * CLIPPER_SCALE),
    Y: Math.round(y * CLIPPER_SCALE),
  }));
}

function fromClipperPoly(poly: Array<{ X: number; Y: number }>): Point[] {
  return poly.map((p) => [p.X / CLIPPER_SCALE, p.Y / CLIPPER_SCALE]);
}

/**
 * Use Clipper to simplify a polygon (removes self-intersections)
 * and clean tiny edges. Returns the largest resulting polygon.
 *
 * For small features (area < 10,000 mm² ≈ 100×100mm), uses gentler cleaning
 * to preserve detail (e.g., bolt holes should remain circular, not triangular).
 */
function clipperClean(contour: Point[]): Point[] {
  if (contour.length < 3) return contour;
  try {
    const poly = toClipperPoly(contour);

    // Calculate approximate area to detect small features
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      area += poly[i].X * poly[j].Y - poly[j].X * poly[i].Y;
    }
    area = Math.abs(area / 2) / (CLIPPER_SCALE * CLIPPER_SCALE); // Convert to mm²

    // Use gentler cleaning for small features (holes, small cutouts)
    const cleanDistance = area < 10000 ? 0.001 * CLIPPER_SCALE : 0.01 * CLIPPER_SCALE;

    const cleaned = ClipperLib.Clipper.CleanPolygon(poly, cleanDistance);
    if (!cleaned || cleaned.length < 3) return contour;

    // Simplify to remove self-intersections
    const simplified = ClipperLib.Clipper.SimplifyPolygon(
      cleaned,
      ClipperLib.PolyFillType.pftNonZero
    );

    if (!simplified || simplified.length === 0) return contour;

    // Take the largest sub-polygon
    let best = simplified[0];
    for (const poly of simplified) {
      if (poly.length > best.length) best = poly;
    }

    return fromClipperPoly(best);
  } catch {
    // Clipper failed — return original
    return contour;
  }
}

// ─── Point-level helpers ─────────────────────────────────────────────────────

function dist2(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function dist(a: Point, b: Point): number {
  return Math.sqrt(dist2(a, b));
}

/**
 * Remove consecutive duplicate or coincident points.
 */
export function removeDuplicatePoints(
  contour: Point[],
  tolerance = POINT_TOLERANCE
): Point[] {
  if (contour.length === 0) return [];

  const tol2 = tolerance * tolerance;
  const result: Point[] = [contour[0]];

  for (let i = 1; i < contour.length; i++) {
    if (dist2(result[result.length - 1], contour[i]) > tol2) {
      result.push(contour[i]);
    }
  }

  return result;
}

/**
 * Ensure the contour is explicitly closed (first point === last point).
 * If the gap between first and last is within tolerance, snaps them.
 * Otherwise appends a copy of the first point to close.
 */
export function ensureClosed(
  contour: Point[],
  tolerance = POINT_TOLERANCE
): Point[] {
  if (contour.length < 2) return contour;

  const first = contour[0];
  const last = contour[contour.length - 1];

  if (dist2(first, last) > tolerance * tolerance) {
    return [...contour, [first[0], first[1]] as Point];
  }

  // Already closed (or nearly) — snap last point to exactly match first
  return [...contour.slice(0, -1), [first[0], first[1]] as Point];
}

// ─── Unit detection ───────────────────────────────────────────────────────────

/**
 * Heuristically detect whether contours are in inches and need conversion.
 * Returns multiplier: 25.4 if inches detected, 1.0 otherwise.
 *
 * Logic: if the largest dimension is suspiciously small (< 50 units)
 * and the part looks like a sheet metal part, it is probably inches.
 */
export function detectUnitFactor(contours: Point[][]): number {
  if (contours.length === 0) return 1;

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const c of contours) {
    for (const [x, y] of c) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const w = maxX - minX;
  const h = maxY - minY;
  const maxDim = Math.max(w, h);

  // Heuristic: if maximum dimension is between 0.1 and 50 units it is
  // likely inches (a 50" part = 1270 mm, which is an unusually large sheet
  // part but still possible; below 0.1 units is probably just badly scaled).
  // Most metric DXF sheet metal parts are ≥ 50 mm in at least one axis.
  if (maxDim > 0.1 && maxDim < 50) {
    return 25.4;
  }

  return 1;
}

// ─── Gap merging ─────────────────────────────────────────────────────────────

/**
 * Try to merge open chains whose endpoints are within gapTolerance of each other.
 * Iterative — repeats until no more merges are possible.
 */
export function mergeOpenChains(
  contours: Point[][],
  gapTolerance = GAP_TOLERANCE
): Point[][] {
  const tol2 = gapTolerance * gapTolerance;

  const closed: Point[][] = [];
  let open: Point[][] = [];

  for (const c of contours) {
    if (c.length < 2) continue;
    if (dist2(c[0], c[c.length - 1]) <= tol2) {
      closed.push(c);
    } else {
      open.push(c);
    }
  }

  let changed = true;
  while (changed && open.length > 1) {
    changed = false;

    outer: for (let i = 0; i < open.length; i++) {
      for (let j = i + 1; j < open.length; j++) {
        const a = open[i];
        const b = open[j];
        const aS = a[0],
          aE = a[a.length - 1];
        const bS = b[0],
          bE = b[b.length - 1];

        let merged: Point[] | null = null;

        if (dist2(aE, bS) <= tol2) {
          merged = [...a, ...b.slice(1)];
        } else if (dist2(aE, bE) <= tol2) {
          merged = [...a, ...[...b].reverse().slice(1)];
        } else if (dist2(aS, bE) <= tol2) {
          merged = [...b, ...a.slice(1)];
        } else if (dist2(aS, bS) <= tol2) {
          merged = [...[...b].reverse(), ...a.slice(1)];
        }

        if (merged) {
          open[i] = merged;
          open.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }

  // Any open chain that now has start ≈ end → promote to closed
  const stillOpen: Point[][] = [];
  for (const c of open) {
    if (dist2(c[0], c[c.length - 1]) <= tol2) {
      closed.push(c);
    } else {
      stillOpen.push(c);
    }
  }

  return [...closed, ...stillOpen];
}

// ─── Full normalization pipeline ─────────────────────────────────────────────

export interface NormalizeOptions {
  /** Override unit factor (1 = mm, 25.4 = inches→mm). Auto-detected if omitted. */
  unitFactor?: number;
  /** Tolerance for duplicate point removal (mm). Default: 0.01 */
  pointTolerance?: number;
  /** Maximum gap to auto-close (mm). Default: 0.5 */
  gapTolerance?: number;
  /** Whether to run Clipper simplification. Default: true */
  runClipper?: boolean;
}

/**
 * Full normalization pipeline:
 * 1. Unit conversion (auto-detect or use provided factor)
 * 2. Merge open chains with small gaps
 * 3. Remove duplicate points
 * 4. Ensure all contours are closed
 * 5. Clipper simplification (optional, default on)
 * 6. Filter degenerate contours (< 3 unique points)
 */
export function normalizeContours(
  contours: Point[][],
  options: NormalizeOptions = {}
): Point[][] {
  const {
    unitFactor,
    pointTolerance = POINT_TOLERANCE,
    gapTolerance = GAP_TOLERANCE,
    runClipper = true,
  } = options;

  if (contours.length === 0) return [];

  // 1. Unit conversion
  const factor = unitFactor ?? detectUnitFactor(contours);
  let result: Point[][] =
    factor === 1
      ? contours.map((c) => [...c])
      : contours.map((c) => c.map(([x, y]) => [x * factor, y * factor] as Point));

  console.log(`[normalize] After unit conversion (factor=${factor}):`, result.map(c => c.length));

  // 2. Merge open chains
  result = mergeOpenChains(result, gapTolerance);
  console.log(`[normalize] After merge open chains:`, result.map(c => c.length));

  // 3. Remove duplicates + close each contour
  result = result.map((c) => {
    let cleaned = removeDuplicatePoints(c, pointTolerance);
    cleaned = ensureClosed(cleaned, gapTolerance);
    return cleaned;
  });
  console.log(`[normalize] After removeDuplicates + ensureClosed:`, result.map(c => c.length));

  // 4. Clipper simplification pass (on already-closed contours only)
  if (runClipper) {
    result = result.map((c, idx) => {
      const before = c.length;
      // Only simplify if explicitly closed (first ≈ last)
      if (dist2(c[0], c[c.length - 1]) <= POINT_TOLERANCE * POINT_TOLERANCE) {
        const simplified = clipperClean(c);
        const after = simplified.length;
        console.log(`[normalize] Clipper on contour ${idx}: ${before} → ${after} points`);
        // Clipper returns polygons WITHOUT the repeated closing vertex —
        // re-apply ensureClosed so the contour remains recognisably closed.
        return ensureClosed(simplified, POINT_TOLERANCE);
      }
      return c;
    });
  }
  console.log(`[normalize] After Clipper:`, result.map(c => c.length));

  // 5. Re-remove duplicates after clipper
  result = result.map((c) => removeDuplicatePoints(c, pointTolerance));
  console.log(`[normalize] After final removeDuplicates:`, result.map(c => c.length));

  // 6. Re-close after duplicate removal (removing the last point can open the contour)
  result = result.map((c) => ensureClosed(c, POINT_TOLERANCE));
  console.log(`[normalize] After final ensureClosed:`, result.map(c => c.length));

  // 7. Filter out degenerate contours
  result = result.filter((c) => c.length >= 3);
  console.log(`[normalize] Final result:`, result.map(c => c.length));

  return result;
}

/**
 * Compute the total path distance (perimeter-like length) of any contour,
 * open or closed. Used internally for gap detection.
 */
export function contourLength(contour: Point[]): number {
  let len = 0;
  for (let i = 0; i < contour.length - 1; i++) {
    len += dist(contour[i], contour[i + 1]);
  }
  return len;
}
