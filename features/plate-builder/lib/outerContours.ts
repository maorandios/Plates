import type { PlateBuilderShapeMvp } from "../types";

const ARC_SEG = 10;
const EPS = 1e-9;

function dedupeRing(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 1e-6) {
      out.push(p);
    }
  }
  if (out.length > 2) {
    const first = out[0]!;
    const last = out[out.length - 1]!;
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6) {
      out.pop();
    }
  }
  return out;
}

function arcPoints(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= ARC_SEG; i++) {
    const t = i / ARC_SEG;
    const a = a0 + t * (a1 - a0);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Axis-aligned rectangle (sharp corners), CCW, Y-up. */
export function rectangleOuter(
  w: number,
  h: number
): [number, number][] {
  return [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
}

/** Uniform chamfer on all four corners, CCW. */
export function chamferedRectangleOuter(
  w: number,
  h: number,
  c: number
): [number, number][] {
  const c0 = Math.min(Math.max(0, c), Math.min(w, h) / 2 - EPS);
  if (c0 <= EPS) return rectangleOuter(w, h);
  return dedupeRing([
    [c0, 0],
    [w - c0, 0],
    [w, c0],
    [w, h - c0],
    [w - c0, h],
    [c0, h],
    [0, h - c0],
    [0, c0],
  ]);
}

/** Rounded rectangle as a dense CCW polyline (arc corners). */
export function roundedRectangleOuter(
  w: number,
  h: number,
  r: number
): [number, number][] {
  const r0 = Math.min(Math.max(0, r), w / 2, h / 2);
  if (r0 <= EPS) return rectangleOuter(w, h);

  const pts: [number, number][] = [];

  const appendArc = (cx: number, cy: number, a0: number, a1: number) => {
    const seg = arcPoints(cx, cy, r0, a0, a1);
    const start = pts.length === 0 ? 0 : 1;
    for (let i = start; i < seg.length; i++) pts.push(seg[i]!);
  };

  pts.push([r0, 0]);
  pts.push([w - r0, 0]);
  appendArc(w - r0, r0, -Math.PI / 2, 0);
  pts.push([w, h - r0]);
  appendArc(w - r0, h - r0, 0, Math.PI / 2);
  pts.push([r0, h]);
  appendArc(r0, h - r0, Math.PI / 2, Math.PI);
  pts.push([0, r0]);
  appendArc(r0, r0, Math.PI, (3 * Math.PI) / 2);

  return dedupeRing(pts);
}

export function outerContourForShape(
  shape: PlateBuilderShapeMvp,
  w: number,
  h: number,
  cornerRadius: number,
  chamferSize: number
): [number, number][] {
  switch (shape) {
    case "rectangle":
      return rectangleOuter(w, h);
    case "rectangleRounded":
      return roundedRectangleOuter(w, h, cornerRadius);
    case "rectangleChamfered":
      return chamferedRectangleOuter(w, h, chamferSize);
    default: {
      const _exhaust: never = shape;
      return _exhaust;
    }
  }
}
