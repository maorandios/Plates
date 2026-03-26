import { pointInPolygon } from "@/lib/geometry/calc";
import type { Point } from "@/lib/geometry/extract";
import type { BuiltPlateGeometry } from "../types";

function axisAlignedRingBBox(ring: [number, number][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of ring) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  return { minX, minY, maxX, maxY };
}

function circleIntersectsExpandedRect(
  cx: number,
  cy: number,
  r: number,
  rx0: number,
  ry0: number,
  rx1: number,
  ry1: number
): boolean {
  const nx = Math.max(rx0, Math.min(cx, rx1));
  const ny = Math.max(ry0, Math.min(cy, ry1));
  const d = Math.hypot(cx - nx, cy - ny);
  return d < r;
}

function rectsOverlap(
  ax0: number,
  ay0: number,
  ax1: number,
  ay1: number,
  bx0: number,
  by0: number,
  bx1: number,
  by1: number
): boolean {
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}

function polygonRingBBox(ring: [number, number][]) {
  return axisAlignedRingBBox(ring);
}

export interface MarkingTextLayout {
  x: number;
  yBase: number;
  textH: number;
  estWidth: number;
}

/** Conservative AABB for one-line marking text (mm). */
export function markingTextBlockBounds(layout: MarkingTextLayout): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  const { x, yBase, textH, estWidth } = layout;
  const padX = textH * 0.18;
  const padYLo = textH * 0.3;
  const padYHi = textH * 0.14;
  return {
    x0: x - padX,
    y0: yBase - padYLo,
    x1: x + estWidth + padX,
    y1: yBase + textH + padYHi,
  };
}

function blockFreeOfCutouts(
  geo: BuiltPlateGeometry,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  holeClearMm: number
): boolean {
  for (const hi of geo.holeItems) {
    if (hi.kind === "circle") {
      if (
        circleIntersectsExpandedRect(
          hi.cx,
          hi.cy,
          hi.radius + holeClearMm,
          x0,
          y0,
          x1,
          y1
        )
      ) {
        return false;
      }
    } else {
      const bb = polygonRingBBox(hi.outline);
      if (
        rectsOverlap(
          x0,
          y0,
          x1,
          y1,
          bb.minX - holeClearMm,
          bb.minY - holeClearMm,
          bb.maxX + holeClearMm,
          bb.maxY + holeClearMm
        )
      ) {
        return false;
      }
    }
  }
  for (const ring of geo.slotOutlines) {
    const bb = polygonRingBBox(ring);
    if (
      rectsOverlap(
        x0,
        y0,
        x1,
        y1,
        bb.minX - holeClearMm,
        bb.minY - holeClearMm,
        bb.maxX + holeClearMm,
        bb.maxY + holeClearMm
      )
    ) {
      return false;
    }
  }
  return true;
}

function blockInsideOuter(
  outer: [number, number][],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  const poly = outer as Point[];
  const samples: Point[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [(x0 + x1) / 2, (y0 + y1) / 2],
    [(x0 + x1) / 2, y0],
    [(x0 + x1) / 2, y1],
    [x0, (y0 + y1) / 2],
    [x1, (y0 + y1) / 2],
  ];
  for (const p of samples) {
    if (!pointInPolygon(p, poly)) return false;
  }
  return true;
}

function collectMarkingCandidates(
  geo: BuiltPlateGeometry,
  layoutStub: Omit<MarkingTextLayout, "x" | "yBase">,
  plateBox: ReturnType<typeof axisAlignedRingBBox>,
  marginMm: number,
  holeClear: number,
  idealX: number,
  idealY: number,
  step: number
): { x: number; y: number; score: number }[] {
  const { estWidth, textH } = layoutStub;
  const padX = textH * 0.18;
  const padYLo = textH * 0.3;
  const padYHi = textH * 0.14;
  const topH = textH;

  const xMin = plateBox.minX + marginMm + padX;
  const xMax = plateBox.maxX - marginMm - estWidth - padX;
  const yMin = plateBox.minY + marginMm + padYLo;
  const yMax = plateBox.maxY - marginMm - topH - padYHi;

  const cands: { x: number; y: number; score: number }[] = [];
  if (xMin > xMax || yMin > yMax) return cands;

  for (let x = xMin; x <= xMax + 1e-9; x += step) {
    for (let yBase = yMin; yBase <= yMax + 1e-9; yBase += step) {
      const layout: MarkingTextLayout = { ...layoutStub, x, yBase };
      const b = markingTextBlockBounds(layout);
      if (!blockInsideOuter(geo.outer, b.x0, b.y0, b.x1, b.y1)) continue;
      if (!blockFreeOfCutouts(geo, b.x0, b.y0, b.x1, b.y1, holeClear))
        continue;
      const dx = x - idealX;
      const dy = yBase - idealY;
      cands.push({ x, y: yBase, score: dx * dx + dy * dy });
    }
  }
  return cands;
}

export function findMarkingPlacement(
  geo: BuiltPlateGeometry,
  markingText: string,
  textH: number,
  plateMinDim: number,
  marginMm: number
): { x: number; yBase: number } | null {
  if (!markingText) return null;

  const estWidth = Math.max(markingText.length, 1) * textH * 0.72;
  const layoutStub: Omit<MarkingTextLayout, "x" | "yBase"> = {
    textH,
    estWidth,
  };

  const holeClear = Math.max(0.6, textH * 0.45);
  const plateBox = axisAlignedRingBBox(geo.outer);
  const idealX = plateBox.minX + marginMm;
  const idealY = plateBox.minY + marginMm;

  const stepCoarse = Math.min(3, Math.max(1.5, plateMinDim / 28));
  let cands = collectMarkingCandidates(
    geo,
    layoutStub,
    plateBox,
    marginMm,
    holeClear,
    idealX,
    idealY,
    stepCoarse
  );

  if (cands.length === 0) {
    cands = collectMarkingCandidates(
      geo,
      layoutStub,
      plateBox,
      marginMm,
      holeClear,
      idealX,
      idealY,
      1
    );
  }

  if (cands.length === 0) return null;

  cands.sort((a, b) => a.score - b.score);
  const best = cands[0]!;
  return { x: best.x, yBase: best.y };
}
