import type { ManualQuotePartRow } from "../types/quickQuote";

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
