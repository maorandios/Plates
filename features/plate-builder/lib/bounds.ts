import type { PlateBuilderShapeMvp } from "../types";
import { slotCorners, slottedHoleCapsuleOutline } from "./slotPolygon";

const PLATE_POLY_EPS = 1e-7;
const CIRCLE_FIT_SAMPLES = 36;

/** CCW convex plate outline; point inside or on boundary (half-plane cross ≥ −eps). */
function pointInConvexPlateRing(
  px: number,
  py: number,
  ring: [number, number][]
): boolean {
  const n = ring.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const ax = ring[i]![0];
    const ay = ring[i]![1];
    const bx = ring[(i + 1) % n]![0];
    const by = ring[(i + 1) % n]![1];
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (cross < -PLATE_POLY_EPS) return false;
  }
  return true;
}

function ringCentroid(ring: [number, number][]): [number, number] {
  const n = ring.length;
  if (n === 0) return [0, 0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[(i + 1) % n]!;
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-18) {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
    }
    return [sx / n, sy / n];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

function clampTowardCentroid(
  tcx: number,
  tcy: number,
  outer: [number, number][],
  fits: (x: number, y: number) => boolean
): [number, number] {
  if (fits(tcx, tcy)) return [tcx, tcy];
  const [gx, gy] = ringCentroid(outer);
  if (!fits(gx, gy)) return [gx, gy];
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 48; k++) {
    const mid = (lo + hi) / 2;
    const x = gx + (tcx - gx) * mid;
    const y = gy + (tcy - gy) * mid;
    if (fits(x, y)) lo = mid;
    else hi = mid;
  }
  const t = lo;
  return [gx + (tcx - gx) * t, gy + (tcy - gy) * t];
}

/** Round hole: entire circle lies in the plate outline (inclusive of boundary). */
export function circleFitsOuterRing(
  outer: [number, number][],
  cx: number,
  cy: number,
  radius: number
): boolean {
  if (radius <= 0) return pointInConvexPlateRing(cx, cy, outer);
  for (let i = 0; i < CIRCLE_FIT_SAMPLES; i++) {
    const a = (i / CIRCLE_FIT_SAMPLES) * Math.PI * 2;
    const px = cx + radius * Math.cos(a);
    const py = cy + radius * Math.sin(a);
    if (!pointInConvexPlateRing(px, py, outer)) return false;
  }
  return true;
}

/** Slotted hole capsule / slot: every vertex lies inside the plate outline. */
export function polygonOutlineFitsOuterRing(
  outer: [number, number][],
  points: [number, number][]
): boolean {
  for (const [x, y] of points) {
    if (!pointInConvexPlateRing(x, y, outer)) return false;
  }
  return true;
}

/** Keep hole center so the circle stays inside the true plate outline (not the inset AABB). */
export function clampHoleCenterToOuterRing(
  cx: number,
  cy: number,
  radius: number,
  outer: [number, number][]
): [number, number] {
  return clampTowardCentroid(cx, cy, outer, (x, y) =>
    circleFitsOuterRing(outer, x, y, radius)
  );
}

export function clampCapsuleHoleCenterToOuterRing(
  cx: number,
  cy: number,
  overallLength: number,
  diameter: number,
  rotationDeg: number,
  outer: [number, number][]
): [number, number] {
  const L = Math.max(overallLength, diameter);
  const fits = (px: number, py: number) =>
    polygonOutlineFitsOuterRing(
      outer,
      slottedHoleCapsuleOutline(px, py, L, diameter, rotationDeg)
    );
  return clampTowardCentroid(cx, cy, outer, fits);
}

export function clampSlotCenterToOuterRing(
  cx: number,
  cy: number,
  length: number,
  width: number,
  rotationDeg: number,
  outer: [number, number][]
): [number, number] {
  const fits = (px: number, py: number) =>
    polygonOutlineFitsOuterRing(
      outer,
      slotCorners(px, py, length, width, rotationDeg)
    );
  return clampTowardCentroid(cx, cy, outer, fits);
}

/** Conservative axis-aligned box [minX,maxX]×[minY,maxY] for hole/slot centers (circle centers / slot centers). */
export function conservativeCenterBounds(
  shape: PlateBuilderShapeMvp,
  w: number,
  h: number,
  cornerRadius: number,
  chamferSize: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  switch (shape) {
    case "rectangle":
      return { minX: 0, maxX: w, minY: 0, maxY: h };
    case "rectangleRounded": {
      const r = Math.min(Math.max(0, cornerRadius), w / 2, h / 2);
      return { minX: r, maxX: w - r, minY: r, maxY: h - r };
    }
    case "rectangleChamfered": {
      const c = Math.min(Math.max(0, chamferSize), Math.min(w, h) / 2 - 1e-6);
      return { minX: c, maxX: w - c, minY: c, maxY: h - c };
    }
    default: {
      const _e: never = shape;
      return _e;
    }
  }
}

/** Circle fully inside conservative bounds. */
export function holeFitsBounds(
  cx: number,
  cy: number,
  radius: number,
  b: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  return (
    cx - radius >= b.minX - 1e-6 &&
    cx + radius <= b.maxX + 1e-6 &&
    cy - radius >= b.minY - 1e-6 &&
    cy + radius <= b.maxY + 1e-6
  );
}

/** All slot corner points inside conservative bounds. */
export function slotCornersFitBounds(
  corners: [number, number][],
  b: { minX: number; maxX: number; minY: number; maxY: number }
): boolean {
  for (const [x, y] of corners) {
    if (
      x < b.minX - 1e-6 ||
      x > b.maxX + 1e-6 ||
      y < b.minY - 1e-6 ||
      y > b.maxY + 1e-6
    ) {
      return false;
    }
  }
  return true;
}

/** Keep hole center so the circle stays inside the conservative plate interior. */
export function clampHoleCenter(
  cx: number,
  cy: number,
  radius: number,
  b: { minX: number; maxX: number; minY: number; maxY: number }
): [number, number] {
  return [
    Math.min(b.maxX - radius, Math.max(b.minX + radius, cx)),
    Math.min(b.maxY - radius, Math.max(b.minY + radius, cy)),
  ];
}

/**
 * Move slot center until all corners lie inside bounds (nudge toward plate interior).
 */
export function clampSlotCenterToFit(
  cx: number,
  cy: number,
  length: number,
  width: number,
  rotationDeg: number,
  b: { minX: number; maxX: number; minY: number; maxY: number }
): [number, number] {
  let x = Math.min(Math.max(cx, b.minX), b.maxX);
  let y = Math.min(Math.max(cy, b.minY), b.maxY);
  if (slotCornersFitBounds(slotCorners(x, y, length, width, rotationDeg), b)) {
    return [x, y];
  }
  const mx = (b.minX + b.maxX) / 2;
  const my = (b.minY + b.maxY) / 2;
  for (let i = 0; i < 100; i++) {
    x = x + (mx - x) * 0.2;
    y = y + (my - y) * 0.2;
    x = Math.min(Math.max(x, b.minX), b.maxX);
    y = Math.min(Math.max(y, b.minY), b.maxY);
    if (slotCornersFitBounds(slotCorners(x, y, length, width, rotationDeg), b)) {
      return [x, y];
    }
  }
  return [mx, my];
}

/** Slotted hole (capsule): width = diameter, rounded ends. */
export function clampCapsuleHoleCenterToFit(
  cx: number,
  cy: number,
  overallLength: number,
  diameter: number,
  rotationDeg: number,
  b: { minX: number; maxX: number; minY: number; maxY: number }
): [number, number] {
  const L = Math.max(overallLength, diameter);
  let x = Math.min(Math.max(cx, b.minX), b.maxX);
  let y = Math.min(Math.max(cy, b.minY), b.maxY);
  const fits = (px: number, py: number) =>
    slotCornersFitBounds(
      slottedHoleCapsuleOutline(px, py, L, diameter, rotationDeg),
      b
    );
  if (fits(x, y)) return [x, y];
  const mx = (b.minX + b.maxX) / 2;
  const my = (b.minY + b.maxY) / 2;
  for (let i = 0; i < 100; i++) {
    x = x + (mx - x) * 0.2;
    y = y + (my - y) * 0.2;
    x = Math.min(Math.max(x, b.minX), b.maxX);
    y = Math.min(Math.max(y, b.minY), b.maxY);
    if (fits(x, y)) return [x, y];
  }
  return [mx, my];
}
