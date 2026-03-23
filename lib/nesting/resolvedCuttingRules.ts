import type { Batch } from "@/types";
import type { BatchThicknessOverride } from "@/types/nesting";
import type { CuttingProfileRange, ProfileRotationMode } from "@/types/production";
import {
  CUTTING_METHOD_LABELS,
  DEFAULT_CUTTING_PROFILE_RANGES,
} from "@/types/production";
import {
  getCuttingProfileRanges,
  getMatchingCuttingProfileRule,
} from "@/lib/settings/cuttingProfiles";
import { getBatchThicknessOverride } from "./thicknessOverrides";
import type { UnitSystem } from "@/types/settings";
import { formatLengthValueOnly } from "@/lib/settings/unitSystem";

function firstBandForMethod(method: Batch["cuttingMethod"]): CuttingProfileRange {
  const fromSettings = getCuttingProfileRanges(method);
  if (fromSettings.length > 0) return fromSettings[0];
  const seeds = DEFAULT_CUTTING_PROFILE_RANGES.filter((r) => r.method === method).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  return seeds[0]!;
}

export function formatCuttingProfileRangeLabel(
  range: CuttingProfileRange,
  unitSystem: UnitSystem
): string {
  const u = unitSystem === "metric" ? "mm" : "in";
  const a = formatLengthValueOnly(range.minThicknessMm, unitSystem);
  if (range.maxThicknessMm === null) {
    return `${a}+ ${u}`;
  }
  const b = formatLengthValueOnly(range.maxThicknessMm, unitSystem);
  return `${a}–${b} ${u}`;
}

/**
 * Final cutting/nesting defaults for a batch thickness band:
 * override wins; else global profile matched to thickness; else first band as reference.
 */
export interface ResolvedThicknessCuttingRule {
  spacingMm: number;
  edgeMarginMm: number;
  allowRotation: boolean;
  rotationMode: ProfileRotationMode;
  defaultMarkPartName: boolean;
  defaultIncludeClientCode: boolean;
  isOverride: boolean;
  /** Profile band that matched the part thickness, when thickness is known */
  matchedGlobalRange: CuttingProfileRange | null;
  /** Label for matched band, or null when thickness unknown */
  globalRangeLabel: string | null;
  /** Band used to fill baseline when no thickness match (same as first band) */
  referenceGlobalRange: CuttingProfileRange;
  methodLabel: string;
  /** Short line for collapsed UI */
  summaryLine: string;
  overrideRecord: BatchThicknessOverride | null;
}

export function getResolvedThicknessCuttingRule(
  batch: Batch,
  thicknessMm: number | null,
  unitSystem: UnitSystem
): ResolvedThicknessCuttingRule {
  const method = batch.cuttingMethod;
  const methodLabel = CUTTING_METHOD_LABELS[method];

  const matchedGlobalRange =
    thicknessMm != null && Number.isFinite(thicknessMm)
      ? getMatchingCuttingProfileRule(method, thicknessMm)
      : null;

  const referenceGlobalRange =
    matchedGlobalRange ?? firstBandForMethod(method);

  const globalRangeLabel = matchedGlobalRange
    ? formatCuttingProfileRangeLabel(matchedGlobalRange, unitSystem)
    : null;

  const overrideRecord =
    getBatchThicknessOverride(batch.id, thicknessMm) ?? null;

  const baseSpacing = referenceGlobalRange.defaultSpacingMm;
  const baseEdge = referenceGlobalRange.defaultEdgeMarginMm;
  const baseRot = referenceGlobalRange.allowRotation;
  const baseMode = referenceGlobalRange.rotationMode;
  const baseMark = referenceGlobalRange.defaultMarkPartName;
  const baseClient = referenceGlobalRange.defaultIncludeClientCode;

  const spacingMm = overrideRecord?.spacingMm ?? baseSpacing;
  const edgeMarginMm = overrideRecord?.edgeMarginMm ?? baseEdge;
  const allowRotation = overrideRecord?.allowRotation ?? baseRot;
  const rotationMode = overrideRecord?.rotationMode ?? baseMode;
  const defaultMarkPartName =
    overrideRecord?.defaultMarkPartName ?? baseMark;
  const defaultIncludeClientCode =
    overrideRecord?.defaultIncludeClientCode ?? baseClient;

  const isOverride = overrideRecord != null;

  const referenceLabel = formatCuttingProfileRangeLabel(
    referenceGlobalRange,
    unitSystem
  );

  let summaryLine: string;
  if (isOverride) {
    const band =
      globalRangeLabel ?? referenceLabel;
    summaryLine = `Batch-specific values active · global reference: ${methodLabel} (${band})`;
  } else if (matchedGlobalRange) {
    summaryLine = `Using ${methodLabel} defaults (${globalRangeLabel})`;
  } else {
    summaryLine = `No part thickness in this group — reference ${methodLabel} (${referenceLabel})`;
  }

  return {
    spacingMm,
    edgeMarginMm,
    allowRotation,
    rotationMode,
    defaultMarkPartName,
    defaultIncludeClientCode,
    isOverride,
    matchedGlobalRange,
    globalRangeLabel,
    referenceGlobalRange,
    methodLabel,
    summaryLine,
    overrideRecord,
  };
}
