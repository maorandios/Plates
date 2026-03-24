/**
 * Post-SVGNest placement refinement: scored anchor candidates (bottom-left bias),
 * cavity fill for unplaced parts, and compaction cycles. Does not replace SVGNest;
 * improves layouts that are valid but loose or channel-prone.
 */

import { applyPlacementToRing } from "./applyPlacementTransform";
import type { NormalizedNestShape } from "./convertGeometryToSvgNest";
import {
  intersectionAreaMm2,
  isSubjectEssentiallyInsideClip,
} from "./clipperFootprintOps";
import {
  compactPlacementsBottomLeft,
  nestingCollisionFootprintRing,
} from "./compactSvgnestPlacements";
import type { EnginePlacement } from "./shelfNestEngine";
import {
  layoutQualityFromPlacements,
  scoreLayoutQuality,
} from "./scoreNestingCandidate";
import type { NestPoint } from "./convertGeometryToSvgNest";

const STEP_MM = 0.35;
const OVERLAP_AREA_EPS_MM2 = 2.5;
const BIN_SLACK_MM2 = 0.75;
const MAX_ANCHOR_AXIS = 20;
const MAX_CORNER_PAIRS = 56;
const MAX_CANDIDATES_SCORED = 420;

function binRectangle(innerW: number, innerL: number): NestPoint[] {
  return [
    { x: 0, y: 0 },
    { x: innerW, y: 0 },
    { x: innerW, y: innerL },
    { x: 0, y: innerL },
  ];
}

function ringBBox(ring: NestPoint[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of ring) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function worldFootprint(
  pl: EnginePlacement,
  localRing: NestPoint[]
): NestPoint[] {
  const pairs = applyPlacementToRing(
    localRing,
    pl.rotate,
    pl.translate.x,
    pl.translate.y
  );
  return pairs.map(([x, y]) => ({ x, y }));
}

function rotatedLocalFootprintBBox(
  localFp: NestPoint[],
  rotDeg: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const atOrigin = applyPlacementToRing(localFp, rotDeg, 0, 0);
  return ringBBox(atOrigin.map(([x, y]) => ({ x, y })));
}

function sampleSortedUnique(values: number[], maxCount: number): number[] {
  const u = [...new Set(values)].sort((a, b) => a - b);
  if (u.length <= maxCount) return u;
  const out: number[] = [];
  const step = (u.length - 1) / (maxCount - 1);
  for (let i = 0; i < maxCount; i++) {
    out.push(u[Math.round(i * step)]!);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function layoutScore(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  innerW: number,
  innerL: number
): number {
  return scoreLayoutQuality(
    layoutQualityFromPlacements(placed, shapeById, innerW, innerL)
  );
}

function clonePlacements(p: EnginePlacement[]): EnginePlacement[] {
  return p.map((x) => ({
    id: x.id,
    rotate: x.rotate,
    translate: { x: x.translate.x, y: x.translate.y },
  }));
}

export interface RefineSvgnestContext {
  shapeById: Map<string, NormalizedNestShape>;
  innerW: number;
  innerL: number;
  spacingMm: number;
  allowRotation: boolean;
}

function buildFootprintMap(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  spacingMm: number
): Map<string, NestPoint[]> {
  const m = new Map<string, NestPoint[]>();
  for (const pl of placed) {
    const sh = shapeById.get(pl.id);
    if (!sh) continue;
    const fp = nestingCollisionFootprintRing(sh, spacingMm);
    if (fp) m.set(pl.id, fp);
  }
  return m;
}

function collectAnchorAxes(
  working: EnginePlacement[],
  footprintById: Map<string, NestPoint[]>,
  excludeId: string,
  innerW: number,
  innerL: number
): { xs: number[]; ys: number[]; cornerPairs: [number, number][] } {
  const xs = new Set<number>([0]);
  const ys = new Set<number>([0]);
  const boxes: { minX: number; minY: number; maxX: number; maxY: number }[] =
    [];

  for (const pl of working) {
    if (pl.id === excludeId) continue;
    const loc = footprintById.get(pl.id);
    if (!loc) continue;
    const bb = ringBBox(worldFootprint(pl, loc));
    if (!Number.isFinite(bb.minX)) continue;
    boxes.push(bb);
    xs.add(bb.minX);
    xs.add(bb.maxX);
    ys.add(bb.minY);
    ys.add(bb.maxY);
  }

  const cornerPairs: [number, number][] = [];
  const n = boxes.length;
  if (n <= 14) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        cornerPairs.push([boxes[i]!.maxX, boxes[j]!.maxY]);
      }
    }
  } else {
    const stride = Math.max(1, Math.ceil((n * n) / MAX_CORNER_PAIRS));
    let c = 0;
    outer: for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        c++;
        if (c % stride !== 0) continue;
        cornerPairs.push([boxes[i]!.maxX, boxes[j]!.maxY]);
        if (cornerPairs.length >= MAX_CORNER_PAIRS) break outer;
      }
    }
  }

  xs.add(innerW);
  ys.add(innerL);

  return {
    xs: sampleSortedUnique([...xs], MAX_ANCHOR_AXIS),
    ys: sampleSortedUnique([...ys], MAX_ANCHOR_AXIS),
    cornerPairs,
  };
}

function makeValidator(working: EnginePlacement[], footprintById: Map<string, NestPoint[]>, bin: NestPoint[]) {
  function worldsExcept(excludeId: string): NestPoint[][] {
    const out: NestPoint[][] = [];
    for (const pl of working) {
      if (pl.id === excludeId) continue;
      const loc = footprintById.get(pl.id);
      if (!loc) continue;
      out.push(worldFootprint(pl, loc));
    }
    return out;
  }

  const staticOtherWorldsById = new Map<string, NestPoint[][]>();

  return function isValid(pl: EnginePlacement, localFp: NestPoint[]): boolean {
    const world = worldFootprint(pl, localFp);
    if (!isSubjectEssentiallyInsideClip(world, bin, BIN_SLACK_MM2)) {
      return false;
    }
    let others = staticOtherWorldsById.get(pl.id);
    if (!others) {
      others = worldsExcept(pl.id);
      staticOtherWorldsById.set(pl.id, others);
    }
    for (const o of others) {
      if (intersectionAreaMm2(world, o) > OVERLAP_AREA_EPS_MM2) return false;
    }
    return true;
  };
}

function slideBottomLeft(
  pl: EnginePlacement,
  localFp: NestPoint[],
  isValid: (pl: EnginePlacement, fp: NestPoint[]) => boolean
): void {
  // Safety cap: prevent pathological long loops on huge/invalid coordinates.
  const maxXSteps = Math.max(
    1,
    Math.min(7000, Math.ceil((Math.abs(pl.translate.x) + 20) / STEP_MM))
  );
  for (let i = 0; i < maxXSteps; i++) {
    pl.translate.x -= STEP_MM;
    if (!isValid(pl, localFp)) {
      pl.translate.x += STEP_MM;
      break;
    }
  }
  const maxYSteps = Math.max(
    1,
    Math.min(7000, Math.ceil((Math.abs(pl.translate.y) + 20) / STEP_MM))
  );
  for (let i = 0; i < maxYSteps; i++) {
    pl.translate.y -= STEP_MM;
    if (!isValid(pl, localFp)) {
      pl.translate.y += STEP_MM;
      break;
    }
  }
}

function rotationsToTry(
  allowRotation: boolean,
  currentRot: number
): number[] {
  if (!allowRotation) return [currentRot];
  return [0, 90];
}

function enumerateCandidatesForPart(
  focusId: string,
  working: EnginePlacement[],
  footprintById: Map<string, NestPoint[]>,
  localFp: NestPoint[],
  ctx: RefineSvgnestContext,
  bin: NestPoint[],
  allowRotation: boolean,
  currentRot: number
): EnginePlacement[] {
  const { innerW, innerL } = ctx;
  const temp = working.filter((p) => p.id !== focusId);
  const isValid = makeValidator(temp, footprintById, bin);

  const { xs, ys, cornerPairs } = collectAnchorAxes(
    working,
    footprintById,
    focusId,
    innerW,
    innerL
  );

  const targets: [number, number][] = [];
  for (const xl of xs) {
    for (const yb of ys) targets.push([xl, yb]);
  }
  for (const c of cornerPairs) targets.push(c);

  const rots = rotationsToTry(allowRotation, currentRot);
  const out: EnginePlacement[] = [];
  const seen = new Set<string>();

  for (const rot of rots) {
    const bb0 = rotatedLocalFootprintBBox(localFp, rot);
    for (const [xl, yb] of targets) {
      const tx = xl - bb0.minX;
      const ty = yb - bb0.minY;
      const pl: EnginePlacement = {
        id: focusId,
        rotate: rot,
        translate: { x: tx, y: ty },
      };
      if (!isValid(pl, localFp)) continue;
      slideBottomLeft(pl, localFp, isValid);
      const key = `${pl.rotate.toFixed(0)}:${pl.translate.x.toFixed(2)},${pl.translate.y.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...pl, translate: { ...pl.translate } });
    }
  }

  out.sort((a, b) => {
    const wa = worldFootprint(a, localFp);
    const wb = worldFootprint(b, localFp);
    const ya = ringBBox(wa).minY;
    const yb = ringBBox(wb).minY;
    if (Math.abs(ya - yb) > 1e-4) return ya - yb;
    const xa = ringBBox(wa).minX;
    const xb = ringBBox(wb).minX;
    return xa - xb;
  });

  if (out.length > MAX_CANDIDATES_SCORED) {
    return out.slice(0, MAX_CANDIDATES_SCORED);
  }
  return out;
}

function tryImproveOnePart(
  working: EnginePlacement[],
  focusId: string,
  ctx: RefineSvgnestContext,
  footprintById: Map<string, NestPoint[]>,
  bin: NestPoint[],
  shapeById: Map<string, NormalizedNestShape>
): boolean {
  const sh = shapeById.get(focusId);
  if (!sh) return false;
  const localFp = nestingCollisionFootprintRing(sh, ctx.spacingMm);
  if (!localFp) return false;

  const cur = working.find((p) => p.id === focusId);
  if (!cur) return false;

  const baseScore = layoutScore(working, shapeById, ctx.innerW, ctx.innerL);
  const candidates = enumerateCandidatesForPart(
    focusId,
    working,
    footprintById,
    localFp,
    ctx,
    bin,
    ctx.allowRotation,
    cur.rotate
  );

  let best = clonePlacements(working);
  let bestScore = baseScore;

  for (const cand of candidates) {
    const trial = working.map((p) =>
      p.id === focusId ? { ...cand, translate: { ...cand.translate } } : { ...p }
    );
    const s = layoutScore(trial, shapeById, ctx.innerW, ctx.innerL);
    if (s > bestScore + 1e-6) {
      bestScore = s;
      best = trial;
    }
  }

  if (bestScore <= baseScore + 1e-6) return false;
  working.length = 0;
  working.push(...best);
  return true;
}

function orderPartIdsForRefinement(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  seed: number
): string[] {
  const ids = placed.map((p) => p.id);
  ids.sort((a, b) => {
    const sa = shapeById.get(a);
    const sb = shapeById.get(b);
    const aa = sa ? Math.abs(sa.netAreaMm2) : 0;
    const ab = sb ? Math.abs(sb.netAreaMm2) : 0;
    if (aa !== ab) return ab - aa;
    return a.localeCompare(b);
  });
  let s = (seed ^ 0xdeadbeef) >>> 0;
  for (let i = ids.length - 1; i > 0; i--) {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    const j = ((t ^ (t >>> 14)) >>> 0) % (i + 1);
    const tmp = ids[i]!;
    ids[i] = ids[j]!;
    ids[j] = tmp;
  }
  return ids;
}

/**
 * Greedy local search: repeatedly re-place each part at the best scored anchor
 * among wall / neighbor / corner targets (0° and 90° when rotation is allowed).
 */
export function refinePlacementsAnchorSearch(
  placed: EnginePlacement[],
  ctx: RefineSvgnestContext,
  options?: { globalRounds?: number }
): EnginePlacement[] {
  if (placed.length === 0) return placed;
  const globalRounds = options?.globalRounds ?? 4;
  const working = clonePlacements(placed);
  const bin = binRectangle(ctx.innerW, ctx.innerL);
  const { shapeById, innerW, innerL, spacingMm } = ctx;

  for (let g = 0; g < globalRounds; g++) {
    const footprintById = buildFootprintMap(working, shapeById, spacingMm);
    const order = orderPartIdsForRefinement(working, shapeById, g + 7);
    let any = false;
    for (const id of order) {
      if (tryImproveOnePart(working, id, ctx, footprintById, bin, shapeById)) {
        any = true;
      }
    }
    if (!any) break;
  }

  return compactPlacementsBottomLeft(
    working,
    shapeById,
    innerW,
    innerL,
    spacingMm
  );
}

function tryPlaceOneNewPart(
  partId: string,
  working: EnginePlacement[],
  ctx: RefineSvgnestContext,
  footprintById: Map<string, NestPoint[]>,
  bin: NestPoint[],
  shapeById: Map<string, NormalizedNestShape>
): EnginePlacement | null {
  const sh = shapeById.get(partId);
  if (!sh) return null;
  const localFp = nestingCollisionFootprintRing(sh, ctx.spacingMm);
  if (!localFp) return null;

  const candidates = enumerateCandidatesForPart(
    partId,
    working,
    footprintById,
    localFp,
    ctx,
    bin,
    ctx.allowRotation,
    0
  );

  let best: EnginePlacement | null = null;
  let bestScore = -Infinity;
  for (const cand of candidates) {
    const trial = [...working, cand];
    const s = layoutScore(trial, shapeById, ctx.innerW, ctx.innerL);
    if (s > bestScore) {
      bestScore = s;
      best = cand;
    }
  }
  return best;
}

/**
 * Places parts that SVGNest omitted, using the same anchor + score strategy (smallest first).
 */
export function fillCavitiesWithUnplacedParts(
  placed: EnginePlacement[],
  unplacedShapes: NormalizedNestShape[],
  ctx: RefineSvgnestContext
): EnginePlacement[] {
  if (unplacedShapes.length === 0) return placed;
  const working = clonePlacements(placed);
  const { shapeById, innerW, innerL, spacingMm } = ctx;

  const sorted = [...unplacedShapes].sort(
    (a, b) => Math.abs(a.netAreaMm2) - Math.abs(b.netAreaMm2)
  );

  for (const sh of sorted) {
    const bin = binRectangle(innerW, innerL);
    const footprintById = buildFootprintMap(working, shapeById, spacingMm);
    const pl = tryPlaceOneNewPart(
      sh.partInstanceId,
      working,
      ctx,
      footprintById,
      bin,
      shapeById
    );
    if (pl) {
      working.push(pl);
    }
  }

  return compactPlacementsBottomLeft(
    working,
    shapeById,
    innerW,
    innerL,
    spacingMm
  );
}

export interface PostProcessSvgnestOptions extends RefineSvgnestContext {
  /** Instance ids SVGNest already placed (others may still be fillable). */
  unplacedShapes?: NormalizedNestShape[];
}

/**
 * Compaction → anchor refinement → cavity fill → compaction → optional second cavity pass → compaction.
 */
export function postProcessSvgnestPlacements(
  placed: EnginePlacement[],
  options: PostProcessSvgnestOptions
): EnginePlacement[] {
  const {
    shapeById,
    innerW,
    innerL,
    spacingMm,
    allowRotation,
    unplacedShapes = [],
  } = options;

  let p = compactPlacementsBottomLeft(
    placed,
    shapeById,
    innerW,
    innerL,
    spacingMm
  );

  const ctx: RefineSvgnestContext = {
    shapeById,
    innerW,
    innerL,
    spacingMm,
    allowRotation,
  };

  p = refinePlacementsAnchorSearch(p, ctx, { globalRounds: 4 });
  p = compactPlacementsBottomLeft(p, shapeById, innerW, innerL, spacingMm);

  const placedIds = new Set(p.map((x) => x.id));
  const stillUnplaced = unplacedShapes.filter(
    (s) => !placedIds.has(s.partInstanceId)
  );
  if (stillUnplaced.length > 0) {
    p = fillCavitiesWithUnplacedParts(p, stillUnplaced, ctx);
  }

  p = compactPlacementsBottomLeft(p, shapeById, innerW, innerL, spacingMm);

  if (stillUnplaced.length > 0) {
    const ids2 = new Set(p.map((x) => x.id));
    const round2 = unplacedShapes.filter((s) => !ids2.has(s.partInstanceId));
    if (round2.length > 0) {
      p = fillCavitiesWithUnplacedParts(p, round2, ctx);
    }
  }

  p = refinePlacementsAnchorSearch(p, ctx, { globalRounds: 2 });
  p = compactPlacementsBottomLeft(p, shapeById, innerW, innerL, spacingMm);

  return p;
}
