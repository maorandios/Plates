import type { BatchThicknessOverride } from "@/types/nesting";
import {
  getBatchThicknessOverrideRecordsForBatch,
  removeBatchThicknessOverrideRecord,
  upsertBatchThicknessOverrideRecord,
} from "@/lib/store";
import { thicknessGroupKey } from "@/lib/nesting/stockConfiguration";

export function getBatchThicknessOverride(
  batchId: string,
  thicknessMm: number | null
): BatchThicknessOverride | undefined {
  const key = thicknessGroupKey(thicknessMm);
  return getBatchThicknessOverrideRecordsForBatch(batchId).find(
    (o) => thicknessGroupKey(o.thicknessMm) === key
  );
}

export function saveBatchThicknessOverride(
  entry: BatchThicknessOverride
): void {
  upsertBatchThicknessOverrideRecord(entry);
}

export function resetBatchThicknessOverride(
  batchId: string,
  thicknessMm: number | null
): void {
  removeBatchThicknessOverrideRecord(batchId, thicknessMm);
}
