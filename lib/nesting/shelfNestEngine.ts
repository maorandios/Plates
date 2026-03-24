/**
 * MVP 2D nesting: shelf / row packing on axis-aligned bounding boxes of the outer contour,
 * with discrete rotations. Uses the same placement contract as SVGNest-style engines
 * (rotate around origin, then translate) so downstream geometry + metrics stay aligned.
 *
 * **Default engine:** shelf / row packing on outer AABB (production). SVGNest is optional in `runAutoNesting`.
 */

import type { ProfileRotationMode } from "@/types/production";
import type { NormalizedNestShape, NestPoint } from "./convertGeometryToSvgNest";

export interface EnginePlacement {
  id: string;
  translate: { x: number; y: number };
  rotate: number;
}

function rotatePoint(x: number, y: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

function aabbOfRotatedOuter(outer: NestPoint[], rotDeg: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outer) {
    const [rx, ry] = rotatePoint(p.x, p.y, rotDeg);
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

export function rotationAnglesDeg(
  allowRotation: boolean,
  rotationMode: ProfileRotationMode
): number[] {
  if (!allowRotation) return [0];
  if (rotationMode === "ninetyOnly") return [0, 90, 180, 270];
  return Array.from({ length: 12 }, (_, i) => i * 30);
}

/** Layout tolerance (mm) so float noise does not reject valid fits. */
const BIN_FIT_EPS_MM = 0.05;

function firstFitRotation(
  shape: NormalizedNestShape,
  px: number,
  py: number,
  binW: number,
  binH: number,
  spacingMm: number,
  angles: number[]
): { ew: number; eh: number; placement: EnginePlacement } | null {
  for (const rot of angles) {
    const { minX, minY, w, h } = aabbOfRotatedOuter(shape.outer, rot);
    const ew = w + spacingMm;
    const eh = h + spacingMm;
    if (px + ew <= binW + BIN_FIT_EPS_MM && py + eh <= binH + BIN_FIT_EPS_MM) {
      const tx = px - minX;
      const ty = py - minY;
      return {
        ew,
        eh,
        placement: {
          id: shape.partInstanceId,
          translate: { x: tx, y: ty },
          rotate: rot,
        },
      };
    }
  }
  return null;
}

function maxSide0(shape: NormalizedNestShape, spacing: number): number {
  const { w, h } = aabbOfRotatedOuter(shape.outer, 0);
  return Math.max(w + spacing, h + spacing);
}

export type ShelfPartSort = (
  a: NormalizedNestShape,
  b: NormalizedNestShape
) => number;

function sortByAreaDesc(a: NormalizedNestShape, b: NormalizedNestShape) {
  return Math.abs(b.netAreaMm2) - Math.abs(a.netAreaMm2);
}

function sortByMinSideAsc(a: NormalizedNestShape, b: NormalizedNestShape) {
  const { w: wa, h: ha } = aabbOfRotatedOuter(a.outer, 0);
  const { w: wb, h: hb } = aabbOfRotatedOuter(b.outer, 0);
  return Math.min(wa, ha) - Math.min(wb, hb);
}

function sortByWidthDesc(a: NormalizedNestShape, b: NormalizedNestShape) {
  const { w: wa } = aabbOfRotatedOuter(a.outer, 0);
  const { w: wb } = aabbOfRotatedOuter(b.outer, 0);
  return wb - wa;
}

/**
 * Single-sheet shelf pack. Returns placements for instances that fit; caller removes them from the queue.
 */
export function packShelfSingleSheet(options: {
  normalizedParts: NormalizedNestShape[];
  innerBinWidth: number;
  innerBinLength: number;
  spacingMm: number;
  angles: number[];
  /** Override default “largest max side first” ordering. */
  sortCompare?: ShelfPartSort;
}): { placed: EnginePlacement[]; fitness: number } {
  const {
    normalizedParts,
    innerBinWidth,
    innerBinLength,
    spacingMm,
    angles,
    sortCompare,
  } = options;
  const binW = innerBinWidth;
  const binH = innerBinLength;
  const defaultSort: ShelfPartSort = (a, b) =>
    maxSide0(b, spacingMm) - maxSide0(a, spacingMm);
  const sorted = [...normalizedParts].sort(sortCompare ?? defaultSort);

  let remaining = sorted;
  const placed: EnginePlacement[] = [];
  let y = 0;

  while (remaining.length > 0 && y < binH + BIN_FIT_EPS_MM) {
    let x = 0;
    let rowH = 0;
    const next: NormalizedNestShape[] = [];
    let any = false;
    for (const item of remaining) {
      const fit = firstFitRotation(
        item,
        x,
        y,
        binW,
        binH,
        spacingMm,
        angles
      );
      if (fit) {
        placed.push(fit.placement);
        x += fit.ew;
        rowH = Math.max(rowH, fit.eh);
        any = true;
      } else {
        next.push(item);
      }
    }
    remaining = next;
    if (!any) break;
    y += rowH;
  }

  const sheetArea = binW * binH;
  const used = placed.reduce((sum, p) => {
    const sh = normalizedParts.find((n) => n.partInstanceId === p.id);
    return sum + (sh?.netAreaMm2 ?? 0);
  }, 0);
  const fitness = sheetArea > 0 ? 1 - used / sheetArea : 1;
  return { placed, fitness };
}

/**
 * Runs several part orderings and keeps the result with the most parts placed (then best fitness).
 * Improves shelf packing when one heuristic leaves usable space unused.
 */
export function packShelfSingleSheetBest(options: {
  normalizedParts: NormalizedNestShape[];
  innerBinWidth: number;
  innerBinLength: number;
  spacingMm: number;
  angles: number[];
}): { placed: EnginePlacement[]; fitness: number } {
  const { spacingMm } = options;
  const presets: ShelfPartSort[] = [
    (a, b) => maxSide0(b, spacingMm) - maxSide0(a, spacingMm),
    sortByAreaDesc,
    sortByMinSideAsc,
    sortByWidthDesc,
    (a, b) => maxSide0(a, spacingMm) - maxSide0(b, spacingMm),
  ];
  let bestPlaced: EnginePlacement[] = [];
  let bestFitness = Number.POSITIVE_INFINITY;
  for (const sortCompare of presets) {
    const r = packShelfSingleSheet({ ...options, sortCompare });
    if (
      r.placed.length > bestPlaced.length ||
      (r.placed.length === bestPlaced.length && r.fitness < bestFitness)
    ) {
      bestPlaced = r.placed;
      bestFitness = r.fitness;
    }
  }
  return { placed: bestPlaced, fitness: bestFitness };
}

function normAngleDeg(deg: number): number {
  let x = deg % 360;
  if (x > 180) x -= 360;
  if (x <= -180) x += 360;
  return x;
}

/**
 * Packing used innerBinWidth = physical length and innerBinLength = physical width.
 * Map placements back to physical frame (x along width, y along length).
 */
export function remapShelfPlacementsSwapBinAxes(
  placed: EnginePlacement[]
): EnginePlacement[] {
  return placed.map((p) => ({
    id: p.id,
    translate: { x: p.translate.y, y: p.translate.x },
    rotate: normAngleDeg(p.rotate + 90),
  }));
}

/**
 * Best of default orientation and 90°-swapped bin (same stock, different row direction).
 * Often places more parts when the sheet is rectangular.
 */
export function packShelfSingleSheetBestWithOrientation(options: {
  normalizedParts: NormalizedNestShape[];
  innerBinWidth: number;
  innerBinLength: number;
  spacingMm: number;
  angles: number[];
}): { placed: EnginePlacement[]; fitness: number } {
  const W = options.innerBinWidth;
  const L = options.innerBinLength;
  const primary = packShelfSingleSheetBest(options);
  if (Math.abs(W - L) < BIN_FIT_EPS_MM) {
    return primary;
  }
  const swappedRaw = packShelfSingleSheetBest({
    ...options,
    innerBinWidth: L,
    innerBinLength: W,
  });
  const swapped = {
    placed: remapShelfPlacementsSwapBinAxes(swappedRaw.placed),
    fitness: swappedRaw.fitness,
  };
  if (
    swapped.placed.length > primary.placed.length ||
    (swapped.placed.length === primary.placed.length &&
      swapped.fitness < primary.fitness)
  ) {
    return swapped;
  }
  return primary;
}
