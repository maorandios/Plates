/**
 * Polygon-aware nesting: shelf rows (fast) plus bottom-left search on a vertex+grid
 * candidate set so peaked / “house” shapes can interlock (e.g. 0°/180°) instead of
 * leaving triangular voids from pure AABB row advance. Optional slide compaction
 * nudges parts toward neighbors without overlap (approaches common-cut geometry;
 * kerf still comes from the spacing footprint).
 */

import type {
  NormalizedNestShape,
  NestPoint,
  PolygonAwareNestShape,
} from "./convertGeometryToSvgNest";
import {
  nestingFootprintCacheKey,
  type NestingFootprintGeometryCache,
} from "./cacheNestingGeometry";
import { prepareNestingFootprintForPlacement } from "./prepareNestingFootprint";
import { intersectionAreaMm2 } from "./clipperFootprintOps";
import {
  remapShelfPlacementsSwapBinAxes,
  type EnginePlacement,
} from "./shelfNestEngine";

const BIN_FIT_EPS_MM = 0.05;
const OVERLAP_AREA_EPS_MM2 = 2;
const SLIDE_STEP_MM = 0.5;
/** Keep compaction bounded — each step runs Clipper against all other parts. */
const SLIDE_MAX_STEPS = 100;
const COMPACT_SWEEPS = 2;

/**
 * Bottom-left search is O(candidates² × rotations × parts × overlaps) Clipper calls.
 * Skip it for large jobs or free rotation (12 angles) so the UI thread never freezes.
 */
const BLF_MAX_PART_COUNT = 18;
const BLF_MAX_BIN_AREA_MM2 = 2_200_000;
const BLF_MAX_ANGLE_COUNT = 4;
const BLF_AXIS_CANDIDATES_CAP = 18;

const COMPACT_MAX_PLACED_COUNT = 32;

function shouldRunBottomLeftSearch(
  partCount: number,
  binW: number,
  binH: number,
  angleCount: number
): boolean {
  if (partCount > BLF_MAX_PART_COUNT) return false;
  if (angleCount > BLF_MAX_ANGLE_COUNT) return false;
  if (binW * binH > BLF_MAX_BIN_AREA_MM2) return false;
  return true;
}

function shouldRunCompaction(placedCount: number): boolean {
  return placedCount > 0 && placedCount <= COMPACT_MAX_PLACED_COUNT;
}

/** Prefer 0°/180° first when both exist so peaked parts can nest tip-to-base. */
function anglesPrioritizeHalfTurns(angles: number[]): number[] {
  const uniq = [...new Set(angles)];
  if (uniq.includes(0) && uniq.includes(180)) {
    const rest = uniq.filter((d) => d !== 0 && d !== 180);
    return [0, 180, ...rest];
  }
  return uniq;
}

function clampToBin(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function minMaxYOfRing(ring: NestPoint[]): { minY: number; maxY: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minY, maxY };
}

function minMaxXOfRing(ring: NestPoint[]): { minX: number; maxX: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
  }
  return { minX, maxX };
}

/** True when every vertex lies inside the axis-aligned inner bin (strict; avoids Clipper area slack letting edges stick out). */
function isFootprintAxisAlignedInsideBin(
  world: NestPoint[],
  binW: number,
  binH: number,
  eps = 0.08
): boolean {
  const { minX, maxX } = minMaxXOfRing(world);
  const { minY, maxY } = minMaxYOfRing(world);
  return (
    minX >= -eps &&
    minY >= -eps &&
    maxX <= binW + eps &&
    maxY <= binH + eps
  );
}

/**
 * Validates footprint layout in physical inner-bin coordinates (after optional axis remap).
 */
export function validatePolygonAwareLayoutInBin(
  placed: EnginePlacement[],
  parts: PolygonAwareNestShape[],
  binW: number,
  binH: number
): boolean {
  const byId = new Map(parts.map((p) => [p.partInstanceId, p]));
  const worlds: NestPoint[][] = [];
  for (const pl of placed) {
    const sh = byId.get(pl.id);
    if (!sh) return false;
    const w = transformFootprintRing(
      sh.nestingFootprintLocal,
      pl.rotate,
      pl.translate.x,
      pl.translate.y
    );
    if (!isFootprintAxisAlignedInsideBin(w, binW, binH)) return false;
    worlds.push(w);
  }
  for (let i = 0; i < worlds.length; i++) {
    for (let j = i + 1; j < worlds.length; j++) {
      if (intersectionAreaMm2(worlds[i]!, worlds[j]!) > OVERLAP_AREA_EPS_MM2) {
        return false;
      }
    }
  }
  return true;
}

function buildAxisCandidates(
  binLen: number,
  placedWorld: NestPoint[][],
  axis: "x" | "y",
  maxPoints: number
): number[] {
  const s = new Set<number>();
  s.add(0);
  const gridN = Math.min(
    14,
    Math.max(6, Math.ceil(binLen / Math.max(10, binLen / 14)))
  );
  for (let i = 0; i <= gridN; i++) {
    s.add((binLen * i) / gridN);
  }
  for (const ring of placedWorld) {
    const stride = Math.max(1, Math.floor(ring.length / 14));
    for (let i = 0; i < ring.length; i += stride) {
      const p = ring[i]!;
      const v = axis === "x" ? p.x : p.y;
      if (v >= -1 && v <= binLen + 1) {
        s.add(clampToBin(v, 0, binLen));
      }
    }
  }
  const arr = [...s].sort((a, b) => a - b);
  if (arr.length <= maxPoints) return arr;
  const out: number[] = [];
  const step = (arr.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(arr.length - 1, Math.round(i * step));
    out.push(arr[idx]!);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function footprintWorldValid(
  world: NestPoint[],
  binW: number,
  binH: number,
  placedWorld: NestPoint[][],
  selfIndex: number
): boolean {
  if (!isFootprintAxisAlignedInsideBin(world, binW, binH)) return false;
  for (let j = 0; j < placedWorld.length; j++) {
    if (j === selfIndex) continue;
    if (intersectionAreaMm2(world, placedWorld[j]!) > OVERLAP_AREA_EPS_MM2) {
      return false;
    }
  }
  return true;
}

function compactPlacementsTowardNeighbors(
  placed: EnginePlacement[],
  parts: PolygonAwareNestShape[],
  binW: number,
  binH: number
): void {
  const byId = new Map(parts.map((p) => [p.partInstanceId, p]));
  for (let sweep = 0; sweep < COMPACT_SWEEPS; sweep++) {
    const placedWorld = placed.map((pl) => {
      const sh = byId.get(pl.id)!;
      return transformFootprintRing(
        sh.nestingFootprintLocal,
        pl.rotate,
        pl.translate.x,
        pl.translate.y
      );
    });

    for (let i = 0; i < placed.length; i++) {
      const pl = placed[i]!;
      const shape = byId.get(pl.id);
      if (!shape) continue;

      for (let s = 0; s < SLIDE_MAX_STEPS; s++) {
        const nty = pl.translate.y - SLIDE_STEP_MM;
        const world = transformFootprintRing(
          shape.nestingFootprintLocal,
          pl.rotate,
          pl.translate.x,
          nty
        );
        if (!footprintWorldValid(world, binW, binH, placedWorld, i)) break;
        pl.translate.y = nty;
        placedWorld[i] = world;
      }
      for (let s = 0; s < SLIDE_MAX_STEPS; s++) {
        const ntx = pl.translate.x - SLIDE_STEP_MM;
        const world = transformFootprintRing(
          shape.nestingFootprintLocal,
          pl.rotate,
          ntx,
          pl.translate.y
        );
        if (!footprintWorldValid(world, binW, binH, placedWorld, i)) break;
        pl.translate.x = ntx;
        placedWorld[i] = world;
      }
    }
  }
}

function rotatePointNest(x: number, y: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

function aabbOfRotatedNestPoints(ring: NestPoint[], rotDeg: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    const [rx, ry] = rotatePointNest(p.x, p.y, rotDeg);
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function axisAlignedBBoxRectangle(outer: NestPoint[]): NestPoint[] {
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outer) {
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
  }
  return [
    { x: 0, y: 0 },
    { x: maxX, y: 0 },
    { x: maxX, y: maxY },
    { x: 0, y: maxY },
  ];
}

function transformFootprintRing(
  ring: NestPoint[],
  rotDeg: number,
  tx: number,
  ty: number
): NestPoint[] {
  const r = (rotDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return ring.map((p) => ({
    x: p.x * c - p.y * s + tx,
    y: p.x * s + p.y * c + ty,
  }));
}

export interface AdaptFootprintOptions {
  /** 0 = no simplification after spacing offset. */
  simplifyToleranceMm?: number;
  footprintCache?: NestingFootprintGeometryCache;
}

/**
 * Step A/B: build per-part nesting footprints (offset outer) with bbox fallback per part.
 * Optional simplification and cross-instance cache (same outer + spacing + tolerance).
 */
export function adaptNormalizedShapesForPolygonPlacement(
  normalized: NormalizedNestShape[],
  spacingMm: number,
  logIssue?: (message: string) => void,
  adaptOpts?: AdaptFootprintOptions
): {
  parts: PolygonAwareNestShape[];
  polygonPartsCount: number;
  bboxFallbackPartsCount: number;
  fallbackPartIds: string[];
  conversionMessages: string[];
  footprintStats: {
    simplifyOriginalPointsTotal: number;
    simplifySimplifiedPointsTotal: number;
    reusedInstanceCount: number;
  };
} {
  const half = Math.max(0, spacingMm) / 2;
  const simplifyTol = adaptOpts?.simplifyToleranceMm ?? 0;
  const cache = adaptOpts?.footprintCache;
  const parts: PolygonAwareNestShape[] = [];
  let polygonPartsCount = 0;
  let bboxFallbackPartsCount = 0;
  const fallbackPartIds: string[] = [];
  const conversionMessages: string[] = [];
  let simplifyOriginalPointsTotal = 0;
  let simplifySimplifiedPointsTotal = 0;
  let reusedInstanceCount = 0;

  for (const shape of normalized) {
    const cacheKey = cache
      ? nestingFootprintCacheKey(shape.outer, half, simplifyTol)
      : "";
    const hit = cache && cacheKey ? cache.peek(cacheKey) : undefined;
    if (hit && hit.placementFootprintSource === "polygon") {
      cache!.onHit();
      reusedInstanceCount += 1;
      simplifyOriginalPointsTotal += hit.originalPointCountForSimplify;
      simplifySimplifiedPointsTotal += hit.simplifiedPointCount;
      polygonPartsCount += 1;
      parts.push({
        ...shape,
        nestingFootprintLocal: cache!.cloneEntry(hit).nestingFootprintLocal,
        placementFootprintSource: "polygon",
      });
      continue;
    }
    if (cache && cacheKey) cache.onMiss();

    const prepared = prepareNestingFootprintForPlacement(
      shape.outer,
      half,
      simplifyTol
    );
    if (!prepared.ok) {
      const msg = `[nesting] Polygon footprint fallback (bbox) for ${shape.partInstanceId} (${shape.partName}): ${prepared.reason}`;
      conversionMessages.push(msg);
      logIssue?.(msg);
      bboxFallbackPartsCount += 1;
      fallbackPartIds.push(shape.partInstanceId);
      parts.push({
        ...shape,
        nestingFootprintLocal: axisAlignedBBoxRectangle(shape.outer),
        placementFootprintSource: "bbox_fallback",
      });
      continue;
    }

    const fp = prepared.nestingFootprintLocal;
    const origPts =
      prepared.simplify?.originalPointCount ??
      prepared.spacedPointCountBeforeSimplify;
    const simPts =
      prepared.simplify?.simplifiedPointCount ??
      prepared.spacedPointCountBeforeSimplify;
    simplifyOriginalPointsTotal += origPts;
    simplifySimplifiedPointsTotal += simPts;

    polygonPartsCount += 1;
    parts.push({
      ...shape,
      nestingFootprintLocal: fp,
      placementFootprintSource: "polygon",
    });

    if (cache && cacheKey) {
      cache.put(cacheKey, {
        nestingFootprintLocal: fp.map((p) => ({ x: p.x, y: p.y })),
        placementFootprintSource: "polygon",
        spacedPointCountBeforeSimplify: prepared.spacedPointCountBeforeSimplify,
        originalPointCountForSimplify: origPts,
        simplifiedPointCount: simPts,
      });
    }
  }

  return {
    parts,
    polygonPartsCount,
    bboxFallbackPartsCount,
    fallbackPartIds,
    conversionMessages,
    footprintStats: {
      simplifyOriginalPointsTotal,
      simplifySimplifiedPointsTotal,
      reusedInstanceCount,
    },
  };
}

/**
 * Bottom-left style search: tries anchor points from a coarse grid plus vertices of
 * already placed footprints, all rotations, scores by lowest top Y then leftmost X.
 */
export function packPolygonAwareBottomLeftSingleSheet(options: {
  parts: PolygonAwareNestShape[];
  innerBinWidth: number;
  innerBinLength: number;
  angles: number[];
  /** Hard cap on axis sample count (smaller = faster). */
  maxAxisCandidates?: number;
}): { placed: EnginePlacement[]; fitness: number } {
  const {
    parts,
    innerBinWidth,
    innerBinLength,
    angles,
    maxAxisCandidates = BLF_AXIS_CANDIDATES_CAP,
  } = options;
  const binW = innerBinWidth;
  const binH = innerBinLength;
  const rotOrder = anglesPrioritizeHalfTurns(angles);

  const sorted = [...parts].sort(
    (a, b) => Math.abs(b.netAreaMm2) - Math.abs(a.netAreaMm2)
  );

  const placed: EnginePlacement[] = [];
  const placedWorld: NestPoint[][] = [];

  const maxCand = Math.max(
    10,
    Math.min(BLF_AXIS_CANDIDATES_CAP, maxAxisCandidates)
  );

  for (const item of sorted) {
    const xc = buildAxisCandidates(binW, placedWorld, "x", maxCand);
    const yc = buildAxisCandidates(binH, placedWorld, "y", maxCand);

    let bestScore = Number.POSITIVE_INFINITY;
    let best: EnginePlacement | null = null;
    let bestWorld: NestPoint[] | null = null;

    for (const y0 of yc) {
      for (const x0 of xc) {
        for (const rot of rotOrder) {
          const bb = aabbOfRotatedNestPoints(item.nestingFootprintLocal, rot);
          const tx = x0 - bb.minX;
          const ty = y0 - bb.minY;
          const world = transformFootprintRing(
            item.nestingFootprintLocal,
            rot,
            tx,
            ty
          );
          if (!footprintWorldValid(world, binW, binH, placedWorld, placedWorld.length)) {
            continue;
          }
          const { maxY } = minMaxYOfRing(world);
          const { minX } = minMaxXOfRing(world);
          const score = maxY * 1e7 + minX;
          if (score < bestScore) {
            bestScore = score;
            best = {
              id: item.partInstanceId,
              translate: { x: tx, y: ty },
              rotate: rot,
            };
            bestWorld = world;
          }
        }
      }
    }

    if (best && bestWorld) {
      placed.push(best);
      placedWorld.push(bestWorld);
    }
  }

  const sheetArea = binW * binH;
  const used = placed.reduce((sum, p) => {
    const sh = parts.find((n) => n.partInstanceId === p.id);
    return sum + (sh?.netAreaMm2 ?? 0);
  }, 0);
  const fitness = sheetArea > 0 ? 1 - used / sheetArea : 1;
  return { placed, fitness };
}

function firstFitRotationPolygon(
  shape: PolygonAwareNestShape,
  px: number,
  py: number,
  binW: number,
  binH: number,
  angles: number[],
  placedWorld: NestPoint[][]
): { ew: number; eh: number; placement: EnginePlacement } | null {
  for (const rot of anglesPrioritizeHalfTurns(angles)) {
    const { minX, minY, w, h } = aabbOfRotatedNestPoints(
      shape.nestingFootprintLocal,
      rot
    );
    const tx = px - minX;
    const ty = py - minY;
    const world = transformFootprintRing(shape.nestingFootprintLocal, rot, tx, ty);
    if (!isFootprintAxisAlignedInsideBin(world, binW, binH)) {
      continue;
    }
    let overlaps = false;
    for (const prev of placedWorld) {
      if (intersectionAreaMm2(world, prev) > OVERLAP_AREA_EPS_MM2) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    return {
      ew: w,
      eh: h,
      placement: {
        id: shape.partInstanceId,
        translate: { x: tx, y: ty },
        rotate: rot,
      },
    };
  }
  return null;
}

function maxSide0Footprint(shape: PolygonAwareNestShape): number {
  const { w, h } = aabbOfRotatedNestPoints(shape.nestingFootprintLocal, 0);
  return Math.max(w, h);
}

export type PolygonShelfSort = (
  a: PolygonAwareNestShape,
  b: PolygonAwareNestShape
) => number;

function sortByAreaDesc(a: PolygonAwareNestShape, b: PolygonAwareNestShape) {
  return Math.abs(b.netAreaMm2) - Math.abs(a.netAreaMm2);
}

function sortByMinSideAsc(a: PolygonAwareNestShape, b: PolygonAwareNestShape) {
  const { w: wa, h: ha } = aabbOfRotatedNestPoints(a.nestingFootprintLocal, 0);
  const { w: wb, h: hb } = aabbOfRotatedNestPoints(b.nestingFootprintLocal, 0);
  return Math.min(wa, ha) - Math.min(wb, hb);
}

function sortByWidthDesc(a: PolygonAwareNestShape, b: PolygonAwareNestShape) {
  const { w: wa } = aabbOfRotatedNestPoints(a.nestingFootprintLocal, 0);
  const { w: wb } = aabbOfRotatedNestPoints(b.nestingFootprintLocal, 0);
  return wb - wa;
}

export function packPolygonAwareShelfSingleSheet(options: {
  parts: PolygonAwareNestShape[];
  innerBinWidth: number;
  innerBinLength: number;
  angles: number[];
  sortCompare?: PolygonShelfSort;
}): { placed: EnginePlacement[]; fitness: number } {
  const { parts, innerBinWidth, innerBinLength, angles, sortCompare } = options;
  const binW = innerBinWidth;
  const binH = innerBinLength;

  const defaultSort: PolygonShelfSort = (a, b) =>
    maxSide0Footprint(b) - maxSide0Footprint(a);
  const sorted = [...parts].sort(sortCompare ?? defaultSort);

  let remaining = sorted;
  const placed: EnginePlacement[] = [];
  const placedWorld: NestPoint[][] = [];
  let y = 0;

  while (remaining.length > 0 && y < binH + BIN_FIT_EPS_MM) {
    let x = 0;
    let rowH = 0;
    const next: PolygonAwareNestShape[] = [];
    let any = false;
    for (const item of remaining) {
      const fit = firstFitRotationPolygon(
        item,
        x,
        y,
        binW,
        binH,
        angles,
        placedWorld
      );
      if (fit) {
        placed.push(fit.placement);
        const world = transformFootprintRing(
          item.nestingFootprintLocal,
          fit.placement.rotate,
          fit.placement.translate.x,
          fit.placement.translate.y
        );
        placedWorld.push(world);
        const { maxX } = minMaxXOfRing(world);
        x = Math.max(x, maxX);
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
    const sh = parts.find((n) => n.partInstanceId === p.id);
    return sum + (sh?.netAreaMm2 ?? 0);
  }, 0);
  const fitness = sheetArea > 0 ? 1 - used / sheetArea : 1;
  return { placed, fitness };
}

function pickBetterPack(
  a: { placed: EnginePlacement[]; fitness: number },
  b: { placed: EnginePlacement[]; fitness: number }
): { placed: EnginePlacement[]; fitness: number } {
  if (a.placed.length > b.placed.length) return a;
  if (b.placed.length > a.placed.length) return b;
  return a.fitness <= b.fitness ? a : b;
}

export function packPolygonAwareShelfSingleSheetBest(options: {
  parts: PolygonAwareNestShape[];
  innerBinWidth: number;
  innerBinLength: number;
  angles: number[];
}): { placed: EnginePlacement[]; fitness: number } {
  const presets: PolygonShelfSort[] = [
    (a, b) => maxSide0Footprint(b) - maxSide0Footprint(a),
    sortByAreaDesc,
    sortByMinSideAsc,
    sortByWidthDesc,
    (a, b) => maxSide0Footprint(a) - maxSide0Footprint(b),
  ];
  let best: { placed: EnginePlacement[]; fitness: number } = {
    placed: [],
    fitness: Number.POSITIVE_INFINITY,
  };
  for (const sortCompare of presets) {
    const r = packPolygonAwareShelfSingleSheet({ ...options, sortCompare });
    best = pickBetterPack(r, best);
  }

  const binW = options.innerBinWidth;
  const binH = options.innerBinLength;

  if (
    shouldRunBottomLeftSearch(
      options.parts.length,
      binW,
      binH,
      options.angles.length
    )
  ) {
    const blf = packPolygonAwareBottomLeftSingleSheet(options);
    best = pickBetterPack(blf, best);
  }

  if (shouldRunCompaction(best.placed.length)) {
    const placedCopy = best.placed.map((p) => ({
      id: p.id,
      translate: { x: p.translate.x, y: p.translate.y },
      rotate: p.rotate,
    }));
    compactPlacementsTowardNeighbors(placedCopy, options.parts, binW, binH);
    if (
      !validatePolygonAwareLayoutInBin(placedCopy, options.parts, binW, binH)
    ) {
      return {
        placed: best.placed.map((p) => ({
          id: p.id,
          translate: { x: p.translate.x, y: p.translate.y },
          rotate: p.rotate,
        })),
        fitness: best.fitness,
      };
    }
    const sheetArea = binW * binH;
    const used = placedCopy.reduce((sum, p) => {
      const sh = options.parts.find((n) => n.partInstanceId === p.id);
      return sum + (sh?.netAreaMm2 ?? 0);
    }, 0);
    const fitnessAfter = sheetArea > 0 ? 1 - used / sheetArea : 1;
    return { placed: placedCopy, fitness: fitnessAfter };
  }

  return {
    placed: best.placed.map((p) => ({
      id: p.id,
      translate: { x: p.translate.x, y: p.translate.y },
      rotate: p.rotate,
    })),
    fitness: best.fitness,
  };
}

export function packPolygonAwareShelfSingleSheetBestWithOrientation(options: {
  parts: PolygonAwareNestShape[];
  innerBinWidth: number;
  innerBinLength: number;
  angles: number[];
}): { placed: EnginePlacement[]; fitness: number } {
  const W = options.innerBinWidth;
  const L = options.innerBinLength;
  const primary = packPolygonAwareShelfSingleSheetBest(options);
  if (Math.abs(W - L) < BIN_FIT_EPS_MM) {
    return primary;
  }
  const swappedRaw = packPolygonAwareShelfSingleSheetBest({
    ...options,
    innerBinWidth: L,
    innerBinLength: W,
  });
  const swapped = {
    placed: remapShelfPlacementsSwapBinAxes(swappedRaw.placed),
    fitness: swappedRaw.fitness,
  };

  const primaryValid = validatePolygonAwareLayoutInBin(
    primary.placed,
    options.parts,
    W,
    L
  );
  const swappedValid = validatePolygonAwareLayoutInBin(
    swapped.placed,
    options.parts,
    W,
    L
  );

  const swappedScores =
    swapped.placed.length > primary.placed.length ||
    (swapped.placed.length === primary.placed.length &&
      swapped.fitness < primary.fitness);

  if (swappedValid && swappedScores) {
    return swapped;
  }
  if (swappedValid && !primaryValid) {
    return swapped;
  }
  return primary;
}
