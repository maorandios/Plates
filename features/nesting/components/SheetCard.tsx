"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { GeneratedSheet } from "@/types";
import { formatDecimal } from "@/lib/formatNumbers";
import { formatLength } from "@/lib/settings/unitSystem";
import type { UnitSystem } from "@/types/settings";

interface SheetCardProps {
  batchId: string;
  runId: string;
  sheet: GeneratedSheet;
  unitSystem: UnitSystem;
}

export function SheetCard({ batchId, runId, sheet, unitSystem }: SheetCardProps) {
  const typeLabel = sheet.stockType === "purchase" ? "Purchase" : "Leftover";
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="space-y-1 text-sm">
        <p className="font-medium text-foreground">
          {formatLength(sheet.widthMm, unitSystem)} ×{" "}
          {formatLength(sheet.lengthMm, unitSystem)}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="capitalize">{typeLabel}</span>
          <span className="mx-1.5 text-border">·</span>
          {sheet.placements.length} part{sheet.placements.length === 1 ? "" : "s"}
          <span className="mx-1.5 text-border">·</span>
          {formatDecimal(sheet.utilizationPercent, 1)}% util.
        </p>
      </div>
      <Button asChild size="sm" variant="default">
        <Link
          href={`/batches/${batchId}/nesting-results/${sheet.id}?run=${encodeURIComponent(runId)}`}
        >
          View sheet
        </Link>
      </Button>
    </div>
  );
}
