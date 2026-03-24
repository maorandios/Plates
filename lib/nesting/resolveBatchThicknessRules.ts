import type { Batch } from "@/types";
import type { UnitSystem } from "@/types/settings";
import { getResolvedThicknessCuttingRule } from "./resolvedCuttingRules";

export type ResolvedNestRules = ReturnType<typeof getResolvedThicknessCuttingRule>;

export function resolveNestRulesForThickness(
  batch: Batch,
  thicknessMm: number | null,
  unitSystem: UnitSystem
): ResolvedNestRules {
  return getResolvedThicknessCuttingRule(batch, thicknessMm, unitSystem);
}
