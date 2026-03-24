/**
 * Normalizes plate contours into the first quadrant (min corner at origin) for SVGNest /
 * placement transforms. Outer contour is the nesting shape; holes stay in `NormalizedNestShape`
 * for viewer metrics only (not sent as SVG holes to SVGNest).
 */

import type { NestablePartInstance } from "./expandPartInstances";

export type NestPoint = { x: number; y: number };

export interface NormalizedNestShape {
  partInstanceId: string;
  partId: string;
  partName: string;
  clientId: string;
  clientCode: string;
  markingText: string;
  netAreaMm2: number;
  outer: NestPoint[];
  holes: NestPoint[][];
}

/** Same metadata as `NormalizedNestShape` with a collision footprint (offset outer or bbox fallback). */
export interface PolygonAwareNestShape extends NormalizedNestShape {
  nestingFootprintLocal: NestPoint[];
  placementFootprintSource: "polygon" | "bbox_fallback";
}

/** SVGNest: original part + polygon sent to the worker (offset outer or bbox fallback). */
export type SvgnestGeometrySource = "polygon" | "bbox_fallback";

export interface SvgnestPartInput {
  shape: NormalizedNestShape;
  nestingOuter: NestPoint[];
  geometrySource: SvgnestGeometrySource;
}

function formatSvgCoord(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const t = Math.round(n * 1e6) / 1e6;
  return String(t);
}

/** SVG `points` attribute for one closed ring (outer only for SVGNest input). */
export function ringToSvgPointsAttr(ring: NestPoint[]): string {
  return ring.map((p) => `${formatSvgCoord(p.x)},${formatSvgCoord(p.y)}`).join(" ");
}

function ringWidthHeightMm(ring: NestPoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const pt of ring) {
    minX = Math.min(minX, pt.x);
    maxX = Math.max(maxX, pt.x);
    minY = Math.min(minY, pt.y);
    maxY = Math.max(maxY, pt.y);
  }
  return { minX, maxX, minY, maxY };
}

export interface BuildSvgnestInputSvgResult {
  svg: string;
  /**
   * X shift applied to each part’s `nestingOuter` in the SVGNest input only.
   * svgnest-mjs builds a parent/child tree when one part’s first vertex lies strictly inside
   * another part’s polygon; stacking normalized parts at the origin triggers that and drops
   * “child” parts from nesting. Strip layout avoids overlap; add R·(dx,0) to SVGNest’s
   * placement translate when mapping back (same rotation convention as `applyPlacementToRing`).
   */
  stripDxByInstanceId: Record<string, number>;
}

/**
 * Builds a minimal SVG document: one bin polygon (inner usable rectangle, mm) and one
 * `<polygon>` per part using **nestingOuter** (spacing-offset true shape or bbox fallback).
 * `shape.partInstanceId` identifies the part for SVGNest output → `EnginePlacement.id`.
 *
 * Parts are laid out on non-overlapping X strips so the library does not treat smaller parts
 * as holes inside larger ones (see `stripDxByInstanceId`).
 *
 * @see lib/nesting/SVGNEST_PIPELINE.md
 */
export function buildSvgnestInputSvg(options: {
  innerBinWidthMm: number;
  innerBinLengthMm: number;
  parts: SvgnestPartInput[];
}): BuildSvgnestInputSvgResult {
  const { innerBinWidthMm: w, innerBinLengthMm: h, parts } = options;
  const binPoints = `0,0 ${formatSvgCoord(w)},0 ${formatSvgCoord(w)},${formatSvgCoord(h)} 0,${formatSvgCoord(h)}`;
  const fragments: string[] = [
    `<polygon id="svgnest-bin" class="bin" points="${binPoints}" fill="none" stroke="#1a1a1a" stroke-width="0.1" />`,
  ];
  const stripDxByInstanceId: Record<string, number> = {};
  const gap = Math.max(0.5, Math.min(2, w * 0.001));
  let cursorX = 0;
  let maxX = w;
  let maxY = h;
  for (const p of parts) {
    const ring = p.nestingOuter;
    const b = ringWidthHeightMm(ring);
    const width = Number.isFinite(b.maxX - b.minX) ? Math.max(0, b.maxX - b.minX) : 0;
    const stripDx = cursorX - b.minX;
    stripDxByInstanceId[p.shape.partInstanceId] = stripDx;
    const shifted = ring.map((pt) => ({
      x: pt.x + stripDx,
      y: pt.y,
    }));
    const pts = ringToSvgPointsAttr(shifted);
    fragments.push(
      `<polygon data-instance-id="${escapeXmlAttr(p.shape.partInstanceId)}" data-geometry-source="${escapeXmlAttr(p.geometrySource)}" points="${pts}" fill="#c8c8c8" fill-opacity="0.35" stroke="#333" stroke-width="0.1" />`
    );
    cursorX += width + gap;
    maxX = Math.max(maxX, b.maxX + stripDx);
    maxY = Math.max(maxY, b.maxY);
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" id="svgnest-svg-root" viewBox="0 0 ${formatSvgCoord(maxX)} ${formatSvgCoord(maxY)}">${fragments.join("")}</svg>`;
  return { svg, stripDxByInstanceId };
}

function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

export function normalizeShapeForNest(
  instance: NestablePartInstance
): NormalizedNestShape | null {
  if (instance.outer.length < 3) return null;
  const netA = Math.abs(instance.netAreaMm2);
  if (!Number.isFinite(netA) || netA <= 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of instance.outer) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  }
  for (const h of instance.holes) {
    for (const [x, y] of h) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  const outer = instance.outer.map(([x, y]) => ({
    x: x - minX,
    y: y - minY,
  }));
  const holes = instance.holes.map((h) =>
    h.map(([x, y]) => ({ x: x - minX, y: y - minY }))
  );
  return {
    partInstanceId: instance.partInstanceId,
    partId: instance.partId,
    partName: instance.partName,
    clientId: instance.clientId,
    clientCode: instance.clientCode,
    markingText: instance.markingText,
    netAreaMm2: netA,
    outer,
    holes,
  };
}
