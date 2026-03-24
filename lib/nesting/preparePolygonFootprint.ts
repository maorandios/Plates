/**
 * Validates and normalizes a closed outer ring for polygon-aware nesting.
 * Input is expected in the same local frame as `NormalizedNestShape.outer` (mm).
 */

import type { NestPoint } from "./convertGeometryToSvgNest";

const MIN_AREA_MM2 = 1e-4;
const CLOSE_EPS = 1e-6;

export type PreparePolygonFootprintResult =
  | { ok: true; ring: NestPoint[] }
  | { ok: false; reason: string };

function ringSignedAreaMm2(ring: NestPoint[]): number {
  if (ring.length < 3) return 0;
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % n]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function ensureClosedRing(outer: NestPoint[]): NestPoint[] {
  if (outer.length < 3) return outer;
  const first = outer[0]!;
  const last = outer[outer.length - 1]!;
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  if (dx * dx + dy * dy <= CLOSE_EPS * CLOSE_EPS) {
    return outer.slice(0, -1);
  }
  return [...outer];
}

/**
 * Returns a closed ring (first point not repeated at end) with positive area,
 * CCW winding preferred for consistent Clipper offset behavior.
 */
export function preparePolygonFootprint(outer: NestPoint[]): PreparePolygonFootprintResult {
  if (!outer || outer.length < 3) {
    return { ok: false, reason: "fewer_than_3_points" };
  }
  for (const p of outer) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      return { ok: false, reason: "non_finite_coordinates" };
    }
  }

  let ring = ensureClosedRing(outer);
  if (ring.length < 3) {
    return { ok: false, reason: "too_few_points_after_close_trim" };
  }

  const area = ringSignedAreaMm2(ring);
  const absA = Math.abs(area);
  if (!Number.isFinite(absA) || absA < MIN_AREA_MM2) {
    return { ok: false, reason: "area_too_small_or_invalid" };
  }

  if (area < 0) {
    ring = [...ring].reverse();
  }

  return { ok: true, ring };
}
