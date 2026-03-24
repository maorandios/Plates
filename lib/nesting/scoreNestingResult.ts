import { applyPlacementToRing } from "./applyPlacementTransform";
import type { NormalizedNestShape } from "./convertGeometryToSvgNest";
import type { EnginePlacement } from "./shelfNestEngine";

function ringBBoxFromPairs(world: [number, number][]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of world) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function outerBBoxMm(
  pl: EnginePlacement,
  shape: NormalizedNestShape
): { minX: number; minY: number; maxX: number; maxY: number } {
  const world = applyPlacementToRing(
    shape.outer,
    pl.rotate,
    pl.translate.x,
    pl.translate.y
  );
  return ringBBoxFromPairs(world);
}

function mergeIntervals(
  intervals: [number, number][]
): [number, number][] {
  if (intervals.length === 0) return [];
  const s = [...intervals].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let [cs, ce] = s[0]!;
  for (let i = 1; i < s.length; i++) {
    const [a, b] = s[i]!;
    if (a <= ce) ce = Math.max(ce, b);
    else {
      out.push([cs, ce]);
      cs = a;
      ce = b;
    }
  }
  out.push([cs, ce]);
  return out;
}

function coveredWidthOnSliceY(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  sliceY: number,
  clipMinX: number,
  clipMaxX: number
): number {
  const iv: [number, number][] = [];
  for (const pl of placed) {
    const sh = shapeById.get(pl.id);
    if (!sh) continue;
    const bb = outerBBoxMm(pl, sh);
    if (sliceY < bb.minY || sliceY > bb.maxY) continue;
    iv.push([Math.max(clipMinX, bb.minX), Math.min(clipMaxX, bb.maxX)]);
  }
  const merged = mergeIntervals(iv);
  let sum = 0;
  for (const [a, b] of merged) sum += Math.max(0, b - a);
  return sum;
}

function coveredHeightOnSliceX(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  sliceX: number,
  clipMinY: number,
  clipMaxY: number
): number {
  const iv: [number, number][] = [];
  for (const pl of placed) {
    const sh = shapeById.get(pl.id);
    if (!sh) continue;
    const bb = outerBBoxMm(pl, sh);
    if (sliceX < bb.minX || sliceX > bb.maxX) continue;
    iv.push([Math.max(clipMinY, bb.minY), Math.min(clipMaxY, bb.maxY)]);
  }
  const merged = mergeIntervals(iv);
  let sum = 0;
  for (const [a, b] of merged) sum += Math.max(0, b - a);
  return sum;
}

function envelopeChannelAndFragmentation(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  innerWidthMm: number,
  innerLengthMm: number,
  layoutMinX: number,
  layoutMaxX: number,
  layoutMinY: number,
  layoutMaxY: number
): {
  rightStripWasteMm2: number;
  horizontalChannelMm2: number;
  verticalChannelMm2: number;
  voidFragmentationScore: number;
} {
  const envW = Math.max(0, layoutMaxX - layoutMinX);
  const envH = Math.max(0, layoutMaxY - layoutMinY);
  const rightStripWasteMm2 = Math.max(0, innerWidthMm - layoutMaxX) * layoutMaxY;

  const steps = 16;
  let horizontalChannelMm2 = 0;
  if (envH > 1e-6 && envW > 1e-6) {
    const dy = envH / steps;
    for (let i = 0; i < steps; i++) {
      const y = layoutMinY + dy * (i + 0.5);
      const cov = coveredWidthOnSliceY(
        placed,
        shapeById,
        y,
        layoutMinX,
        layoutMaxX
      );
      horizontalChannelMm2 += Math.max(0, envW - cov) * dy;
    }
  }

  let verticalChannelMm2 = 0;
  if (envH > 1e-6 && envW > 1e-6) {
    const dx = envW / steps;
    for (let i = 0; i < steps; i++) {
      const x = layoutMinX + dx * (i + 0.5);
      const cov = coveredHeightOnSliceX(
        placed,
        shapeById,
        x,
        layoutMinY,
        layoutMaxY
      );
      verticalChannelMm2 += Math.max(0, envH - cov) * dx;
    }
  }

  const gx = 20;
  const gy = 20;
  let voidFragmentationScore = 0;
  if (envW > 1e-6 && envH > 1e-6 && placed.length > 0) {
    const cellW = envW / gx;
    const cellH = envH / gy;
    const occ = new Uint8Array(gx * gy);
    for (let iy = 0; iy < gy; iy++) {
      for (let ix = 0; ix < gx; ix++) {
        const cx = layoutMinX + (ix + 0.5) * cellW;
        const cy = layoutMinY + (iy + 0.5) * cellH;
        for (const pl of placed) {
          const sh = shapeById.get(pl.id);
          if (!sh) continue;
          const bb = outerBBoxMm(pl, sh);
          if (cx >= bb.minX && cx <= bb.maxX && cy >= bb.minY && cy <= bb.maxY) {
            occ[iy * gx + ix] = 1;
            break;
          }
        }
      }
    }
    const seen = new Uint8Array(gx * gy);
    for (let i = 0; i < occ.length; i++) {
      if (occ[i] || seen[i]) continue;
      const q: number[] = [i];
      seen[i] = 1;
      let size = 0;
      while (q.length) {
        const cur = q.pop()!;
        size++;
        const ix = cur % gx;
        const iy = (cur / gx) | 0;
        const nbs = [
          ix > 0 ? cur - 1 : -1,
          ix + 1 < gx ? cur + 1 : -1,
          iy > 0 ? cur - gx : -1,
          iy + 1 < gy ? cur + gx : -1,
        ];
        for (const nb of nbs) {
          if (nb < 0 || occ[nb] || seen[nb]) continue;
          seen[nb] = 1;
          q.push(nb);
        }
      }
      if (size > 2) voidFragmentationScore += size * size;
    }
  }

  return {
    rightStripWasteMm2,
    horizontalChannelMm2,
    verticalChannelMm2,
    voidFragmentationScore,
  };
}

export interface SheetNestingMetrics {
  placedCount: number;
  utilization: number;
  wasteAreaMm2: number;
  sheetAreaMm2: number;
  usedAreaMm2: number;
}

/** Layout shape metrics for comparing “scattered” vs compact nests. */
export interface SheetLayoutQuality extends SheetNestingMetrics {
  /** Axis-aligned bbox area enclosing all placed part outers (mm²). */
  layoutBBoxAreaMm2: number;
  /** Max Y of placed outers (skyline height, mm). */
  layoutMaxYmm: number;
  /** Min X / max X of placed outers (mm). */
  layoutMinXmm: number;
  layoutMaxXmm: number;
  /** Rough void inside the layout bbox: bbox area − used part area (mm²). */
  internalVoidMm2: number;
  innerWidthMm: number;
  innerLengthMm: number;
  /** Unused strip to the right of content up to skyline (heuristic, mm²). */
  rightStripWasteMm2: number;
  /** Integrated horizontal gaps inside the used envelope (mm²). */
  horizontalChannelMm2: number;
  /** Integrated vertical gaps inside the used envelope (mm²). */
  verticalChannelMm2: number;
  /** Coarse void fragmentation (higher = more scattered pockets). */
  voidFragmentationScore: number;
}

export function metricsFromPlacements(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  innerWidthMm: number,
  innerLengthMm: number
): SheetNestingMetrics {
  const sheetAreaMm2 = innerWidthMm * innerLengthMm;
  let usedAreaMm2 = 0;
  for (const p of placed) {
    usedAreaMm2 += shapeById.get(p.id)?.netAreaMm2 ?? 0;
  }
  const utilization =
    sheetAreaMm2 > 0 ? usedAreaMm2 / sheetAreaMm2 : 0;
  return {
    placedCount: placed.length,
    utilization,
    wasteAreaMm2: Math.max(0, sheetAreaMm2 - usedAreaMm2),
    sheetAreaMm2,
    usedAreaMm2,
  };
}

/** Returns positive if `a` is strictly better than `b`. */
export function compareSheetMetrics(a: SheetNestingMetrics, b: SheetNestingMetrics): number {
  if (a.placedCount !== b.placedCount) return a.placedCount - b.placedCount;
  if (Math.abs(a.utilization - b.utilization) > 1e-9) {
    return a.utilization > b.utilization ? 1 : -1;
  }
  return a.wasteAreaMm2 < b.wasteAreaMm2 ? 1 : -1;
}

export function layoutQualityFromPlacements(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  innerWidthMm: number,
  innerLengthMm: number
): SheetLayoutQuality {
  const base = metricsFromPlacements(
    placed,
    shapeById,
    innerWidthMm,
    innerLengthMm
  );
  if (placed.length === 0) {
    return {
      ...base,
      layoutBBoxAreaMm2: 0,
      layoutMaxYmm: 0,
      layoutMinXmm: 0,
      layoutMaxXmm: 0,
      internalVoidMm2: base.sheetAreaMm2,
      innerWidthMm: innerWidthMm,
      innerLengthMm: innerLengthMm,
      rightStripWasteMm2: innerWidthMm * innerLengthMm,
      horizontalChannelMm2: 0,
      verticalChannelMm2: 0,
      voidFragmentationScore: 0,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pl of placed) {
    const sh = shapeById.get(pl.id);
    if (!sh) continue;
    const world = applyPlacementToRing(
      sh.outer,
      pl.rotate,
      pl.translate.x,
      pl.translate.y
    );
    for (const [x, y] of world) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const w = Math.max(0, maxX - minX);
  const h = Math.max(0, maxY - minY);
  const layoutBBoxAreaMm2 = w * h;
  const internalVoidMm2 = Math.max(0, layoutBBoxAreaMm2 - base.usedAreaMm2);

  const layoutMinX = Number.isFinite(minX) ? minX : 0;
  const layoutMaxX = Number.isFinite(maxX) ? maxX : 0;
  const layoutMinY = Number.isFinite(minY) ? minY : 0;
  const layoutMaxY = Number.isFinite(maxY) ? maxY : 0;

  const extra = envelopeChannelAndFragmentation(
    placed,
    shapeById,
    innerWidthMm,
    innerLengthMm,
    layoutMinX,
    layoutMaxX,
    layoutMinY,
    layoutMaxY
  );

  return {
    ...base,
    layoutBBoxAreaMm2,
    layoutMaxYmm: layoutMaxY,
    layoutMinXmm: layoutMinX,
    layoutMaxXmm: layoutMaxX,
    internalVoidMm2,
    innerWidthMm,
    innerLengthMm,
    ...extra,
  };
}

/**
 * Prefers more parts, higher utilization, then **tighter** layout (smaller bbox, lower skyline,
 * less internal void), then sheet waste.
 */
export function compareSheetLayoutQuality(
  a: SheetLayoutQuality,
  b: SheetLayoutQuality
): number {
  if (a.placedCount !== b.placedCount) return a.placedCount - b.placedCount;
  if (Math.abs(a.utilization - b.utilization) > 1e-9) {
    return a.utilization > b.utilization ? 1 : -1;
  }
  if (Math.abs(a.layoutBBoxAreaMm2 - b.layoutBBoxAreaMm2) > 1e-3) {
    return a.layoutBBoxAreaMm2 < b.layoutBBoxAreaMm2 ? 1 : -1;
  }
  if (Math.abs(a.layoutMaxYmm - b.layoutMaxYmm) > 1e-4) {
    return a.layoutMaxYmm < b.layoutMaxYmm ? 1 : -1;
  }
  if (Math.abs(a.internalVoidMm2 - b.internalVoidMm2) > 1e-2) {
    return a.internalVoidMm2 < b.internalVoidMm2 ? 1 : -1;
  }
  const chA = a.horizontalChannelMm2 + a.verticalChannelMm2;
  const chB = b.horizontalChannelMm2 + b.verticalChannelMm2;
  if (Math.abs(chA - chB) > 1e-1) {
    return chA < chB ? 1 : -1;
  }
  if (Math.abs(a.rightStripWasteMm2 - b.rightStripWasteMm2) > 1e-1) {
    return a.rightStripWasteMm2 < b.rightStripWasteMm2 ? 1 : -1;
  }
  if (Math.abs(a.voidFragmentationScore - b.voidFragmentationScore) > 0.5) {
    return a.voidFragmentationScore < b.voidFragmentationScore ? 1 : -1;
  }
  return a.wasteAreaMm2 < b.wasteAreaMm2 ? 1 : -1;
}
