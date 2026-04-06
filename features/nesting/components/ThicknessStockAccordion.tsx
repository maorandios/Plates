"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatLength } from "@/lib/settings/unitSystem";
import type { UnitSystem } from "@/types/settings";
import type { Batch } from "@/types";
import type { StockSheetEntry } from "@/types/nesting";
import type { PurchasedSheetSize } from "@/types/settings";
import { filterCatalogForThickness } from "@/lib/settings/purchasedSheetsCatalog";
import {
  type PartThicknessGroup,
  countSheetsByType,
  partCountInGroup,
  thicknessGroupKey,
  totalQuantityInGroup,
} from "@/lib/nesting/stockConfiguration";
import { ThicknessStockTable } from "./ThicknessStockTable";
import { ThicknessCuttingSettingsSummary } from "./ThicknessCuttingSettingsSummary";

interface ThicknessStockAccordionProps {
  batch: Batch;
  groups: PartThicknessGroup[];
  stockRows: StockSheetEntry[];
  /** Global catalog from Preferences — filtered per thickness inside the table. */
  purchasedCatalog: PurchasedSheetSize[];
  unitSystem: UnitSystem;
  cuttingOverridesRefreshKey: number;
  onThicknessCuttingMutate: () => void;
  onAddRow: (thicknessMm: number | null) => void;
  onAddRowFromCatalog: (
    thicknessMm: number | null,
    widthMm: number,
    lengthMm: number
  ) => void;
  onPatchRow: (id: string, patch: Partial<StockSheetEntry>) => void;
  onDeleteRow: (id: string) => void;
}

export function ThicknessStockAccordion({
  batch,
  groups,
  stockRows,
  purchasedCatalog,
  unitSystem,
  cuttingOverridesRefreshKey,
  onThicknessCuttingMutate,
  onAddRow,
  onAddRowFromCatalog,
  onPatchRow,
  onDeleteRow,
}: ThicknessStockAccordionProps) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const first = groups[0];
    return first ? new Set([thicknessGroupKey(first.thicknessMm)]) : new Set();
  });

  useEffect(() => {
    if (groups.length === 0) return;
    setOpenKeys((prev) => {
      if (prev.size > 0) return prev;
      return new Set([thicknessGroupKey(groups[0].thicknessMm)]);
    });
  }, [groups]);

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const key = thicknessGroupKey(group.thicknessMm);
        const rows = stockRows.filter((r) =>
          thicknessGroupKey(r.thicknessMm) === key
        );
        const expanded = openKeys.has(key);
        const partsN = partCountInGroup(group);
        const qty = totalQuantityInGroup(group);
        const purchaseN = countSheetsByType(rows, "purchase");
        const leftoverN = countSheetsByType(rows, "leftover");

        const titleThickness =
          group.thicknessMm != null && Number.isFinite(group.thicknessMm)
            ? formatLength(group.thicknessMm, unitSystem)
            : "Thickness not set";

        return (
          <div
            key={key}
            className="rounded-xl bg-card shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(key)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
              aria-expanded={expanded}
            >
              <span className="mt-0.5 text-muted-foreground shrink-0">
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </span>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground tracking-tight">
                    {titleThickness}
                  </span>
                  <Badge variant="secondary" className="font-mono text-[11px] tabular-nums">
                    {partsN} part{partsN !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[11px] tabular-nums">
                    Qty {qty}
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">
                    {rows.length} sheet{rows.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Purchase sheets:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {purchaseN}
                  </span>
                  <span className="mx-2 text-border">·</span>
                  Leftovers:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {leftoverN}
                  </span>
                </p>
              </div>
            </button>

            {expanded ? (
              <div className="px-4 pb-4 pt-0 border-t border-border/80 bg-muted/15">
                <div className="pt-4">
                  <ThicknessCuttingSettingsSummary
                    batch={batch}
                    thicknessMm={group.thicknessMm}
                    unitSystem={unitSystem}
                    refreshKey={cuttingOverridesRefreshKey}
                    onMutate={onThicknessCuttingMutate}
                  />
                  <ThicknessStockTable
                    groupThicknessMm={group.thicknessMm}
                    rows={rows}
                    catalogForGroup={filterCatalogForThickness(
                      purchasedCatalog,
                      group.thicknessMm
                    )}
                    unitSystem={unitSystem}
                    onAddRow={() => onAddRow(group.thicknessMm)}
                    onAddRowFromCatalog={(widthMm, lengthMm) =>
                      onAddRowFromCatalog(group.thicknessMm, widthMm, lengthMm)
                    }
                    onPatchRow={onPatchRow}
                    onDeleteRow={onDeleteRow}
                  />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
