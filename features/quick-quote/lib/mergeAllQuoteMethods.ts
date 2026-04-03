import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import type { BendPlateQuoteItem } from "../bend-plate/types";
import type {
  ManualQuotePartRow,
  QuotePartRow,
  ValidationRowStatus,
} from "../types/quickQuote";
import { bendPlateQuoteItemsToQuoteParts } from "../bend-plate/toQuoteParts";
import { manualQuoteRowsToQuoteParts } from "./manualQuoteParts";
import {
  DXF_QUOTE_DEFAULT_THICKNESS_MM,
  dxfGeometriesToQuoteParts,
} from "./dxfQuoteParts";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { nanoid } from "@/lib/utils/nanoid";

/** Ref column labels for the unified BOM (merged quote lines). */
export const UNIFIED_SOURCE_REF = {
  dxf: "DXF",
  excelImport: "EXCEL",
  bendPlate: "SHAPE",
  manualAdd: "MANUAL",
} as const;

function isBlankPartNumber(s: string): boolean {
  const t = (s || "").trim();
  return !t || t === "—" || t === "-";
}

/** Normalize for cross-method duplicate detection (trim, lower, collapse spaces). */
export function normalizeUnifiedPartNumberKey(partName: string): string {
  return (partName || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function assignManualDefaults(rows: ManualQuotePartRow[]): ManualQuotePartRow[] {
  let seq = 0;
  return rows.map((r) => {
    const t = (r.partNumber || "").trim();
    if (isBlankPartNumber(t)) {
      return { ...r, partNumber: `MA-PL${String(++seq).padStart(2, "0")}` };
    }
    return r;
  });
}

function assignExcelDefaults(rows: ManualQuotePartRow[]): ManualQuotePartRow[] {
  let seq = 0;
  return rows.map((r) => {
    const t = (r.partNumber || "").trim();
    if (isBlankPartNumber(t)) {
      return { ...r, partNumber: `EX-P${String(++seq).padStart(2, "0")}` };
    }
    return r;
  });
}

function worstValidationStatus(statuses: ValidationRowStatus[]): ValidationRowStatus {
  if (statuses.some((s) => s === "error")) return "error";
  if (statuses.some((s) => s === "warning")) return "warning";
  return "valid";
}

function mergeQuotePartGroup(rows: QuotePartRow[]): QuotePartRow {
  const totalQty = rows.reduce((s, p) => s + p.qty, 0);
  const totalLineWeight = rows.reduce((s, p) => s + p.weightKg * p.qty, 0);
  const totalLineArea = rows.reduce((s, p) => s + p.areaM2 * p.qty, 0);
  const weightKg = totalQty > 0 ? totalLineWeight / totalQty : 0;
  const areaM2 = totalQty > 0 ? totalLineArea / totalQty : 0;
  const lengthMm =
    totalQty > 0
      ? rows.reduce((s, p) => s + p.lengthMm * p.qty, 0) / totalQty
      : rows[0].lengthMm;
  const widthMm =
    totalQty > 0
      ? rows.reduce((s, p) => s + p.widthMm * p.qty, 0) / totalQty
      : rows[0].widthMm;
  const thicknessMm =
    totalQty > 0
      ? rows.reduce((s, p) => s + p.thicknessMm * p.qty, 0) / totalQty
      : rows[0].thicknessMm;
  const cutLengthMm =
    totalQty > 0
      ? Math.round(rows.reduce((s, p) => s + p.cutLengthMm * p.qty, 0) / totalQty)
      : rows[0].cutLengthMm;
  const pierceCount =
    totalQty > 0
      ? Math.round(rows.reduce((s, p) => s + p.pierceCount * p.qty, 0) / totalQty)
      : rows[0].pierceCount;
  const refs = [
    ...new Set(rows.map((r) => r.sourceRef).filter((x): x is string => Boolean(x))),
  ].sort((a, b) => a.localeCompare(b));
  const sourceRef = refs.join(" · ");
  const estimatedLineCost = rows.reduce((s, p) => s + p.estimatedLineCost, 0);
  const first = rows[0];
  return {
    id: nanoid(),
    sourceRef,
    partName: first.partName,
    qty: totalQty,
    material: first.material,
    thicknessMm,
    lengthMm,
    widthMm,
    areaM2,
    weightKg,
    cutLengthMm,
    pierceCount,
    validationStatus: worstValidationStatus(rows.map((r) => r.validationStatus)),
    estimatedLineCost,
    dxfFileName: rows.map((r) => r.dxfFileName).filter((x) => x && x !== "—").join(" · ") || "—",
    excelRowRef: rows.map((r) => r.excelRowRef).filter(Boolean).join(" · ") || "—",
    notes: [...new Set(rows.map((r) => r.notes).filter(Boolean))].join(" · "),
  };
}

/**
 * Merge duplicate part numbers only within the same source (Ref).
 * Standalone Excel import (EXCEL) and DXF geometry lines (DXF) must never collapse together
 * even when part names match — they are separate BOMs.
 */
function mergeByNormalizedPartName(parts: QuotePartRow[]): QuotePartRow[] {
  const buckets = new Map<string, QuotePartRow[]>();
  for (const p of parts) {
    const ref = (p.sourceRef ?? "").trim() || "__none__";
    const key = `${ref}\0${normalizeUnifiedPartNumberKey(p.partName)}`;
    const arr = buckets.get(key) ?? [];
    arr.push(p);
    buckets.set(key, arr);
  }
  const out: QuotePartRow[] = [];
  for (const [, group] of buckets) {
    if (group.length === 1) {
      out.push(group[0]);
    } else {
      out.push(mergeQuotePartGroup(group));
    }
  }
  return out;
}

/**
 * Concatenates quote line items from every method that has data, assigns Ref labels,
 * default part names (MA-PL / EX-P / SH-PL), then merges rows that share the same Ref
 * and normalized part number (never merges across Refs, e.g. EXCEL vs DXF).
 */
export function mergeAllQuoteMethodParts(
  materialType: MaterialType,
  manualQuoteRows: ManualQuotePartRow[],
  excelImportQuoteRows: ManualQuotePartRow[],
  dxfMethodGeometries: DxfPartGeometry[],
  bendPlateQuoteItems: BendPlateQuoteItem[]
): QuotePartRow[] {
  const density = getMaterialConfig(materialType).densityKgPerM3;
  const out: QuotePartRow[] = [];

  if (manualQuoteRows.length > 0) {
    const rows = assignManualDefaults(manualQuoteRows);
    out.push(
      ...manualQuoteRowsToQuoteParts(rows, density).map((p) => ({
        ...p,
        sourceRef: UNIFIED_SOURCE_REF.manualAdd,
      }))
    );
  }
  if (excelImportQuoteRows.length > 0) {
    const rows = assignExcelDefaults(excelImportQuoteRows);
    out.push(
      ...manualQuoteRowsToQuoteParts(rows, density).map((p) => ({
        ...p,
        sourceRef: UNIFIED_SOURCE_REF.excelImport,
      }))
    );
  }
  if (dxfMethodGeometries.length > 0) {
    out.push(
      ...dxfGeometriesToQuoteParts(
        dxfMethodGeometries,
        materialType,
        DXF_QUOTE_DEFAULT_THICKNESS_MM,
        density
      ).map((p) => ({
        ...p,
        sourceRef: UNIFIED_SOURCE_REF.dxf,
      }))
    );
  }
  if (bendPlateQuoteItems.length > 0) {
    const bent = bendPlateQuoteItemsToQuoteParts(bendPlateQuoteItems);
    bent.forEach((p, i) => {
      out.push({
        ...p,
        partName: `SH-PL${String(i + 1).padStart(2, "0")}`,
        sourceRef: UNIFIED_SOURCE_REF.bendPlate,
      });
    });
  }

  return mergeByNormalizedPartName(out);
}
