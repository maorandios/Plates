/**
 * Side-profile centerline, developed length, bend allowances (neutral axis k=0.33).
 */

import type { MaterialType } from "@/types/materials";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import type {
  BendPlateCalculation,
  BendPlateFormState,
  BendTemplateId,
  CustomTemplateParams,
  GutterTemplateParams,
  LTemplateParams,
  OmegaTemplateParams,
  UTemplateParams,
  ZTemplateParams,
} from "./types";

const K_FACTOR = 0.33;

export type Point2 = { x: number; y: number };

/**
 * Included angle between two legs (°) → signed path turn for polyline.
 * `bendSign` +1 = CCW turn, −1 = CW (same convention as previous templates).
 */
export function internalAngleToTurnDeg(internalDeg: number, bendSign: 1 | -1): number {
  const α = Math.max(0, Math.min(180, internalDeg));
  if (α >= 179.999) return 0;
  return bendSign * (180 - α);
}

/** Included angle at each interior vertex (side view), from geometry. */
export function internalAnglesFromPolyline(pts: Point2[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const pIn = pts[i - 1];
    const p = pts[i];
    const pOut = pts[i + 1];
    const vin = { x: p.x - pIn.x, y: p.y - pIn.y };
    const vout = { x: pOut.x - p.x, y: pOut.y - p.y };
    const li = Math.hypot(vin.x, vin.y);
    const lo = Math.hypot(vout.x, vout.y);
    if (li < 1e-9 || lo < 1e-9) continue;
    const u1 = { x: -vin.x / li, y: -vin.y / li };
    const u2 = { x: vout.x / lo, y: vout.y / lo };
    const dot = Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y));
    out.push((Math.acos(dot) * 180) / Math.PI);
  }
  return out;
}

export function bendAllowanceMm(
  bendAngleDeg: number,
  insideRadiusMm: number,
  thicknessMm: number
): number {
  const theta = (Math.abs(bendAngleDeg) * Math.PI) / 180;
  const rn = insideRadiusMm + K_FACTOR * thicknessMm;
  return theta * rn;
}

export function polylineFromSegments(
  segmentLengthsMm: number[],
  turnDegAfterSegment: number[],
  initialDirectionDeg: number
): Point2[] {
  const pts: Point2[] = [{ x: 0, y: 0 }];
  let dir = (initialDirectionDeg * Math.PI) / 180;
  let x = 0;
  let y = 0;
  for (let i = 0; i < segmentLengthsMm.length; i++) {
    const L = Math.max(0, segmentLengthsMm[i]);
    x += Math.cos(dir) * L;
    y += Math.sin(dir) * L;
    pts.push({ x, y });
    if (i < turnDegAfterSegment.length) {
      dir += (turnDegAfterSegment[i] * Math.PI) / 180;
    }
  }
  return pts;
}

function computeDeveloped(
  straights: number[],
  bends: number[],
  insideRadiusMm: number,
  thicknessMm: number
): { developedMm: number; bendCount: number } {
  let developed = straights.reduce((a, b) => a + b, 0);
  for (const ang of bends) {
    developed += bendAllowanceMm(ang, insideRadiusMm, thicknessMm);
  }
  return { developedMm: developed, bendCount: bends.length };
}

export function buildL(p: LTemplateParams): {
  pts: Point2[];
  straights: number[];
  bends: number[];
} {
  const A = Math.max(0, p.aMm);
  const B = Math.max(0, p.bMm);
  const turn = internalAngleToTurnDeg(p.angleDeg, 1);
  return {
    pts: polylineFromSegments([A, B], [turn], 0),
    straights: [A, B],
    bends: [Math.abs(turn)],
  };
}

export function buildU(p: UTemplateParams): {
  pts: Point2[];
  straights: number[];
  bends: number[];
} {
  const A = Math.max(0, p.aMm);
  const B = Math.max(0, p.bMm);
  const C = Math.max(0, p.cMm);
  const turns = [
    internalAngleToTurnDeg(p.angle1Deg, -1),
    internalAngleToTurnDeg(p.angle2Deg, -1),
  ];
  return {
    pts: polylineFromSegments([A, B, C], turns, 90),
    straights: [A, B, C],
    bends: turns.map((t) => Math.abs(t)),
  };
}

export function buildZ(p: ZTemplateParams): {
  pts: Point2[];
  straights: number[];
  bends: number[];
} {
  const A = Math.max(0, p.aMm);
  const B = Math.max(0, p.bMm);
  const C = Math.max(0, p.cMm);
  const turns = [
    internalAngleToTurnDeg(p.angle1Deg, 1),
    internalAngleToTurnDeg(p.angle2Deg, -1),
  ];
  return {
    pts: polylineFromSegments([A, B, C], turns, 0),
    straights: [A, B, C],
    bends: turns.map((t) => Math.abs(t)),
  };
}

/** Omega: left base → up → top → down → right base (5 straights, 4 bends). */
export function buildOmega(p: OmegaTemplateParams): {
  pts: Point2[];
  straights: number[];
  bends: number[];
} {
  const A = Math.max(0, p.aMm);
  const B = Math.max(0, p.bMm);
  const C = Math.max(0, p.cMm);
  const D = Math.max(0, p.dMm);
  const E = Math.max(0, p.eMm);
  /** HAT / Ω: east → north → east → south → east (bend signs match U/Z convention). */
  const turns = [
    internalAngleToTurnDeg(p.angle1Deg, 1),
    internalAngleToTurnDeg(p.angle2Deg, -1),
    internalAngleToTurnDeg(p.angle3Deg, -1),
    internalAngleToTurnDeg(p.angle4Deg, 1),
  ];
  return {
    pts: polylineFromSegments([A, B, C, D, E], turns, 0),
    straights: [A, B, C, D, E],
    bends: turns.map((t) => Math.abs(t)),
  };
}

/**
 * Gutter / tray: left lip outward → down → floor → up → right lip outward (5 straights, 4 bends).
 * Start at inner corner of left lip; segment A points west (symmetric outward flanges).
 */
export function buildGutter(p: GutterTemplateParams): {
  pts: Point2[];
  straights: number[];
  bends: number[];
} {
  const A = Math.max(0, p.aMm);
  const B = Math.max(0, p.bMm);
  const C = Math.max(0, p.cMm);
  const D = Math.max(0, p.dMm);
  const E = Math.max(0, p.eMm);
  const turns = [
    internalAngleToTurnDeg(p.angle1Deg, 1),
    internalAngleToTurnDeg(p.angle2Deg, 1),
    internalAngleToTurnDeg(p.angle3Deg, 1),
    internalAngleToTurnDeg(p.angle4Deg, -1),
  ];
  return {
    pts: polylineFromSegments([A, B, C, D, E], turns, 180),
    straights: [A, B, C, D, E],
    bends: turns.map((t) => Math.abs(t)),
  };
}

export function buildCustom(p: CustomTemplateParams): {
  pts: Point2[];
  straights: number[];
  bends: number[];
} {
  const n = Math.min(7, Math.max(2, Math.floor(p.segmentCount) || 2));
  const segs = p.segmentsMm
    .slice(0, n)
    .map((s) => Math.max(0, s));
  if (segs.length === 0) {
    return { pts: [{ x: 0, y: 0 }], straights: [], bends: [] };
  }
  const need = Math.max(0, segs.length - 1);
  const turns: number[] = [];
  for (let i = 0; i < need; i++) {
    let turn = p.anglesDeg[i] ?? 0;
    if (!Number.isFinite(turn)) turn = 0;
    turn = Math.max(-360, Math.min(360, turn));
    if (Math.abs(turn) < 1e-6) turn = 0;
    turns.push(turn);
  }
  return {
    pts: polylineFromSegments(segs, turns, 0),
    straights: segs,
    bends: turns.map((t) => Math.abs(t)),
  };
}

/** Human-readable name for each straight segment (matches template fields A,B,… or 1,2 for custom). */
function segmentLabelsForTemplate(state: BendPlateFormState): string[] {
  const t = state.template;
  if (t === "l") return ["A", "B"];
  if (t === "u" || t === "z") return ["A", "B", "C"];
  if (t === "omega") return ["A", "B", "C", "D", "E"];
  if (t === "gutter") return ["A", "B", "C", "D", "E"];
  if (t === "custom") {
    const n = Math.min(7, Math.max(2, Math.floor(state.custom.segmentCount) || 2));
    return Array.from({ length: n }, (_, i) => `${i + 1}`);
  }
  return [];
}

/** Straight-run labels and lengths (mm) for 2D dimension overlay — same order as polyline edges. */
export function bendProfileDimensionSegments(
  state: BendPlateFormState
): { label: string; lengthMm: number }[] {
  const { straights } = buildForTemplate(state.template, state);
  const labels = segmentLabelsForTemplate(state);
  return straights.map((lengthMm, i) => ({
    label: labels[i] ?? `${i + 1}`,
    lengthMm,
  }));
}

/** Included angles (°) at each bend for 2D markup — matches what the user sees between legs. */
export function bendProfileBendAngles(state: BendPlateFormState): number[] {
  const t = state.template;
  if (t === "l") return [state.l.angleDeg];
  if (t === "u") return [state.u.angle1Deg, state.u.angle2Deg];
  if (t === "z") return [state.z.angle1Deg, state.z.angle2Deg];
  if (t === "omega") {
    return [
      state.omega.angle1Deg,
      state.omega.angle2Deg,
      state.omega.angle3Deg,
      state.omega.angle4Deg,
    ];
  }
  if (t === "gutter") {
    return [
      state.gutter.angle1Deg,
      state.gutter.angle2Deg,
      state.gutter.angle3Deg,
      state.gutter.angle4Deg,
    ];
  }
  if (t === "custom") {
    const built = buildCustom(state.custom);
    return internalAnglesFromPolyline(built.pts);
  }
  return [];
}

function buildForTemplate(
  template: BendTemplateId,
  s: BendPlateFormState
): { pts: Point2[]; straights: number[]; bends: number[] } {
  switch (template) {
    case "l":
      return buildL(s.l);
    case "u":
      return buildU(s.u);
    case "z":
      return buildZ(s.z);
    case "omega":
      return buildOmega(s.omega);
    case "gutter":
      return buildGutter(s.gutter);
    case "custom":
      return buildCustom(s.custom);
    default: {
      const _exhaustive: never = template;
      return _exhaustive;
    }
  }
}

/**
 * Index of the straight run `pts[i] → pts[i+1]` that stays horizontal in previews when angles change
 * (parallel to +X after normalization). Matches product UX: fixed “base” leg per template.
 */
export function horizontalAnchorSegmentIndex(
  template: BendTemplateId
): number | null {
  switch (template) {
    case "l":
      return 0;
    case "z":
      return 2;
    case "u":
      return 1;
    case "omega":
      return 2;
    case "gutter":
      return 2;
    case "custom":
      return null;
    default: {
      const _exhaustive: never = template;
      return _exhaustive;
    }
  }
}

/** Rotate all points about `pts[anchorSegIndex]` so the anchor edge lies on the +X axis. */
export function normalizePolylineToHorizontalAnchor(
  pts: Point2[],
  anchorSegIndex: number | null
): Point2[] {
  if (
    anchorSegIndex === null ||
    pts.length < 2 ||
    anchorSegIndex < 0 ||
    anchorSegIndex > pts.length - 2
  ) {
    return pts;
  }
  const p0 = pts[anchorSegIndex];
  const p1 = pts[anchorSegIndex + 1];
  const vx = p1.x - p0.x;
  const vy = p1.y - p0.y;
  const len = Math.hypot(vx, vy);
  if (len < 1e-9) {
    return pts;
  }
  const phi = -Math.atan2(vy, vx);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return pts.map((p) => {
    const rx = p.x - p0.x;
    const ry = p.y - p0.y;
    return {
      x: p0.x + c * rx - s * ry,
      y: p0.y + s * rx + c * ry,
    };
  });
}

export function computeBendGeometry(
  state: BendPlateFormState,
  materialType: MaterialType
): { pts: Point2[]; calc: BendPlateCalculation } {
  const { pts: ptsRaw, straights, bends } = buildForTemplate(state.template, state);
  const anchorIdx = horizontalAnchorSegmentIndex(state.template);
  const pts = normalizePolylineToHorizontalAnchor(ptsRaw, anchorIdx);
  const { insideRadiusMm, thicknessMm, plateWidthMm, quantity } = state.global;
  const { developedMm, bendCount } = computeDeveloped(
    straights,
    bends,
    insideRadiusMm,
    thicknessMm
  );
  const density = getMaterialConfig(materialType).densityKgPerM3;
  const areaM2 = (developedMm * plateWidthMm) / 1_000_000;
  const q = Math.max(0, Math.floor(quantity));
  const weightKg =
    q > 0 ? areaM2 * (thicknessMm / 1000) * density * q : 0;

  return {
    pts,
    calc: {
      developedLengthMm: developedMm,
      blankLengthMm: developedMm,
      blankWidthMm: plateWidthMm,
      areaM2,
      weightKg,
      bendCount,
    },
  };
}

export function boundsOfPolyline(pts: Point2[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  if (pts.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  let minX = pts[0].x;
  let maxX = pts[0].x;
  let minY = pts[0].y;
  let maxY = pts[0].y;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const pad = span * 0.1;
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
}
