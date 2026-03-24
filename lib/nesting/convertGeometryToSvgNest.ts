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

function formatSvgCoord(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const t = Math.round(n * 1e6) / 1e6;
  return String(t);
}

/** SVG `points` attribute for one closed ring (outer only for SVGNest input). */
export function ringToSvgPointsAttr(ring: NestPoint[]): string {
  return ring.map((p) => `${formatSvgCoord(p.x)},${formatSvgCoord(p.y)}`).join(" ");
}

/**
 * Builds a minimal SVG document: one bin polygon (inner usable rectangle, mm) and one
 * `<polygon>` per part (true outer contour). Part elements carry `data-instance-id` so
 * SVGNest output can be mapped back to `partInstanceId`.
 */
export function buildSvgnestInputSvg(options: {
  innerBinWidthMm: number;
  innerBinLengthMm: number;
  partsInOrder: NormalizedNestShape[];
}): string {
  const { innerBinWidthMm: w, innerBinLengthMm: h, partsInOrder } = options;
  const binPoints = `0,0 ${formatSvgCoord(w)},0 ${formatSvgCoord(w)},${formatSvgCoord(h)} 0,${formatSvgCoord(h)}`;
  const fragments: string[] = [
    `<polygon id="svgnest-bin" class="bin" points="${binPoints}" fill="none" stroke="#1a1a1a" stroke-width="0.1" />`,
  ];
  for (const p of partsInOrder) {
    const pts = ringToSvgPointsAttr(p.outer);
    fragments.push(
      `<polygon data-instance-id="${escapeXmlAttr(p.partInstanceId)}" points="${pts}" fill="#c8c8c8" fill-opacity="0.35" stroke="#333" stroke-width="0.1" />`
    );
  }
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" id="svgnest-svg-root" viewBox="0 0 ${formatSvgCoord(w)} ${formatSvgCoord(h)}">${fragments.join("")}</svg>`;
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
