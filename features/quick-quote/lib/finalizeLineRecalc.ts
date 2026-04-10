/**
 * Recompute line area, weight, and material sell price for Finalize part rows
 * when quantity or plate dimensions change (same logic as Pricing: kg × price/kg).
 */

import { getMaterialConfig } from "@/lib/settings/materialConfig";
import type { MaterialType } from "@/types/materials";
import {
  materialPricingRowKey,
  parseMaterialPricePerKg,
} from "../job-overview/materialCalculations";
import { formatMaterialGradeAndFinish } from "./plateFields";
import { normalizeFinishFromImport } from "./materialSettingsOptions";
import type { QuotePartRow } from "../types/quickQuote";

export type FinalizeDraftLineItem = {
  part_number: string;
  qty: number;
  thickness_mm: number;
  material_type: string;
  material_grade: string;
  finish: string;
  width_mm: number;
  length_mm: number;
  area_m2: number;
  weight_kg: number;
  line_total: number;
  plate_shape: string;
};

function roundN(n: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

/**
 * Recompute line totals from rectangle geometry (mm) and material family density.
 * `area_m2` / `weight_kg` are **line** totals (include quantity).
 */
export function recalcFinalizeLineMetrics(
  row: FinalizeDraftLineItem,
  materialType: MaterialType,
  pricePerKgByRow: Record<string, string>
): Pick<FinalizeDraftLineItem, "area_m2" | "weight_kg" | "line_total"> {
  const q = Math.max(0, Math.floor(row.qty));
  const w = Math.max(0, row.width_mm);
  const len = Math.max(0, row.length_mm);
  const t = Math.max(0, row.thickness_mm);
  const rho = getMaterialConfig(materialType).densityKgPerM3;

  const unitAreaM2 = (w * len) / 1_000_000;
  const lineAreaM2 = unitAreaM2 * q;
  const unitWeightKg = unitAreaM2 * (t / 1000) * rho;
  const lineWeightKg = unitWeightKg * q;

  const finishLabel = normalizeFinishFromImport(
    materialType,
    row.finish.trim() || undefined
  );
  const material = formatMaterialGradeAndFinish(row.material_grade, finishLabel);
  const forKey: QuotePartRow = {
    id: "__finalize__",
    partName: row.part_number,
    qty: q,
    material,
    thicknessMm: t,
    lengthMm: len,
    widthMm: w,
    areaM2: unitAreaM2,
    weightKg: unitWeightKg,
    cutLengthMm: 0,
    pierceCount: 0,
    validationStatus: "valid",
    estimatedLineCost: 0,
    dxfFileName: "—",
    excelRowRef: "—",
    notes: "",
  };

  const key = materialPricingRowKey(forKey, materialType);
  const pricePerKg = parseMaterialPricePerKg(pricePerKgByRow[key] ?? "");
  const lineTotal = Math.max(0, lineWeightKg * pricePerKg);

  return {
    area_m2: roundN(lineAreaM2, 6),
    weight_kg: roundN(lineWeightKg, 6),
    line_total: roundN(lineTotal, 6),
  };
}
