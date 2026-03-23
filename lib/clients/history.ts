import type { ClientBatchHistoryRow, Part } from "@/types";
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

/**
 * Every batch that lists this client, with aggregates from saved parts (zeros if none yet).
 */
export function getClientBatchHistory(clientId: string): ClientBatchHistoryRow[] {
  const batches = getBatches().filter((b) => b.clientIds.includes(clientId));
  const allParts = getParts().filter((p) => p.clientId === clientId);
  const partsByBatch = new Map<string, Part[]>();
  for (const p of allParts) {
    const list = partsByBatch.get(p.batchId) ?? [];
    list.push(p);
    partsByBatch.set(p.batchId, list);
  }

  const rows: ClientBatchHistoryRow[] = batches.map((batch) => {
    const parts = partsByBatch.get(batch.id) ?? [];
    const totalQuantity = parts.reduce((s, p) => s + (p.quantity ?? 1), 0);
    const totalWeight = parts.reduce((s, p) => s + partWeightKg(p), 0);
    return {
      batchId: batch.id,
      batchName: batch.name,
      batchCreatedAt: batch.createdAt,
      cuttingMethod: batch.cuttingMethod,
      partsCount: parts.length,
      totalQuantity,
      totalWeight,
    };
  });

  return rows.sort(
    (a, b) =>
      new Date(b.batchCreatedAt).getTime() -
      new Date(a.batchCreatedAt).getTime()
  );
}
