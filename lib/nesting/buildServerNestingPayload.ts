import { reprocessDxfGeometry } from "@/lib/geometry";
import { getMarkingText } from "@/lib/geometry/marking";
import {
  getDxfGeometryByFile,
  getPartsByBatch,
  getStockSheetsByBatch,
} from "@/lib/store";
import type { Batch, Part } from "@/types";
import type { UnitSystem } from "@/types/settings";
import { resolveNestRulesForThickness } from "./resolveBatchThicknessRules";
import { thicknessGroupKey } from "./stockConfiguration";

export interface ServerNestingPartPayload {
  partId: string;
  partName: string;
  clientId: string;
  clientCode: string;
  quantity: number;
  areaMm2: number;
  outerContour: [number, number][];
  innerContours: [number, number][][];
  markingText: string;
  geometryStatus: "ready" | "warning" | "error";
}

export interface ServerNestingJobPayload {
  batchId: string;
  cuttingMethod: Batch["cuttingMethod"];
  runMode: "quick" | "optimize";
  thicknessGroups: Array<{
    thicknessMm: number | null;
    resolvedRules: {
      spacingMm: number;
      edgeMarginMm: number;
      allowRotation: boolean;
      rotationMode: "none" | "ninetyOnly" | "free";
      /** Min gap (mm) between identical parts; 0 = allow flush / common-line style. Omitted sends 0. */
      samePartGapMm?: number;
    };
    stockSheets: Array<{
      id: string;
      widthMm: number;
      heightMm: number;
      type: "purchase" | "leftover";
      enabled: boolean;
    }>;
    parts: ServerNestingPartPayload[];
  }>;
}

function toGeometryStatus(part: Part): "ready" | "warning" | "error" {
  if (part.geometryStatus === "error") return "error";
  if (part.geometryStatus === "warning") return "warning";
  return "ready";
}

export function buildServerNestingPayload(options: {
  batch: Batch;
  unitSystem: UnitSystem;
  runMode: "quick" | "optimize";
}): ServerNestingJobPayload {
  const { batch, unitSystem, runMode } = options;
  const parts = getPartsByBatch(batch.id);
  const stock = getStockSheetsByBatch(batch.id).filter(
    (s) => s.enabled && s.widthMm > 0 && s.lengthMm > 0
  );

  const thicknessKeySet = new Set<string>();
  const thicknessValueByKey = new Map<string, number | null>();
  for (const s of stock) {
    const key = thicknessGroupKey(s.thicknessMm);
    thicknessKeySet.add(key);
    thicknessValueByKey.set(key, s.thicknessMm ?? null);
  }
  for (const p of parts) {
    const key = thicknessGroupKey(p.thickness ?? null);
    thicknessKeySet.add(key);
    thicknessValueByKey.set(key, p.thickness ?? null);
  }

  const groups = [...thicknessKeySet].map((key) => {
    const thicknessMm = thicknessValueByKey.get(key) ?? null;
    const rules = resolveNestRulesForThickness(batch, thicknessMm, unitSystem);
    const rotationMode: "none" | "ninetyOnly" | "free" = rules.allowRotation
      ? rules.rotationMode
      : "none";

    const groupStock = stock
      .filter((s) => thicknessGroupKey(s.thicknessMm) === key)
      .map((s) => ({
        id: s.id,
        widthMm: s.widthMm,
        heightMm: s.lengthMm,
        type: s.type,
        enabled: s.enabled,
      }));

    const groupParts: ServerNestingPartPayload[] = [];
    for (const part of parts) {
      if (thicknessGroupKey(part.thickness ?? null) !== key) continue;
      if (!part.dxfFileId) continue;
      const stored = getDxfGeometryByFile(part.dxfFileId);
      if (!stored) continue;
      const pg = reprocessDxfGeometry(stored).processedGeometry;
      if (!pg || !pg.outer || pg.outer.length < 3) continue;
      const quantity =
        typeof part.quantity === "number" && Number.isFinite(part.quantity)
          ? Math.max(1, Math.round(part.quantity))
          : 1;
      groupParts.push({
        partId: part.id,
        partName: part.partName,
        clientId: part.clientId,
        clientCode: part.clientCode,
        quantity,
        areaMm2: Math.max(0, pg.area ?? 0),
        outerContour: pg.outer,
        innerContours: pg.holes ?? [],
        markingText: getMarkingText(part, {
          markPartName: rules.defaultMarkPartName,
          includeClientCode: rules.defaultIncludeClientCode,
        }),
        geometryStatus: toGeometryStatus(part),
      });
    }

    return {
      thicknessMm,
      resolvedRules: {
        spacingMm: Math.max(0, rules.spacingMm),
        edgeMarginMm: Math.max(0, rules.edgeMarginMm),
        allowRotation: rules.allowRotation,
        rotationMode,
        samePartGapMm: 0,
      },
      stockSheets: groupStock,
      parts: groupParts,
    };
  });

  return {
    batchId: batch.id,
    cuttingMethod: batch.cuttingMethod,
    runMode,
    thicknessGroups: groups,
  };
}
