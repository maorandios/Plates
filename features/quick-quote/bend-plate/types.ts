import type { PlateFinish } from "../lib/plateFields";

export type BendTemplateId = "l" | "u" | "z" | "hat" | "custom";

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

export interface HatTemplateParams {
  aMm: number;
  bMm: number;
  cMm: number;
  dMm: number;
  eMm: number;
  /** Included angle between adjacent legs at each bend (°), 0–180. */
  angle1Deg: number;
  angle2Deg: number;
  angle3Deg: number;
  angle4Deg: number;
}

/** Up to 6 straight segments; `anglesDeg` has length `segmentCount − 1`. */
export interface CustomTemplateParams {
  segmentCount: number;
  segmentsMm: number[];
  /** Signed path turn after each segment (°), CCW + — advanced; not included angle. */
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
  hat: HatTemplateParams;
  custom: CustomTemplateParams;
}

export interface BendPlateQuoteItem {
  id: string;
  inputMethod: "bend_plate";
  /** When set, L/U/Z/hat angle fields are included angles (°); omit = legacy path-turn values. */
  bendAngleSemantic?: "internal";
  template: BendTemplateId;
  global: BendPlateGlobalParams;
  /** Snapshot of the template-specific params that were active */
  l: LTemplateParams;
  u: UTemplateParams;
  z: ZTemplateParams;
  hat: HatTemplateParams;
  custom: CustomTemplateParams;
  calc: BendPlateCalculation;
}
