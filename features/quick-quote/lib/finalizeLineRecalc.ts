/**
 * Recompute line area, weight, and material sell price for Finalize part rows
 * when quantity or plate dimensions change (same logic as Pricing: kg × price/kg).
 */

import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/types/materials";
import {
  materialPricingRowKey,
  parseMaterialPricePerKg,
} from "../job-overview/materialCalculations";
import type { BendTemplateId } from "../bend-plate/types";
import { formatMaterialGradeAndFinish, splitMaterialGradeAndFinish } from "./plateFields";
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
  /** Stable id from merged {@link QuotePartRow} — DXF preview lookup. */
  source_row_id?: string;
  /** Free-text description (maps to part notes). */
  description?: string;
  /** Bend / shaped plate rows only — פח מרוג. */
  corrugated?: boolean;
};

const BEND_SHAPE_IDS = new Set<string>(["l", "u", "z", "omega", "gutter", "plate", "custom"]);

/** True when `plate_shape` in finalize/PDF is a bent profile (not `flat`). */
export function isFinalizeBendPlateRowShape(plateShape: string): boolean {
  const s = (plateShape || "flat").toLowerCase();
  return BEND_SHAPE_IDS.has(s);
}

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

/**
 * Build a {@link QuotePartRow} for the shared plate preview modal from a finalize line
 * (merged with the original BOM row when available so DXF geometry resolves).
 */
export function finalizeDraftLineToQuotePart(
  row: FinalizeDraftLineItem,
  materialType: MaterialType,
  base: QuotePartRow | undefined
): QuotePartRow {
  const q = Math.max(0, Math.floor(row.qty));
  const w = Math.max(0, row.width_mm);
  const len = Math.max(0, row.length_mm);
  const t = Math.max(0, row.thickness_mm);
  const rho = getMaterialConfig(materialType).densityKgPerM3;
  const unitAreaM2 = (w * len) / 1_000_000;
  const unitWeightKg = unitAreaM2 * (t / 1000) * rho;
  const finishLabel = normalizeFinishFromImport(
    materialType,
    row.finish.trim() || undefined
  );
  const material = formatMaterialGradeAndFinish(row.material_grade, finishLabel);
  const shape = (row.plate_shape || "flat").toLowerCase();
  const bendTemplateId = BEND_SHAPE_IDS.has(shape)
    ? (shape as BendTemplateId)
    : undefined;

  return {
    id: base?.id ?? row.source_row_id ?? "__finalize__",
    lineSourceIds: base?.lineSourceIds,
    sourceRef: base?.sourceRef,
    partName: row.part_number,
    qty: q,
    material,
    thicknessMm: t,
    lengthMm: len,
    widthMm: w,
    areaM2: unitAreaM2,
    weightKg: unitWeightKg,
    cutLengthMm: base?.cutLengthMm ?? 0,
    pierceCount: base?.pierceCount ?? 0,
    validationStatus: "valid",
    estimatedLineCost: 0,
    bendTemplateId,
    corrugated: row.corrugated ?? base?.corrugated,
    dxfFileName: base?.dxfFileName ?? "—",
    excelRowRef: base?.excelRowRef ?? "—",
    notes: row.description ?? "",
  };
}

/**
 * BOM rows for read-only previews (quote/project) when only merged {@link QuotePartRow}s exist.
 * Line sell uses the same kg × $/kg rule as {@link buildQuotePdfRequestBody}.
 */
export function finalizeDraftItemsFromQuoteParts(
  parts: QuotePartRow[],
  materialType: MaterialType,
  materialPricePerKgByRow: Record<string, string>
): FinalizeDraftLineItem[] {
  const materialFamilyLabel = MATERIAL_TYPE_LABELS[materialType];
  return parts.map((p) => {
    const { grade, finish } = splitMaterialGradeAndFinish(p.material);
    const q = Math.max(0, Math.floor(p.qty));
    const lineWeightKg = Math.max(0, p.weightKg) * q;
    const key = materialPricingRowKey(p, materialType);
    const pricePerKg = parseMaterialPricePerKg(materialPricePerKgByRow[key] ?? "");
    const lineSell = Math.max(0, lineWeightKg * pricePerKg);
    return {
      part_number: p.partName,
      qty: p.qty,
      thickness_mm: p.thicknessMm,
      material_type: materialFamilyLabel,
      material_grade: grade === "—" ? "" : grade,
      finish: finish === "—" ? "" : finish,
      width_mm: p.widthMm,
      length_mm: p.lengthMm,
      area_m2: roundN(p.areaM2 * q, 6),
      weight_kg: roundN(lineWeightKg, 6),
      line_total: roundN(lineSell, 6),
      plate_shape: p.bendTemplateId ?? "flat",
      description: (p.notes ?? "").trim(),
      source_row_id: p.id,
      corrugated: p.bendTemplateId != null ? p.corrugated : undefined,
    };
  });
}
