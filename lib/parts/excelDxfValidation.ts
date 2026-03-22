/**
 * Compare Excel row values (on Part) to metrics derived from DXF geometry.
 */

import type { Part } from "@/types";
import type { UnitSystem } from "@/types/settings";
import {
  formatArea,
  formatLength,
  formatWeight,
  getUnitSystem,
} from "@/lib/settings/unitSystem";

/** Default steel density for estimated plate mass (kg/m³) */
export const DEFAULT_STEEL_DENSITY_KG_M3 = 7850;

export type ExcelDxfDataStatus = "ok" | "mismatch" | "na";

export interface ExcelDxfValidationResult {
  status: ExcelDxfDataStatus;
  /** Human-readable differences; empty when ok or na */
  issues: string[];
  /** True when we had enough inputs to run at least one numeric check */
  compared: boolean;
}

const MM_ABS_TOL = 0.5;
const AREA_ABS_TOL_M2 = 0.0001;
const AREA_REL_TOL = 0.005;

/** Net plate mass (kg) for one piece from net area (mm²), thickness (mm), density kg/m³ */
export function estimatePlateMassKg(
  areaMm2: number,
  thicknessMm: number,
  densityKgM3 = DEFAULT_STEEL_DENSITY_KG_M3
): number {
  if (areaMm2 <= 0 || thicknessMm <= 0) return 0;
  const areaM2 = areaMm2 / 1_000_000;
  const thicknessM = thicknessMm / 1000;
  return areaM2 * thicknessM * densityKgM3;
}

export function estimateDxfTotalWeightKg(part: Pick<Part, "dxfArea" | "thickness" | "quantity">): number | undefined {
  const area = part.dxfArea;
  const thk = part.thickness;
  const qty = part.quantity ?? 1;
  if (area == null || area <= 0 || thk == null || thk <= 0 || qty <= 0) return undefined;
  return estimatePlateMassKg(area, thk) * qty;
}

/** Prefer explicit total weight; else unit × qty; else unit */
export function excelReferenceTotalKg(part: Part): number | undefined {
  if (part.totalWeight != null) return part.totalWeight;
  if (part.weight != null && part.quantity != null && part.quantity > 0) {
    return part.weight * part.quantity;
  }
  if (part.weight != null) return part.weight;
  return undefined;
}

function areaToleranceM2(excelM2: number, dxfM2: number): number {
  return Math.max(AREA_ABS_TOL_M2, AREA_REL_TOL * Math.max(excelM2, dxfM2, 1e-9));
}

/** Weight match: no kg tolerance — values must agree when rounded to 2 decimal places (0.01 kg). */
export function weightsMatchAtTwoDecimalsKg(excelKg: number, dxfKg: number): boolean {
  return Math.round(excelKg * 100) === Math.round(dxfKg * 100);
}

/**
 * Validates Excel vs DXF when both sources are present and DXF geometry has area.
 * Width/length use sorted bbox comparison so Excel W/L can swap vs DXF axes.
 */
export function validateExcelVsDxf(
  part: Part,
  opts?: { unitSystem?: UnitSystem }
): ExcelDxfValidationResult {
  const system = opts?.unitSystem ?? getUnitSystem();
  const issues: string[] = [];
  let compared = false;

  if (part.excelStatus !== "present" || part.dxfStatus !== "present") {
    return { status: "na", issues: [], compared: false };
  }

  const dxfArea = part.dxfArea;
  if (dxfArea == null || dxfArea <= 0 || part.geometryStatus === "error") {
    return {
      status: "na",
      issues: ["DXF geometry area is missing or invalid — cannot compare."],
      compared: false,
    };
  }

  const exW = part.width;
  const exL = part.length;
  const dxfW = part.dxfWidthMm;
  const dxfL = part.dxfLengthMm;

  if (
    exW != null &&
    exL != null &&
    dxfW != null &&
    dxfL != null &&
    exW > 0 &&
    exL > 0 &&
    dxfW > 0 &&
    dxfL > 0
  ) {
    compared = true;
    const exSorted: [number, number] = [Math.min(exW, exL), Math.max(exW, exL)];
    const dxfSorted: [number, number] = [Math.min(dxfW, dxfL), Math.max(dxfW, dxfL)];
    if (Math.abs(exSorted[0] - dxfSorted[0]) > MM_ABS_TOL) {
      issues.push(
        `Shorter span: Excel ${formatLength(exSorted[0], system)} vs DXF ${formatLength(dxfSorted[0], system)}`
      );
    }
    if (Math.abs(exSorted[1] - dxfSorted[1]) > MM_ABS_TOL) {
      issues.push(
        `Longer span: Excel ${formatLength(exSorted[1], system)} vs DXF ${formatLength(dxfSorted[1], system)}`
      );
    }
  }

  if (part.area != null && part.area >= 0) {
    compared = true;
    const dxfM2 = dxfArea / 1_000_000;
    const tol = areaToleranceM2(part.area, dxfM2);
    if (Math.abs(part.area - dxfM2) > tol) {
      issues.push(
        `Area: Excel ${formatArea(part.area, system)} vs DXF ${formatArea(dxfM2, system)}`
      );
    }
  }

  const excelTot = excelReferenceTotalKg(part);
  const dxfTot = estimateDxfTotalWeightKg(part);
  if (excelTot != null && dxfTot != null) {
    compared = true;
    if (!weightsMatchAtTwoDecimalsKg(excelTot, dxfTot)) {
      issues.push(
        `Total weight: Excel ${formatWeight(excelTot, system)} vs DXF est. ${formatWeight(dxfTot, system)} — must match at 2 decimals (${system === "metric" ? "metric" : "imperial"} display; steel ${DEFAULT_STEEL_DENSITY_KG_M3} kg/m³ × area × thickness × qty)`
      );
    }
  }

  if (!compared) {
    return {
      status: "na",
      issues: [
        "Not enough Excel fields (W/L, area, and/or total weight with thickness) to compare to DXF.",
      ],
      compared: false,
    };
  }

  return {
    status: issues.length > 0 ? "mismatch" : "ok",
    issues,
    compared: true,
  };
}

/**
 * Green match status in the parts table: DXF is present with usable geometry, and Excel
 * W, L, area, and reference total weight all agree with DXF bbox, net area, and
 * estimated total weight (weight: exact match at 2 decimals, no kg tolerance). Otherwise false.
 */
export function isExcelDxfFullMatch(part: Part): boolean {
  if (part.excelStatus !== "present" || part.dxfStatus !== "present") return false;

  const dxfArea = part.dxfArea;
  if (dxfArea == null || dxfArea <= 0 || part.geometryStatus === "error") return false;

  const exW = part.width;
  const exL = part.length;
  const dxfW = part.dxfWidthMm;
  const dxfL = part.dxfLengthMm;
  if (
    exW == null ||
    exL == null ||
    dxfW == null ||
    dxfL == null ||
    exW <= 0 ||
    exL <= 0 ||
    dxfW <= 0 ||
    dxfL <= 0
  ) {
    return false;
  }

  const exSorted: [number, number] = [Math.min(exW, exL), Math.max(exW, exL)];
  const dxfSorted: [number, number] = [Math.min(dxfW, dxfL), Math.max(dxfW, dxfL)];
  if (Math.abs(exSorted[0] - dxfSorted[0]) > MM_ABS_TOL) return false;
  if (Math.abs(exSorted[1] - dxfSorted[1]) > MM_ABS_TOL) return false;

  if (part.area == null || part.area < 0) return false;
  const dxfM2 = dxfArea / 1_000_000;
  if (Math.abs(part.area - dxfM2) > areaToleranceM2(part.area, dxfM2)) return false;

  const excelTot = excelReferenceTotalKg(part);
  const dxfTot = estimateDxfTotalWeightKg(part);
  if (excelTot == null || dxfTot == null) return false;
  if (!weightsMatchAtTwoDecimalsKg(excelTot, dxfTot)) return false;

  return true;
}

/** Per Excel column: true = value does not match DXF (highlight cell). */
export interface ExcelFieldMismatchFlags {
  width: boolean;
  length: boolean;
  area: boolean;
  weight: boolean;
}

/**
 * Which Excel list cells should be highlighted when they disagree with DXF.
 * W/L map to shorter/longer span vs sorted DXF bbox (same logic as validateExcelVsDxf).
 */
export function getExcelFieldMismatchFlags(part: Part): ExcelFieldMismatchFlags {
  const flags: ExcelFieldMismatchFlags = {
    width: false,
    length: false,
    area: false,
    weight: false,
  };

  if (part.excelStatus !== "present" || part.dxfStatus !== "present") {
    return flags;
  }

  const dxfArea = part.dxfArea;
  if (dxfArea == null || dxfArea <= 0 || part.geometryStatus === "error") {
    return flags;
  }

  const exW = part.width;
  const exL = part.length;
  const dxfW = part.dxfWidthMm;
  const dxfL = part.dxfLengthMm;

  if (
    exW != null &&
    exL != null &&
    dxfW != null &&
    dxfL != null &&
    exW > 0 &&
    exL > 0 &&
    dxfW > 0 &&
    dxfL > 0
  ) {
    const exSorted: [number, number] = [Math.min(exW, exL), Math.max(exW, exL)];
    const dxfSorted: [number, number] = [Math.min(dxfW, dxfL), Math.max(dxfW, dxfL)];
    const shortOk = Math.abs(exSorted[0] - dxfSorted[0]) <= MM_ABS_TOL;
    const longOk = Math.abs(exSorted[1] - dxfSorted[1]) <= MM_ABS_TOL;
    const shorterIsWidth = exW <= exL;
    if (!shortOk) {
      if (shorterIsWidth) flags.width = true;
      else flags.length = true;
    }
    if (!longOk) {
      if (shorterIsWidth) flags.length = true;
      else flags.width = true;
    }
  }

  if (part.area != null && part.area >= 0) {
    const dxfM2 = dxfArea / 1_000_000;
    const tol = areaToleranceM2(part.area, dxfM2);
    if (Math.abs(part.area - dxfM2) > tol) {
      flags.area = true;
    }
  }

  const excelTot = excelReferenceTotalKg(part);
  const dxfTot = estimateDxfTotalWeightKg(part);
  if (excelTot != null && dxfTot != null) {
    if (!weightsMatchAtTwoDecimalsKg(excelTot, dxfTot)) {
      flags.weight = true;
    }
  }

  return flags;
}

export function namePairingSummary(part: Part): string {
  if (part.matchStatus === "matched") {
    return "Excel row and DXF file are paired (part name, and DXF filename column when present).";
  }
  if (part.matchStatus === "needs_review") {
    return "Pairing is uncertain — duplicate part names, similar scores, or weak name match. Confirm Excel ↔ DXF.";
  }
  if (part.dxfStatus === "present" && part.excelStatus === "missing") {
    return "DXF has no matching Excel row for this client.";
  }
  if (part.excelStatus === "present" && part.dxfStatus === "missing") {
    return "Excel row has no matching DXF file for this client.";
  }
  return "Excel row and DXF were not paired (name match score too low).";
}
