/**
 * Dimension helpers for preview UI: perimeter edge lengths, hole Ø in mm.
 */

import { formatDecimal } from "@/lib/formatNumbers";
import type { Point } from "./extract";
import { polygonBoundingBox } from "./calc";

/** Vertices without duplicate closing point (first === last). */
export function openPolygonVertices(contour: Point[]): Point[] {
  if (contour.length < 2) return [...contour];
  const first = contour[0];
  const last = contour[contour.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1];
  return closed ? contour.slice(0, -1) : [...contour];
}

export interface PerimeterEdgeMm {
  lengthMm: number;
  /** Midpoint in DXF mm coordinates */
  midMm: Point;
}

/**
 * Each straight segment of the outer polygon (mm length + midpoint for labeling).
 */
export function perimeterEdgesMm(outer: Point[]): PerimeterEdgeMm[] {
  const pts = openPolygonVertices(outer);
  const n = pts.length;
  if (n < 2) return [];

  const edges: PerimeterEdgeMm[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthMm = Math.hypot(dx, dy);
    edges.push({
      lengthMm,
      midMm: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    });
  }
  return edges;
}

/**
 * Estimate hole diameter (mm): diameter polylines (2 pts) or bbox for polygons (circles).
 */
export function estimateHoleDiameterMm(hole: Point[]): number {
  const pts = openPolygonVertices(hole);
  if (pts.length < 2) return 0;
  if (pts.length === 2) {
    return Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
  }
  // Closed polygon (e.g. tessellated circle): use bbox — for a circle, max ≈ diameter
  const bb = polygonBoundingBox(hole);
  return Math.max(bb.width, bb.height);
}

export function formatHoleDiameterLabel(diameterMm: number): string {
  if (diameterMm <= 0) return "—";
  return `Ø ${formatDecimal(diameterMm, 1)} mm`;
}
