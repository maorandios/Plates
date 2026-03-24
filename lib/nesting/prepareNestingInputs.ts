import type { Batch, Part, ProcessedGeometry } from "@/types";
import type { UnitSystem } from "@/types/settings";
import { getDxfGeometryByFile, getPartsByBatch } from "@/lib/store";
import { reprocessDxfGeometry } from "@/lib/geometry";
import { getMarkingText } from "@/lib/geometry/marking";
import { thicknessGroupKey } from "./stockConfiguration";
import { resolveNestRulesForThickness } from "./resolveBatchThicknessRules";
import {
  expandPartInstances,
  type NestablePartInstance,
} from "./expandPartInstances";

export function isPartReadyForNesting(
  part: Part,
  pg: ProcessedGeometry | null | undefined
): boolean {
  if (!part.dxfFileId || !pg) return false;
  if (!pg.isValid || pg.outer.length < 3) return false;
  /* valid + warning are nestable; only hard errors block nesting */
  if (part.geometryStatus === "error") return false;
  const qty = part.quantity ?? 1;
  if (!Number.isFinite(qty) || qty < 1) return false;
  const thk = part.thickness;
  if (thk != null && (!Number.isFinite(thk) || thk <= 0)) return false;
  return true;
}

export interface NestingPreparationResult {
  instancesByThickness: Map<string, NestablePartInstance[]>;
  warnings: string[];
}

/**
 * Loads DXF geometry via reprocess (vertices from file), expands quantities, groups by thickness key.
 */
export function prepareNestingInputs(
  batch: Batch,
  unitSystem: UnitSystem
): NestingPreparationResult {
  const parts = getPartsByBatch(batch.id);
  const warnings: string[] = [];
  const geometryByPartId = new Map<string, ProcessedGeometry>();
  const markingByPartId = new Map<string, string>();

  for (const p of parts) {
    if (!p.dxfFileId) continue;
    const stored = getDxfGeometryByFile(p.dxfFileId);
    if (!stored) {
      warnings.push(`Part “${p.partName}”: no stored DXF geometry.`);
      continue;
    }
    const geo = reprocessDxfGeometry(stored);
    const pg = geo.processedGeometry;
    if (!isPartReadyForNesting(p, pg)) {
      warnings.push(`Part “${p.partName}”: skipped (geometry not ready for nesting).`);
      continue;
    }
    geometryByPartId.set(p.id, pg!);
    const rules = resolveNestRulesForThickness(
      batch,
      p.thickness ?? null,
      unitSystem
    );
    markingByPartId.set(
      p.id,
      getMarkingText(p, {
        markPartName: rules.defaultMarkPartName,
        includeClientCode: rules.defaultIncludeClientCode,
      })
    );
  }

  const readyParts = parts.filter((p) => geometryByPartId.has(p.id));
  const instances = expandPartInstances(
    readyParts,
    geometryByPartId,
    markingByPartId
  );
  const instancesByThickness = new Map<string, NestablePartInstance[]>();
  for (const inst of instances) {
    const key = thicknessGroupKey(inst.thicknessMm);
    const list = instancesByThickness.get(key) ?? [];
    list.push(inst);
    instancesByThickness.set(key, list);
  }
  return { instancesByThickness, warnings };
}
