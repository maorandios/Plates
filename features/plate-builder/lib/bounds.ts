import type { PlateBuilderShapeMvp } from "../types";

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
