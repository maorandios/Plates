import type { PlateFinish } from "../lib/plateFields";

export type BendTemplateId = "l" | "u" | "z" | "omega" | "gutter" | "custom";

export interface BendPlateGlobalParams {
  /** Steel grade / designation (e.g. S235). */
  material: string;
  finish: PlateFinish;
  thicknessMm: number;
  plateWidthMm: number;
  insideRadiusMm: number;
  quantity: number;
}

export interface LTemplateParams {
  aMm: number;
  bMm: number;
  /** Included angle between the two legs in the side view (°), 0–180 — not path turn. */
  angleDeg: number;
}

export interface UTemplateParams {
  aMm: number;
  bMm: number;
  cMm: number;
  /** Included angle between adjacent legs at each bend (°), 0–180. */
  angle1Deg: number;
  angle2Deg: number;
}

export interface ZTemplateParams {
  aMm: number;
  bMm: number;
  cMm: number;
  /** Included angle between adjacent legs at each bend (°), 0–180. */
  angle1Deg: number;
  angle2Deg: number;
}

/**
 * Ω-shaped profile (5 segments, 4 bends): left flange → up → across → down → right flange.
 * Path: right → up → right → down → right; defaults 90° included angles.
 */
export interface OmegaTemplateParams {
  aMm: number;
  bMm: number;
  cMm: number;
  dMm: number;
  eMm: number;
  angle1Deg: number;
  angle2Deg: number;
  angle3Deg: number;
  angle4Deg: number;
}

/**
 * Gutter (5 segments, 4 bends): left lip → left wall → floor → right wall → right lip.
 * Path: west → south → east → north → east (outward-facing top flanges); defaults 90° included angles.
 */
export interface GutterTemplateParams {
  aMm: number;
  bMm: number;
  cMm: number;
  dMm: number;
  eMm: number;
  angle1Deg: number;
  angle2Deg: number;
  angle3Deg: number;
  angle4Deg: number;
}

/** Up to 7 straight segments; `anglesDeg` has length `segmentCount − 1` (max 6). */
export interface CustomTemplateParams {
  segmentCount: number;
  segmentsMm: number[];
  /**
   * Path turn after each segment (°): positive = CCW, negative = CW; 0 = straight.
   * Quotes with `bendAngleSemantic: "internal"` store legacy included angles (0–180) until migrated on load.
   */
  anglesDeg: number[];
}

export interface BendPlateCalculation {
  developedLengthMm: number;
  blankLengthMm: number;
  blankWidthMm: number;
  areaM2: number;
  weightKg: number;
  bendCount: number;
}

/** Full editor state: one block per template (only active template is used). */
export interface BendPlateFormState {
  template: BendTemplateId;
  global: BendPlateGlobalParams;
  l: LTemplateParams;
  u: UTemplateParams;
  z: ZTemplateParams;
  omega: OmegaTemplateParams;
  gutter: GutterTemplateParams;
  custom: CustomTemplateParams;
}

export interface BendPlateQuoteItem {
  id: string;
  inputMethod: "bend_plate";
  /**
   * `internal` — L/U/Z/Ω/gutter use included angle (°) in saved fields.
   * `path_turn` — custom template `anglesDeg` are signed path turns (saved after migration).
   */
  bendAngleSemantic?: "internal" | "path_turn";
  template: BendTemplateId;
  global: BendPlateGlobalParams;
  /** Snapshot of the template-specific params that were active */
  l: LTemplateParams;
  u: UTemplateParams;
  z: ZTemplateParams;
  omega: OmegaTemplateParams;
  gutter: GutterTemplateParams;
  custom: CustomTemplateParams;
  calc: BendPlateCalculation;
}
