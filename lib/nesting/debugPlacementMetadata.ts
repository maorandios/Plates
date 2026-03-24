import type {
  NestingEngineDebugMeta,
  NestingPlacementModeUsed,
} from "@/types";

/**
 * Debug fields for polygon-aware shelf / footprint traceability.
 */
export function buildPolygonPlacementDebugFields(options: {
  placementModeUsed: NestingPlacementModeUsed;
  polygonPartsCount: number;
  bboxFallbackPartsCount: number;
  fallbackPartIds: string[];
  spacingAppliedMm: number;
  edgeMarginAppliedMm: number;
  rotationModeUsed: NestingEngineDebugMeta["rotationModeApplied"];
}): Pick<
  NestingEngineDebugMeta,
  | "placementModeUsed"
  | "polygonPartsCount"
  | "bboxFallbackPartsCount"
  | "fallbackPartIds"
  | "spacingAppliedMm"
  | "edgeMarginAppliedMm"
  | "rotationModeUsed"
> {
  return {
    placementModeUsed: options.placementModeUsed,
    polygonPartsCount: options.polygonPartsCount,
    bboxFallbackPartsCount: options.bboxFallbackPartsCount,
    fallbackPartIds: [...options.fallbackPartIds],
    spacingAppliedMm: options.spacingAppliedMm,
    edgeMarginAppliedMm: options.edgeMarginAppliedMm,
    rotationModeUsed: options.rotationModeUsed,
  };
}
