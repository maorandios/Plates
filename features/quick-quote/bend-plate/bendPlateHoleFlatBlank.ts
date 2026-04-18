/**
 * Maps segment-face holes (u,v mm) to flat-blank XY (mm) for DXF / PDF export.
 * Blank coords: origin bottom-left, +X along developed length, +Y along plate width (matches DXF rectangle).
 */

import type { MaterialType } from "@/types/materials";
import type { BendPlateFormState, BendSegmentHole } from "./types";
import {
  bendAllowanceMm,
  buildForTemplate,
  kFactorForMaterial,
  outsideSetbackMm,
  type Point2,
} from "./geometry";
import { capsuleOutlineUvMm } from "./segmentFaceHolesBounds";

const ROUND_SEGMENTS = 36;

/** Flat span on the developed blank for each straight segment (same ordering as `straights`). */
export function flatBlankSegmentSpans(
  straights: number[],
  bends: number[],
  thicknessMm: number,
  materialType: MaterialType
): { x0: number; flatRun: number; straightLen: number }[] {
  const kFactor = kFactorForMaterial(materialType);
  const insideRadiusMm = thicknessMm;
  const ossbs = bends.map((a) =>
    outsideSetbackMm(a, insideRadiusMm, thicknessMm)
  );
  const nSeg = straights.length;
  const out: { x0: number; flatRun: number; straightLen: number }[] = [];
  let curX = 0;
  for (let i = 0; i < nSeg; i++) {
    const straightLen = Math.max(0, straights[i] ?? 0);
    let flatRun = straightLen;
    if (i > 0) flatRun -= ossbs[i - 1] ?? 0;
    if (i < bends.length) flatRun -= ossbs[i] ?? 0;
    flatRun = Math.max(0, flatRun);
    out.push({ x0: curX, flatRun, straightLen });
    if (i < bends.length) {
      const ba = bendAllowanceMm(
        bends[i]!,
        insideRadiusMm,
        thicknessMm,
        kFactor
      );
      curX += flatRun + ba;
    } else {
      curX += flatRun;
    }
  }
  return out;
}

/** Closed polygon of hole in segment UV (mm), CCW. */
export function holeOutlinePolygonUvMm(h: BendSegmentHole): [number, number][] {
  if (h.kind === "round") {
    const r = Math.max(0, h.diameterMm) / 2;
    const pts: [number, number][] = [];
    for (let i = 0; i <= ROUND_SEGMENTS; i++) {
      const t = (i / ROUND_SEGMENTS) * Math.PI * 2;
      pts.push([h.uMm + r * Math.cos(t), h.vMm + r * Math.sin(t)]);
    }
    return pts;
  }
  if (h.kind === "oval") {
    return capsuleOutlineUvMm(h.uMm, h.vMm, h);
  }
  const rw = Math.max(0, h.rectWidthMm ?? 0);
  const rl = Math.max(0, h.rectLengthMm ?? 0);
  const θ = ((h.rotationDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(θ);
  const sin = Math.sin(θ);
  const corners: [number, number][] = [
    [-rw / 2, -rl / 2],
    [rw / 2, -rl / 2],
    [rw / 2, rl / 2],
    [-rw / 2, rl / 2],
  ];
  return corners.map(([lx, ly]) => {
    const du = lx * cos - ly * sin;
    const dv = lx * sin + ly * cos;
    return [h.uMm + du, h.vMm + dv] as [number, number];
  });
}

/** Maps a hole center from segment-face UV to flat blank XY (plate template, perimeter segments). */
export function plateSegmentHoleCenterOnRectangleBlank(
  segIdx: number,
  u: number,
  v: number,
  L: number,
  W: number
): Point2 {
  switch (segIdx) {
    case 0:
      return { x: v, y: u };
    case 1:
      return { x: L - u, y: v };
    case 2:
      return { x: L - v, y: W - u };
    case 3:
      return { x: u, y: W - v };
    default:
      return { x: u, y: v };
  }
}

function mapUvPolygonToBlankBent(
  poly: [number, number][],
  x0: number,
  flatRun: number,
  straightLen: number
): Point2[] {
  const scaleAlong = straightLen > 1e-9 ? flatRun / straightLen : 1;
  return poly.map(([u, v]) => ({
    x: x0 + v * scaleAlong,
    y: u,
  }));
}

/**
 * All hole loops in flat blank mm (bottom-left origin, Y up). Each loop is closed (last point may repeat first).
 */
export function bendPlateHolePolygonsOnFlatBlankMm(
  state: BendPlateFormState,
  materialType: MaterialType
): Point2[][] {
  const rows = state.segmentFaceHoles ?? [];
  const polys: Point2[][] = [];

  if (state.template === "plate") {
    const L = Math.max(0, state.plate.lengthMm);
    const W = Math.max(0, state.plate.widthMm);
    for (let segIdx = 0; segIdx < rows.length; segIdx++) {
      for (const h of rows[segIdx] ?? []) {
        const uv = holeOutlinePolygonUvMm(h);
        const blank = uv.map(([u, v]) =>
          plateSegmentHoleCenterOnRectangleBlank(segIdx, u, v, L, W)
        );
        if (blank.length >= 3) polys.push(blank);
      }
    }
    return polys;
  }

  const { straights, bends } = buildForTemplate(state.template, state);
  const thicknessMm = state.global.thicknessMm;
  const spans = flatBlankSegmentSpans(straights, bends, thicknessMm, materialType);

  for (let segIdx = 0; segIdx < rows.length; segIdx++) {
    const holes = rows[segIdx] ?? [];
    const span = spans[segIdx];
    const straightLen = straights[segIdx] ?? 0;
    if (!span || straightLen < 1e-9) continue;

    for (const h of holes) {
      const uv = holeOutlinePolygonUvMm(h);
      const blank = mapUvPolygonToBlankBent(
        uv,
        span.x0,
        span.flatRun,
        straightLen
      );
      if (blank.length >= 3) polys.push(blank);
    }
  }
  return polys;
}
