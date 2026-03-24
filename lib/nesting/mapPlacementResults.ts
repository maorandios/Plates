/**
 * Maps engine placements to persisted / viewer `SheetPlacement` rows (true outer + holes).
 */

import type { SheetPlacement } from "@/types";
import { applyPlacementToRing } from "./applyPlacementTransform";
import type { NormalizedNestShape } from "./convertGeometryToSvgNest";
import type { EnginePlacement } from "./shelfNestEngine";

const INNER_CLAMP_EPS_MM = 0.05;

function ringBBoxMm(ring: [number, number][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Nudges translation so the displayed outer contour sits inside the inner bin
 * (fixes rare numeric / remap drift so the viewer never shows parts outside the dashed margin).
 */
function clampTranslationToInnerBin(
  shape: NormalizedNestShape,
  rot: number,
  tx: number,
  ty: number,
  innerW: number,
  innerL: number
): { tx: number; ty: number } {
  let x = tx;
  let y = ty;
  for (let i = 0; i < 20; i++) {
    const outer = applyPlacementToRing(shape.outer, rot, x, y);
    const b = ringBBoxMm(outer);
    let moved = false;
    if (b.minX < -INNER_CLAMP_EPS_MM) {
      x += -b.minX;
      moved = true;
    } else if (b.maxX > innerW + INNER_CLAMP_EPS_MM) {
      x -= b.maxX - innerW;
      moved = true;
    }
    if (b.minY < -INNER_CLAMP_EPS_MM) {
      y += -b.minY;
      moved = true;
    } else if (b.maxY > innerL + INNER_CLAMP_EPS_MM) {
      y -= b.maxY - innerL;
      moved = true;
    }
    if (!moved) break;
  }
  return { tx: x, ty: y };
}

export function sheetPlacementFromEnginePlacement(
  pl: EnginePlacement,
  shape: NormalizedNestShape,
  innerBin?: { innerWidthMm: number; innerLengthMm: number }
): SheetPlacement {
  const rot = pl.rotate;
  let tx = pl.translate.x;
  let ty = pl.translate.y;
  if (innerBin) {
    const c = clampTranslationToInnerBin(
      shape,
      rot,
      tx,
      ty,
      innerBin.innerWidthMm,
      innerBin.innerLengthMm
    );
    tx = c.tx;
    ty = c.ty;
  }
  const outerContour = applyPlacementToRing(shape.outer, rot, tx, ty);
  const innerContours = shape.holes.map((h) =>
    applyPlacementToRing(h, rot, tx, ty)
  );
  return {
    partInstanceId: shape.partInstanceId,
    partId: shape.partId,
    partName: shape.partName,
    clientId: shape.clientId,
    clientCode: shape.clientCode,
    x: tx,
    y: ty,
    rotation: rot,
    outerContour,
    innerContours,
    markingText: shape.markingText,
    partNetAreaMm2: shape.netAreaMm2,
  };
}
