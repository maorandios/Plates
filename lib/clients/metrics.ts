import type { ClientMetrics, Part } from "@/types";
import { getBatches, getParts } from "@/lib/store";
import {
  estimateDxfTotalWeightKg,
  excelReferenceTotalKg,
} from "@/lib/parts/excelDxfValidation";

function partWeightKg(p: Part): number {
  const dxf = estimateDxfTotalWeightKg(p);
  if (dxf != null && Number.isFinite(dxf)) return dxf;
  const ex = excelReferenceTotalKg(p);
  return ex != null && Number.isFinite(ex) ? ex : 0;
}

/** Total net area (m²) for one part line (per-piece area × qty). */
function partTotalAreaM2(p: Part): number {
  const qty = p.quantity ?? 1;
  if (qty <= 0) return 0;
  if (p.area != null && p.area >= 0) return p.area * qty;
  if (p.dxfArea != null && p.dxfArea > 0) return (p.dxfArea / 1_000_000) * qty;
  if (p.width != null && p.length != null && p.width > 0 && p.length > 0) {
    return (p.width * p.length) / 1_000_000 * qty;
  }
  return 0;
}

export function getClientMetrics(clientId: string): ClientMetrics {
  const batches = getBatches().filter((b) => b.clientIds.includes(clientId));
  const parts = getParts().filter((p) => p.clientId === clientId);
  const totalQuantity = parts.reduce((s, p) => s + (p.quantity ?? 1), 0);
  const totalWeight = parts.reduce((s, p) => s + partWeightKg(p), 0);
  const totalAreaM2 = parts.reduce((s, p) => s + partTotalAreaM2(p), 0);
  let lastBatchDate: string | null = null;
  for (const b of batches) {
    if (!lastBatchDate || b.updatedAt > lastBatchDate) {
      lastBatchDate = b.updatedAt;
    }
  }
  return {
    clientId,
    totalBatches: batches.length,
    totalParts: parts.length,
    totalQuantity,
    totalWeight,
    totalAreaM2,
    lastBatchDate,
  };
}
