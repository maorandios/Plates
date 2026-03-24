/**
 * Simplifies **nesting footprint** rings only (not display/export geometry).
 * Reduces SVGNest / Clipper cost while keeping shape faithful within tolerance.
 */

import type { NestPoint } from "./convertGeometryToSvgNest";

export interface SimplifyNestingFootprintResult {
  ring: NestPoint[];
  originalPointCount: number;
  simplifiedPointCount: number;
}

function distSq(a: NestPoint, b: NestPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Perpendicular distance from p to infinite line through a–b. */
function pointLineDistanceMm(p: NestPoint, a: NestPoint, b: NestPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-18) return Math.sqrt(distSq(p, a));
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)
  );
  const nx = a.x + t * dx;
  const ny = a.y + t * dy;
  return Math.hypot(p.x - nx, p.y - ny);
}

function removeNearDuplicateVertices(ring: NestPoint[], minDistMm: number): NestPoint[] {
  if (ring.length < 2) return ring.map((p) => ({ ...p }));
  const min2 = minDistMm * minDistMm;
  const out: NestPoint[] = [{ ...ring[0]! }];
  for (let i = 1; i < ring.length; i++) {
    const p = ring[i]!;
    if (distSq(p, out[out.length - 1]!) < min2) continue;
    out.push({ ...p });
  }
  while (
    out.length >= 2 &&
    distSq(out[0]!, out[out.length - 1]!) < min2
  ) {
    out.pop();
  }
  return out;
}

/** Removes vertices whose turning angle is ~180° within tolerance (mm as cross-track distance). */
function removeNearCollinear(ring: NestPoint[], toleranceMm: number): NestPoint[] {
  if (ring.length < 4) return ring.map((p) => ({ ...p }));
  const n = ring.length;
  let changed = true;
  let cur = ring.map((p) => ({ ...p }));
  while (changed && cur.length >= 4) {
    changed = false;
    const next: NestPoint[] = [];
    for (let i = 0; i < cur.length; i++) {
      const prev = cur[(i - 1 + cur.length) % cur.length]!;
      const mid = cur[i]!;
      const nxt = cur[(i + 1) % cur.length]!;
      const d = pointLineDistanceMm(mid, prev, nxt);
      if (d <= toleranceMm) {
        changed = true;
        continue;
      }
      next.push(mid);
    }
    cur = next;
  }
  return cur.length >= 3 ? cur : ring.map((p) => ({ ...p }));
}

/**
 * Douglas–Peucker on a closed ring via duplicated closing vertex (standard approach).
 */
function douglasPeuckerClosedRing(ring: NestPoint[], epsilonMm: number): NestPoint[] {
  if (ring.length < 4 || epsilonMm <= 0) return ring.map((p) => ({ ...p }));
  const open: NestPoint[] = [...ring.map((p) => ({ ...p })), { ...ring[0]! }];
  const m = open.length;
  const keep = new Array<boolean>(m).fill(false);
  keep[0] = true;
  keep[m - 1] = true;

  function recur(i: number, j: number): void {
    if (j <= i + 1) return;
    let maxD = 0;
    let idx = i;
    const ai = open[i]!;
    const aj = open[j]!;
    for (let k = i + 1; k < j; k++) {
      const d = pointLineDistanceMm(open[k]!, ai, aj);
      if (d > maxD) {
        maxD = d;
        idx = k;
      }
    }
    if (maxD > epsilonMm) {
      keep[idx] = true;
      recur(i, idx);
      recur(idx, j);
    }
  }

  recur(0, m - 1);
  const out: NestPoint[] = [];
  for (let i = 0; i < m - 1; i++) {
    if (keep[i]) out.push(open[i]!);
  }
  return out.length >= 3 ? out : ring.map((p) => ({ ...p }));
}

/**
 * @param toleranceMm  ~0.15–0.35 mm typical for plate nesting; 0 skips simplification.
 */
export function simplifyNestingFootprint(
  ring: NestPoint[],
  toleranceMm: number
): SimplifyNestingFootprintResult {
  const originalPointCount = ring.length;
  if (
    toleranceMm <= 0 ||
    ring.length < 4 ||
    !Number.isFinite(toleranceMm)
  ) {
    return {
      ring: ring.map((p) => ({ x: p.x, y: p.y })),
      originalPointCount,
      simplifiedPointCount: originalPointCount,
    };
  }

  let r = removeNearDuplicateVertices(ring, Math.max(1e-4, toleranceMm * 0.05));
  r = removeNearCollinear(r, toleranceMm * 0.35);
  r = douglasPeuckerClosedRing(r, toleranceMm);

  if (r.length < 3) {
    return {
      ring: ring.map((p) => ({ x: p.x, y: p.y })),
      originalPointCount,
      simplifiedPointCount: originalPointCount,
    };
  }

  return {
    ring: r,
    originalPointCount,
    simplifiedPointCount: r.length,
  };
}
