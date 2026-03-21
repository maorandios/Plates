/**
 * Geometry extraction from DXF entities.
 * Supports LINE, LWPOLYLINE, POLYLINE, ARC, CIRCLE.
 * ARCs and open LINE chains are merged into closed contours where possible.
 */

import type { DxfEntity } from "@/types";

export type Point = [number, number];
export type Contour = Point[];

export interface ExtractResult {
  contours: Contour[];
  warnings: string[];
}

// Arc approximation resolution
const ARC_SEGMENTS_PER_360 = 64;

// ─── Arc / curve helpers ─────────────────────────────────────────────────────

/**
 * Approximate a circular arc as a series of points.
 * Angles in degrees, CCW (standard DXF convention).
 */
function arcToPoints(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
): Point[] {
  let startRad = (startAngleDeg * Math.PI) / 180;
  let endRad = (endAngleDeg * Math.PI) / 180;

  // DXF arcs always sweep CCW — ensure end > start
  if (endRad <= startRad) endRad += 2 * Math.PI;

  const sweepRad = endRad - startRad;
  const segments = Math.max(4, Math.ceil((sweepRad / (2 * Math.PI)) * ARC_SEGMENTS_PER_360));

  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = startRad + (sweepRad * i) / segments;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return points;
}

/**
 * Approximate a full circle as a closed polygon.
 */
function circleToPoints(cx: number, cy: number, radius: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < ARC_SEGMENTS_PER_360; i++) {
    const angle = (2 * Math.PI * i) / ARC_SEGMENTS_PER_360;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  points.push([...points[0]]); // close
  return points;
}

/**
 * Convert an LWPOLYLINE bulge segment to arc points.
 * bulge = tan(included_angle / 4)
 * Positive = CCW arc, negative = CW arc.
 */
function bulgeSegmentToPoints(p1: Point, p2: Point, bulge: number): Point[] {
  if (Math.abs(bulge) < 1e-10) return [p1, p2];

  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const chord = Math.sqrt(dx * dx + dy * dy);
  if (chord < 1e-10) return [p1, p2];

  const alpha = 4 * Math.atan(Math.abs(bulge));
  const radius = chord / (2 * Math.sin(alpha / 2));

  // Midpoint of chord
  const mx = (p1[0] + p2[0]) / 2;
  const my = (p1[1] + p2[1]) / 2;

  // Perpendicular unit vector
  const perpX = -dy / chord;
  const perpY = dx / chord;

  // Distance from chord midpoint to arc center
  const d = Math.sqrt(Math.max(0, radius * radius - (chord / 2) * (chord / 2)));

  // bulge > 0 → CCW arc → center is to the left of chord direction
  const sign = bulge > 0 ? 1 : -1;
  const cx = mx + sign * d * perpX;
  const cy = my + sign * d * perpY;

  let startAngle = Math.atan2(p1[1] - cy, p1[0] - cx);
  let endAngle = Math.atan2(p2[1] - cy, p2[0] - cx);

  if (bulge > 0) {
    // CCW
    if (endAngle < startAngle) endAngle += 2 * Math.PI;
  } else {
    // CW
    if (endAngle > startAngle) endAngle -= 2 * Math.PI;
  }

  const sweepRad = Math.abs(endAngle - startAngle);
  const segments = Math.max(4, Math.ceil((sweepRad / (2 * Math.PI)) * ARC_SEGMENTS_PER_360));

  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return points;
}

// ─── LINE chaining ───────────────────────────────────────────────────────────

interface Segment {
  start: Point;
  end: Point;
  used: boolean;
}

/** Round a coordinate for use as a map key (1e-4 mm precision). */
function coordKey(x: number, y: number): string {
  return `${Math.round(x * 1e4)},${Math.round(y * 1e4)}`;
}

function ptKey(p: Point): string {
  return coordKey(p[0], p[1]);
}

function ptDist2(a: Point, b: Point): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/**
 * Chain a flat list of line segments into polyline chains.
 * Returns both closed loops and open chains (for further merging).
 */
export function chainSegments(rawLines: Array<{ start: Point; end: Point }>): Contour[] {
  const SNAP2 = (1e-4) * (1e-4);

  const segments: Segment[] = rawLines.map((l) => ({
    start: l.start,
    end: l.end,
    used: false,
  }));

  // endpoint → list of segment indices
  const map = new Map<string, number[]>();
  for (let i = 0; i < segments.length; i++) {
    const ks = ptKey(segments[i].start);
    const ke = ptKey(segments[i].end);
    if (!map.has(ks)) map.set(ks, []);
    if (!map.has(ke)) map.set(ke, []);
    map.get(ks)!.push(i);
    map.get(ke)!.push(i);
  }

  function findNext(tip: Point, excludeIdx: number): { idx: number; reversed: boolean } | null {
    const key = ptKey(tip);
    const candidates = map.get(key) ?? [];
    for (const idx of candidates) {
      const seg = segments[idx];
      if (seg.used || idx === excludeIdx) continue;
      if (ptDist2(seg.start, tip) <= SNAP2) return { idx, reversed: false };
      if (ptDist2(seg.end, tip) <= SNAP2) return { idx, reversed: true };
    }
    return null;
  }

  const contours: Contour[] = [];

  for (let si = 0; si < segments.length; si++) {
    if (segments[si].used) continue;

    const chain: Point[] = [segments[si].start, segments[si].end];
    segments[si].used = true;

    // Extend forward
    for (;;) {
      const tip = chain[chain.length - 1];
      const next = findNext(tip, -1);
      if (!next) break;
      const seg = segments[next.idx];
      seg.used = true;
      chain.push(next.reversed ? seg.start : seg.end);
    }

    // Extend backward
    for (;;) {
      const tail = chain[0];
      const next = findNext(tail, -1);
      if (!next) break;
      const seg = segments[next.idx];
      seg.used = true;
      chain.unshift(next.reversed ? seg.end : seg.start);
    }

    if (chain.length >= 2) {
      contours.push(chain as Contour);
    }
  }

  return contours;
}

// ─── Main extractor ──────────────────────────────────────────────────────────

/**
 * Extract all geometric contours from a list of DXF entities.
 * Returns raw (potentially open) contours and any warnings.
 */
export function extractContours(entities: DxfEntity[]): ExtractResult {
  const warnings: string[] = [];
  const contours: Contour[] = [];

  // Collect LINE/ARC segments for chaining
  const segments: Array<{ start: Point; end: Point }> = [];

  const entityTypes = entities.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[extract] Entity types:`, JSON.stringify(entityTypes));
  console.log(`[extract] Total entities: ${entities.length}`);

  for (const entity of entities) {
    try {
      switch (entity.type) {
        // ── LWPOLYLINE ─────────────────────────────────────────────────────
        case "LWPOLYLINE": {
          const e = entity as {
            vertices?: Array<{ x?: number; y?: number; bulge?: number }>;
            shape?: boolean;
          };
          const verts = e.vertices ?? [];
          if (verts.length < 2) break;
          
          console.log(`[extract] LWPOLYLINE: ${verts.length} vertices, shape=${e.shape}`);

          const pts: Point[] = [];

          for (let i = 0; i < verts.length; i++) {
            const v = verts[i];
            const p1: Point = [v.x ?? 0, v.y ?? 0];
            const bulge = v.bulge ?? 0;
            const isLast = i === verts.length - 1;

            if (!isLast) {
              const v2 = verts[i + 1];
              const p2: Point = [v2.x ?? 0, v2.y ?? 0];
              if (Math.abs(bulge) > 1e-10) {
                const arcPts = bulgeSegmentToPoints(p1, p2, bulge);
                pts.push(...arcPts.slice(0, -1)); // exclude last (= p2, added by next iteration)
              } else {
                pts.push(p1);
              }
            } else {
              // Last vertex — handle closing bulge if shape is closed
              pts.push(p1);
              if (e.shape && Math.abs(bulge) > 1e-10 && verts.length > 1) {
                const p2: Point = [verts[0].x ?? 0, verts[0].y ?? 0];
                const arcPts = bulgeSegmentToPoints(p1, p2, bulge);
                pts.push(...arcPts.slice(1, -1)); // interior arc points only
              }
            }
          }

          if (e.shape && pts.length > 0) {
            pts.push([pts[0][0], pts[0][1]]); // close the polyline
          }

          if (pts.length >= 3) contours.push(pts);
          break;
        }

        // ── POLYLINE ───────────────────────────────────────────────────────
        case "POLYLINE": {
          const e = entity as {
            vertices?: Array<{ x?: number; y?: number }>;
            shape?: boolean;
          };
          const verts = (e.vertices ?? []).filter(
            (v) => v.x != null && v.y != null
          );
          if (verts.length < 2) break;

          console.log(`[extract] POLYLINE: ${verts.length} vertices, shape=${e.shape}`);

          const pts: Point[] = verts.map((v) => [v.x ?? 0, v.y ?? 0]);
          if (e.shape) pts.push([pts[0][0], pts[0][1]]);

          if (pts.length >= 3) {
            console.log(`[extract] POLYLINE → contour with ${pts.length} points`);
            contours.push(pts);
          }
          break;
        }

        // ── LINE ───────────────────────────────────────────────────────────
        case "LINE": {
          const e = entity as {
            start?: { x?: number; y?: number };
            end?: { x?: number; y?: number };
          };
          if (e.start && e.end) {
            segments.push({
              start: [e.start.x ?? 0, e.start.y ?? 0],
              end: [e.end.x ?? 0, e.end.y ?? 0],
            });
          }
          break;
        }

        // ── ARC — approximate to segments for chaining with LINEs ──────────
        case "ARC": {
          const e = entity as {
            center?: { x?: number; y?: number };
            radius?: number;
            startAngle?: number;
            endAngle?: number;
          };
          if (e.center && e.radius != null) {
            const arcPts = arcToPoints(
              e.center.x ?? 0,
              e.center.y ?? 0,
              e.radius,
              e.startAngle ?? 0,
              e.endAngle ?? 360
            );
            // Add arc as a series of chaining segments
            for (let i = 0; i < arcPts.length - 1; i++) {
              segments.push({ start: arcPts[i], end: arcPts[i + 1] });
            }
          }
          break;
        }

        // ── CIRCLE — always a complete closed contour ──────────────────────
        case "CIRCLE": {
          const e = entity as {
            center?: { x?: number; y?: number };
            radius?: number;
          };
          if (e.center && e.radius != null && e.radius > 0) {
            const circlePts = circleToPoints(e.center.x ?? 0, e.center.y ?? 0, e.radius);
            console.log(`[extract] CIRCLE: radius=${e.radius}, generated ${circlePts.length} points`);
            contours.push(circlePts);
          }
          break;
        }

        default:
          // SPLINE, ELLIPSE, etc. — not yet supported
          break;
      }
    } catch (err) {
      warnings.push(
        `Error extracting ${entity.type}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Chain LINE + ARC segments into polylines
  console.log(`[extract] Collected ${segments.length} LINE/ARC segments for chaining`);
  if (segments.length > 0) {
    const chained = chainSegments(segments);
    console.log(`[extract] Chained into ${chained.length} polylines:`, chained.map(c => `${c.length} pts`));
    contours.push(...chained);
  }

  console.log(`[extract] Total contours extracted: ${contours.length}`);
  return { contours, warnings };
}
