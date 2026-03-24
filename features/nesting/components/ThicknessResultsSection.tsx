"use client";

import type { NestingThicknessResult } from "@/types";
import type { UnitSystem } from "@/types/settings";
import { SheetCard } from "./SheetCard";

interface ThicknessResultsSectionProps {
  batchId: string;
  runId: string;
  result: NestingThicknessResult;
  unitSystem: UnitSystem;
}

export function ThicknessResultsSection({
  batchId,
  runId,
  result,
  unitSystem,
}: ThicknessResultsSectionProps) {
  const label =
    result.thicknessMm != null
      ? `${result.thicknessMm} mm`
      : "Thickness not set";

  const unplacedQty = result.unplacedParts.reduce(
    (s, u) => s + u.quantityUnplaced,
    0
  );

  return (
    <section className="rounded-xl border border-border bg-muted/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          {result.generatedSheets.length} sheet
          {result.generatedSheets.length === 1 ? "" : "s"} ·{" "}
          {result.utilizationPercent.toFixed(1)}% util. · {unplacedQty} unplaced
          qty
        </p>
      </div>
      <div className="p-4 space-y-3">
        {result.generatedSheets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sheets generated.</p>
        ) : (
          result.generatedSheets.map((s) => (
            <SheetCard
              key={s.id}
              batchId={batchId}
              runId={runId}
              sheet={s}
              unitSystem={unitSystem}
            />
          ))
        )}
      </div>
    </section>
  );
}
