import type { BendPlateQuoteItem } from "@/features/quick-quote/bend-plate/types";

export function aggregatePlateProjectBendMetrics(items: BendPlateQuoteItem[]): {
  totalAreaM2: number;
  totalWeightKg: number;
} {
  let totalAreaM2 = 0;
  let totalWeightKg = 0;
  for (const it of items) {
    const q = Math.max(0, Math.floor(it.global.quantity) || 0);
    totalAreaM2 += it.calc.areaM2 * q;
    totalWeightKg += it.calc.weightKg;
  }
  return { totalAreaM2, totalWeightKg };
}
