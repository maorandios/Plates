import type { ValidationRow } from "../types/quickQuote";

/** Same tolerances as {@link buildValidationData}. */
const DIMENSION_TOLERANCE = 0.05;
const WEIGHT_TOLERANCE = 0.1;

export type CompareMetricResult = {
  matches: boolean;
  /** Whole percent, 0–100+; meaningful when totals exist. */
  deviationPercent: number;
  excelTotal: number;
  dxfTotal: number;
};

function rowQty(r: ValidationRow): number {
  return Math.max(1, Math.floor(Number(r.qty)) || 1);
}

function finalizeMetric(
  excelTotal: number,
  dxfTotal: number,
  rowMismatch: boolean,
  tol: number
): CompareMetricResult {
  if (excelTotal === 0 && dxfTotal === 0) {
    return {
      matches: !rowMismatch,
      deviationPercent: 0,
      excelTotal: 0,
      dxfTotal: 0,
    };
  }
  const denom = Math.max(Math.abs(excelTotal), Math.abs(dxfTotal), 1e-12);
  const rel = Math.abs(excelTotal - dxfTotal) / denom;
  const aggregateOk = rel <= tol;
  return {
    matches: !rowMismatch && aggregateOk,
    deviationPercent: Math.round(rel * 100),
    excelTotal,
    dxfTotal,
  };
}

/** Σ(Excel length × qty) vs Σ(DXF length × qty), mm·qty. */
export function computeLengthMetric(rows: ValidationRow[]): CompareMetricResult {
  let eSum = 0;
  let dSum = 0;
  for (const r of rows) {
    const q = rowQty(r);
    eSum += r.excelLengthMm * q;
    dSum += r.dxfLengthMm * q;
  }
  const rowMismatch = rows.some((r) => r.mismatchFields.includes("Length"));
  return finalizeMetric(eSum, dSum, rowMismatch, DIMENSION_TOLERANCE);
}

/** Σ(Excel width × qty) vs Σ(DXF width × qty). */
export function computeWidthMetric(rows: ValidationRow[]): CompareMetricResult {
  let eSum = 0;
  let dSum = 0;
  for (const r of rows) {
    const q = rowQty(r);
    eSum += r.excelWidthMm * q;
    dSum += r.dxfWidthMm * q;
  }
  const rowMismatch = rows.some((r) => r.mismatchFields.includes("Width"));
  return finalizeMetric(eSum, dSum, rowMismatch, DIMENSION_TOLERANCE);
}

/** Σ(Excel area × qty) vs Σ(DXF area × qty), m²·qty. */
export function computeAreaMetric(rows: ValidationRow[]): CompareMetricResult {
  let eSum = 0;
  let dSum = 0;
  for (const r of rows) {
    const q = rowQty(r);
    eSum += r.excelAreaM2 * q;
    dSum += r.dxfAreaM2 * q;
  }
  const rowMismatch = rows.some((r) => r.mismatchFields.includes("Area"));
  return finalizeMetric(eSum, dSum, rowMismatch, DIMENSION_TOLERANCE);
}

/** Σ(Excel unit weight × qty) vs Σ(DXF-derived weight × qty), kg·qty. */
export function computeWeightMetric(rows: ValidationRow[]): CompareMetricResult {
  let eSum = 0;
  let dSum = 0;
  for (const r of rows) {
    const q = rowQty(r);
    eSum += r.excelWeightKg * q;
    dSum += r.dxfWeightKg * q;
  }
  const rowMismatch = rows.some((r) => r.mismatchFields.includes("Weight"));
  return finalizeMetric(eSum, dSum, rowMismatch, WEIGHT_TOLERANCE);
}

/** Row-level material grade vs DXF (no numeric aggregate). */
export function computeMaterialMetric(rows: ValidationRow[]): CompareMetricResult {
  const rowMismatch = rows.some((r) => r.mismatchFields.includes("Material"));
  return finalizeMetric(0, 0, rowMismatch, DIMENSION_TOLERANCE);
}
