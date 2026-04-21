import type { ExcelRow } from "@/types";
import type { MaterialType } from "@/types/materials";
import {
  defaultMaterialGradeForFamily,
  formatMaterialGradeAndFinish,
} from "./plateFields";
import { normalizeFinishFromImport } from "./materialSettingsOptions";
import { QUOTE_METHOD_LABEL } from "./mergeQuotePlates";
import type { QuotePartRow } from "../types/quickQuote";
import type { ManualQuotePartRow } from "../types/quickQuote";

/** Stable codes for missing/invalid manual fields — map to locale in UI. */
export type ManualRowIssueCode =
  | "thicknessMm"
  | "widthMm"
  | "lengthMm"
  | "quantity"
  | "material";

/** Per-row issues for manual entry — empty array means the row is complete enough to finish. */
export function getManualRowValidationIssues(row: ManualQuotePartRow): ManualRowIssueCode[] {
  const issues: ManualRowIssueCode[] = [];
  if (!(Number(row.thicknessMm) > 0)) issues.push("thicknessMm");
  if (!(Number(row.widthMm) > 0)) issues.push("widthMm");
  if (!(Number(row.lengthMm) > 0)) issues.push("lengthMm");
  if (!(Math.floor(row.quantity) >= 1)) issues.push("quantity");
  if (!(row.material ?? "").trim()) issues.push("material");
  return issues;
}

/** 1-based row numbers with issue codes — empty if all rows valid. */
export function getManualQuoteRowsWithValidationIssues(
  rows: ManualQuotePartRow[]
): { rowNumber: number; issues: ManualRowIssueCode[] }[] {
  const out: { rowNumber: number; issues: ManualRowIssueCode[] }[] = [];
  rows.forEach((row, index) => {
    const issues = getManualRowValidationIssues(row);
    if (issues.length > 0) out.push({ rowNumber: index + 1, issues });
  });
  return out;
}

/** Line total area (m²) = (width × length / 1e6) × quantity — matches sidebar totals. */
export function manualRowLineAreaM2(row: ManualQuotePartRow): number {
  const w = Math.max(0, row.widthMm);
  const l = Math.max(0, row.lengthMm);
  const q = Math.max(0, Math.floor(row.quantity));
  if (!Number.isFinite(w) || !Number.isFinite(l) || !Number.isFinite(q)) return 0;
  return ((w * l) / 1_000_000) * q;
}

/** Line total weight (kg) from thickness × area × density. */
export function manualRowLineWeightKg(
  row: ManualQuotePartRow,
  densityKgPerM3: number
): number {
  const w = Math.max(0, row.widthMm);
  const l = Math.max(0, row.lengthMm);
  const q = Math.max(0, Math.floor(row.quantity));
  const th = Math.max(0, Number(row.thicknessMm) || 0);
  if (!Number.isFinite(w) || !Number.isFinite(l) || !Number.isFinite(q)) return 0;
  const pieceAreaM2 = (w * l) / 1_000_000;
  const tM = th / 1000;
  return pieceAreaM2 * tM * q * densityKgPerM3;
}

/** Next part id like PL01, PL02 … based on existing PL## numbers. */
export function suggestNextPartNumber(rows: ManualQuotePartRow[]): string {
  let max = 0;
  for (const r of rows) {
    const m = /^PL(\d+)$/i.exec(r.partNumber.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return next < 100 ? `PL${String(next).padStart(2, "0")}` : `PL${next}`;
}

export function computeManualQuoteMetrics(
  rows: ManualQuotePartRow[],
  densityKgPerM3: number
): { totalQty: number; totalAreaM2: number; totalWeightKg: number } {
  let totalQty = 0;
  let totalAreaM2 = 0;
  let totalWeightKg = 0;
  const rho = densityKgPerM3;

  for (const r of rows) {
    const w = Math.max(0, r.widthMm);
    const l = Math.max(0, r.lengthMm);
    const q = Math.max(0, Math.floor(r.quantity));
    const th = Math.max(0, Number(r.thicknessMm) || 0);
    if (!Number.isFinite(w) || !Number.isFinite(l) || !Number.isFinite(q)) continue;
    totalQty += q;
    const pieceAreaM2 = (w * l) / 1_000_000;
    totalAreaM2 += pieceAreaM2 * q;
    const tM = th / 1000;
    totalWeightKg += pieceAreaM2 * tM * q * rho;
  }

  return { totalQty, totalAreaM2, totalWeightKg };
}

/** Parsed Excel rows → same shape as manual entry (quote-from-list flow). */
export function excelRowsToManualQuoteRows(
  rows: ExcelRow[],
  materialType: MaterialType
): ManualQuotePartRow[] {
  return rows.map((r) => {
    const partNumber = r.partName.trim() || "—";
    return {
      id: r.id,
      partNumber,
      thicknessMm: r.thickness ?? 0,
      widthMm: r.width ?? 0,
      lengthMm: r.length ?? 0,
      quantity: Math.max(1, Math.floor(r.quantity) || 1),
      material: (r.material ?? "").trim() || defaultMaterialGradeForFamily(materialType),
      finish: normalizeFinishFromImport(materialType, r.finish),
      corrugated: r.corrugated === true,
      sourceMethod: "excelImport",
      clientPartLabel: partNumber,
    };
  });
}

/** Rebuild quote-import editor rows from saved manual lines (re-enter Import Excel list). */
export function manualQuoteRowsToRestoredExcelRows(
  rows: ManualQuotePartRow[],
  materialType?: MaterialType
): ExcelRow[] {
  const defaultMat =
    materialType != null ? defaultMaterialGradeForFamily(materialType) : "S235";
  return rows.map((r) => ({
    id: r.id,
    fileId: "quick-quote-import",
    clientId: "quick-quote",
    batchId: "quick-quote",
    partName: r.partNumber,
    quantity: Math.max(1, Math.floor(r.quantity) || 1),
    thickness: r.thicknessMm > 0 ? r.thicknessMm : undefined,
    material: (r.material ?? "").trim() || defaultMat,
    width: r.widthMm > 0 ? r.widthMm : undefined,
    length: r.lengthMm > 0 ? r.lengthMm : undefined,
    finish: r.finish,
    corrugated: r.corrugated === true,
    rawRow: {},
  }));
}

/** Manual BOM lines → quote part rows (rectangular plate geometry). */
export function manualQuoteRowsToQuoteParts(
  rows: ManualQuotePartRow[],
  densityKgPerM3: number
): QuotePartRow[] {
  const rho = densityKgPerM3;
  return rows.map((r, index) => {
    const w = Math.max(0, r.widthMm);
    const l = Math.max(0, r.lengthMm);
    const th = Math.max(0, Number(r.thicknessMm) || 0);
    const q = Math.max(1, Math.floor(r.quantity) || 1);
    const areaM2 = (w * l) / 1_000_000;
    const tM = th / 1000;
    const weightKg = areaM2 * tM * rho;
    const cutLengthMm = w > 0 && l > 0 ? Math.round(2 * (w + l)) : 0;
    const trimmed = (r.partNumber || "").trim();
    const displayName =
      trimmed ||
      (r.sourceMethod === "manualAdd"
        ? `Manual line ${index + 1}`
        : `Line ${index + 1}`);
    return {
      id: r.id,
      partName: displayName,
      qty: q,
      material: formatMaterialGradeAndFinish(r.material, r.finish),
      thicknessMm: th,
      lengthMm: l,
      widthMm: w,
      areaM2,
      weightKg,
      cutLengthMm,
      pierceCount: 0,
      validationStatus: "valid",
      estimatedLineCost: 0,
      corrugated: r.corrugated === true,
      dxfFileName: "—",
      excelRowRef: trimmed || displayName,
      notes: r.sourceMethod
        ? `Source: ${QUOTE_METHOD_LABEL[r.sourceMethod]}`
        : "",
    };
  });
}
