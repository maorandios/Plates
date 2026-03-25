import type { PlateBuilderShapeMvp } from "../types";
import { slotCorners, slottedHoleCapsuleOutline } from "./slotPolygon";

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
