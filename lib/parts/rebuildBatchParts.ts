import type { DxfPartGeometry, Part } from "@/types";
import { reprocessDxfGeometry } from "@/lib/geometry";
import { buildUnifiedParts } from "@/lib/matching/matcher";
import {
  getBatchMatchInputs,
  saveDxfGeometriesBatch,
  saveParts,
} from "@/lib/store";

/**
 * Re-runs the DXF geometry pipeline and rebuilds the unified parts table for a batch.
 * Used by Validation (step 2) and after Quick Plate Builder saves.
 */
export function rebuildUnifiedPartsForBatch(batchId: string): Part[] {
  const { clients, files, excelRows, dxfGeometries: rawDxfGeometries } =
    getBatchMatchInputs(batchId);
  const dxfGeometries: DxfPartGeometry[] = rawDxfGeometries.map((geo) =>
    reprocessDxfGeometry(geo)
  );
  saveDxfGeometriesBatch(dxfGeometries);
  const built = buildUnifiedParts({
    batchId,
    clients,
    files,
    excelRows,
    dxfGeometries,
  });
  saveParts(batchId, built);
  return built;
}
