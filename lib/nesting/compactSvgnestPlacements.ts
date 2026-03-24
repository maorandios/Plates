/**
 * Post-process SVGNest `EnginePlacement`s: bottom-left style compaction using the same
 * half-spacing collision footprint as polygon nesting (not display-only outer).
 */

import { applyPlacementToRing } from "./applyPlacementTransform";
import type { NormalizedNestShape, NestPoint } from "./convertGeometryToSvgNest";
import { createSpacingFootprint } from "./createSpacingFootprint";
import {
  intersectionAreaMm2,
  isSubjectEssentiallyInsideClip,
} from "./clipperFootprintOps";
import { preparePolygonFootprint } from "./preparePolygonFootprint";
import type { EnginePlacement } from "./shelfNestEngine";

const STEP_MM = 0.35;
const OVERLAP_AREA_EPS_MM2 = 2.5;
const BIN_SLACK_MM2 = 0.75;
const MAX_SWEEPS = 28;

function binRectangle(innerW: number, innerL: number): NestPoint[] {
  return [
    { x: 0, y: 0 },
    { x: innerW, y: 0 },
    { x: innerW, y: innerL },
    { x: 0, y: innerL },
  ];
}

/** Half-spacing collision ring (same rule as SVGNest footprint input). */
export function nestingCollisionFootprintRing(
  shape: NormalizedNestShape,
  spacingMm: number
): NestPoint[] | null {
  const half = Math.max(0, spacingMm) / 2;
  const prep = preparePolygonFootprint(shape.outer);
  if (!prep.ok) return null;
  const spaced = createSpacingFootprint(prep.ring, half);
  if (!spaced || spaced.length < 3) return null;
  return spaced;
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

/**
 * Nudges each part left (decreasing X) then down (decreasing Y) while the spacing
 * footprint stays inside the bin and does not overlap others — reduces “floating” gaps.
 */
export function compactPlacementsBottomLeft(
  placed: EnginePlacement[],
  shapeById: Map<string, NormalizedNestShape>,
  innerW: number,
  innerL: number,
  spacingMm: number
): EnginePlacement[] {
  if (placed.length === 0) return placed;

  const working: EnginePlacement[] = placed.map((p) => ({
    ...p,
    translate: { x: p.translate.x, y: p.translate.y },
  }));

  const footprintById = new Map<string, NestPoint[]>();
  for (const pl of working) {
    const sh = shapeById.get(pl.id);
    if (!sh) continue;
    const fp = nestingCollisionFootprintRing(sh, spacingMm);
    if (fp) footprintById.set(pl.id, fp);
  }

  const bin = binRectangle(innerW, innerL);

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

  function isValid(pl: EnginePlacement, localFp: NestPoint[]): boolean {
    const world = worldFootprint(pl, localFp);
    if (
      !isSubjectEssentiallyInsideClip(world, bin, BIN_SLACK_MM2)
    ) {
      return false;
    }
    for (const o of worldsExcept(pl.id)) {
      if (intersectionAreaMm2(world, o) > OVERLAP_AREA_EPS_MM2) return false;
    }
    return true;
  }

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let moved = false;

    const ordered = [...working].sort((a, b) => {
      const fa = footprintById.get(a.id);
      const fb = footprintById.get(b.id);
      if (!fa || !fb) return 0;
      const ba = ringBBox(worldFootprint(a, fa));
      const bb = ringBBox(worldFootprint(b, fb));
      if (ba.minY !== bb.minY) return ba.minY - bb.minY;
      return ba.minX - bb.minX;
    });

    for (const pl of ordered) {
      const loc = footprintById.get(pl.id);
      if (!loc) continue;

      while (true) {
        pl.translate.x -= STEP_MM;
        if (!isValid(pl, loc)) {
          pl.translate.x += STEP_MM;
          break;
        }
        moved = true;
      }
      while (true) {
        pl.translate.y -= STEP_MM;
        if (!isValid(pl, loc)) {
          pl.translate.y += STEP_MM;
          break;
        }
        moved = true;
      }
    }

    if (!moved) break;
  }

  return working;
}
