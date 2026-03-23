"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Batch } from "@/types";
import type { UnitSystem } from "@/types/settings";
import { getResolvedThicknessCuttingRule } from "@/lib/nesting/resolvedCuttingRules";
import { resetBatchThicknessOverride } from "@/lib/nesting/thicknessOverrides";
import { ThicknessCuttingOverrideForm } from "./ThicknessCuttingOverrideForm";

interface ThicknessCuttingSettingsSummaryProps {
  batch: Batch;
  thicknessMm: number | null;
  unitSystem: UnitSystem;
  refreshKey: number;
  onMutate: () => void;
}

export function ThicknessCuttingSettingsSummary({
  batch,
  thicknessMm,
  unitSystem,
  refreshKey,
  onMutate,
}: ThicknessCuttingSettingsSummaryProps) {
  const resolved = useMemo(
    () => getResolvedThicknessCuttingRule(batch, thicknessMm, unitSystem),
    [batch.id, batch.cuttingMethod, thicknessMm, unitSystem, refreshKey]
  );

  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const fn = () => onMutate();
    window.addEventListener("plate-cutting-profiles-changed", fn);
    window.addEventListener("plate-app-preferences-changed", fn);
    return () => {
      window.removeEventListener("plate-cutting-profiles-changed", fn);
      window.removeEventListener("plate-app-preferences-changed", fn);
    };
  }, [onMutate]);

  function handleReset() {
    resetBatchThicknessOverride(batch.id, thicknessMm);
    setFormOpen(false);
    onMutate();
  }

  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-3 space-y-2.5 mb-4">
      <div className="flex flex-wrap items-center gap-2 gap-y-1">
        <span className="text-xs font-semibold text-foreground">
          Cutting settings for this thickness
        </span>
        {resolved.isOverride ? (
          <Badge variant="secondary" className="text-[10px] font-medium">
            Customized
          </Badge>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {resolved.summaryLine}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => setFormOpen((o) => !o)}
        >
          {formOpen ? "Close" : "Customize"}
        </Button>
        {resolved.isOverride ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground"
            onClick={handleReset}
          >
            Reset to defaults
          </Button>
        ) : null}
      </div>
      {formOpen ? (
        <ThicknessCuttingOverrideForm
          batch={batch}
          thicknessMm={thicknessMm}
          unitSystem={unitSystem}
          resolved={resolved}
          onSaved={() => {
            setFormOpen(false);
            onMutate();
          }}
          onCancel={() => setFormOpen(false)}
        />
      ) : null}
    </div>
  );
}
