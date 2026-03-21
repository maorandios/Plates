/**
 * Compare Excel row values (on Part) to metrics derived from DXF geometry.
 */

import type { Part } from "@/types";

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
const WEIGHT_ABS_TOL_KG = 0.05;
const WEIGHT_REL_TOL = 0.02;

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

function weightToleranceKg(excelKg: number, dxfKg: number): number {
  return Math.max(WEIGHT_ABS_TOL_KG, WEIGHT_REL_TOL * Math.max(excelKg, dxfKg, 1e-9));
}

/**
 * Validates Excel vs DXF when both sources are present and DXF geometry has area.
 * Width/length use sorted bbox comparison so Excel W/L can swap vs DXF axes.
 */
export function validateExcelVsDxf(part: Part): ExcelDxfValidationResult {
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
        `Shorter span: Excel ${exSorted[0].toFixed(1)} mm vs DXF ${dxfSorted[0].toFixed(1)} mm`
      );
    }
    if (Math.abs(exSorted[1] - dxfSorted[1]) > MM_ABS_TOL) {
      issues.push(
        `Longer span: Excel ${exSorted[1].toFixed(1)} mm vs DXF ${dxfSorted[1].toFixed(1)} mm`
      );
    }
  }

  if (part.area != null && part.area >= 0) {
    compared = true;
    const dxfM2 = dxfArea / 1_000_000;
    const tol = areaToleranceM2(part.area, dxfM2);
    if (Math.abs(part.area - dxfM2) > tol) {
      issues.push(`Area: Excel ${part.area.toFixed(4)} m² vs DXF ${dxfM2.toFixed(4)} m²`);
    }
  }

  const excelTot = excelReferenceTotalKg(part);
  const dxfTot = estimateDxfTotalWeightKg(part);
  if (excelTot != null && dxfTot != null) {
    compared = true;
    const tol = weightToleranceKg(excelTot, dxfTot);
    if (Math.abs(excelTot - dxfTot) > tol) {
      issues.push(
        `Total weight: Excel ${excelTot.toFixed(2)} kg vs DXF est. ${dxfTot.toFixed(2)} kg (steel ${DEFAULT_STEEL_DENSITY_KG_M3} kg/m³ × area × thickness × qty)`
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
    const tol = weightToleranceKg(excelTot, dxfTot);
    if (Math.abs(excelTot - dxfTot) > tol) {
      flags.weight = true;
    }
  }

  return flags;
}

export function namePairingSummary(part: Part): string {
  if (part.matchStatus === "matched") {
    return "Excel row and DXF file are paired by part name.";
  }
  if (part.matchStatus === "needs_review") {
    return "Part names are similar but uncertain — please confirm the Excel ↔ DXF pairing.";
  }
  if (part.dxfStatus === "present" && part.excelStatus === "missing") {
    return "DXF has no matching Excel row for this client.";
  }
  if (part.excelStatus === "present" && part.dxfStatus === "missing") {
    return "Excel row has no matching DXF file for this client.";
  }
  return "Excel row and DXF were not paired (name match score too low).";
}
