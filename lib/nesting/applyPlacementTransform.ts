import type { NestPoint } from "./convertGeometryToSvgNest";

function ringToPairs(
  ring: NestPoint[] | [number, number][]
): [number, number][] {
  if (ring.length === 0) return [];
  const p0 = ring[0]!;
  if (Array.isArray(p0)) {
    return ring as [number, number][];
  }
  return (ring as NestPoint[]).map((q) => [q.x, q.y]);
}

/**
 * Rotate CCW around origin, then translate (mm). Matches any-nest polygon handling when
 * input polygons are normalized with bbox min at (0,0).
 */
export function applyPlacementToRing(
  ring: NestPoint[] | [number, number][],
  rotationDeg: number,
  tx: number,
  ty: number
): [number, number][] {
  const rad = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return ringToPairs(ring).map(([x, y]) => [
    x * c - y * s + tx,
    x * s + y * c + ty,
  ]);
}
