import type { PlateBuilderSpecV1 } from "../types";
import { generatePlateDxf } from "./generatePlateDxf";
import { parseDxfFile } from "@/lib/parsers/dxfParser";
import {
  getPartsByBatch,
  saveDxfGeometry,
  saveFile,
  saveFileData,
  saveParts,
} from "@/lib/store";
import { nanoid } from "@/lib/utils/nanoid";
import { rebuildUnifiedPartsForBatch } from "@/lib/parts/rebuildBatchParts";

function safeFileBase(name: string): string {
  const t = name.trim().replace(/[^a-zA-Z0-9._\s-]+/g, "_").replace(/\s+/g, "_");
  return t.slice(0, 80) || "plate";
}

/**
 * Persists DXF + geometry, rebuilds the parts table, then applies parametric metadata
 * (qty / thickness / material / name) so built plates do not depend on DXF text parsing
 * for BOM fields.
 */
export function saveBuiltPlateToBatch(
  spec: PlateBuilderSpecV1,
  batchId: string
): { fileId: string } {
  const dxfText = generatePlateDxf(spec);
  const fileId = nanoid();
  const dataKey = `${spec.clientId}_${fileId}`;
  const baseName = safeFileBase(spec.partName);
  const fileName = `${baseName}.dxf`;
  const specJson = JSON.stringify(spec);

  const uploaded = {
    id: fileId,
    clientId: spec.clientId,
    batchId,
    name: fileName,
    type: "dxf" as const,
    sourceKind: "built" as const,
    builtPlateSpec: specJson,
    sizeBytes: new TextEncoder().encode(dxfText).length,
    parseStatus: "parsing" as const,
    uploadedAt: new Date().toISOString(),
    dataKey,
  };

  saveFile(uploaded);
  saveFileData(dataKey, dxfText);

  const result = parseDxfFile(dxfText, fileId, fileName, spec.clientId, batchId);
  saveDxfGeometry({ ...result.geometry, id: nanoid() });

  saveFile({
    ...uploaded,
    parseStatus: "parsed",
    parsedRowCount: result.geometry.entityCount,
    parseWarnings:
      result.warnings.length > 0 ? result.warnings : undefined,
    detectedUnit: result.unitDetection.detectedUnit,
    detectedUnitLabel: result.unitDetection.displayLabel,
    detectedUnitSource: result.unitDetection.source,
  });

  rebuildUnifiedPartsForBatch(batchId);

  const patched = getPartsByBatch(batchId).map((p) =>
    p.dxfFileId === fileId
      ? {
          ...p,
          partName: spec.partName,
          quantity: spec.quantity,
          thickness: spec.thickness,
          material: spec.material,
          partSource: "built" as const,
          builtPlateSpec: specJson,
        }
      : p
  );
  saveParts(batchId, patched);

  return { fileId };
}
