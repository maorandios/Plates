"use client";

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatQuickQuoteCurrency } from "../../lib/quickQuoteCurrencies";
import type { QuotePartRow, ThicknessStockInput } from "../../types/quickQuote";
import { buildMaterialBreakdown } from "../jobOverview.utils";
import {
  filterPartsForMaterialBreakdown,
  isMaterialBreakdownFiltered,
  MATERIAL_FILTER_ALL,
  summarizeMaterialSelection,
  uniqueMaterialGrades,
  uniqueSheetSizeOptions,
  uniqueThicknessOptions,
  type MaterialBreakdownViewFilters,
} from "../materialBreakdownFilters";
import { MaterialTreemapChart } from "./MaterialTreemapChart";
import { cn } from "@/lib/utils";

const DEFAULT_FILTERS: MaterialBreakdownViewFilters = {
  materialKey: MATERIAL_FILTER_ALL,
  thicknessKey: MATERIAL_FILTER_ALL,
  sheetKey: MATERIAL_FILTER_ALL,
};

interface MaterialBreakdownSectionProps {
  parts: QuotePartRow[];
  thicknessStock?: ThicknessStockInput[] | null;
  thicknessStockProvided: boolean;
  currencyCode: string;
}

function StatCard({
  title,
  value,
  subtext,
}: {
  title: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground mt-1.5">
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1 leading-snug">{subtext}</p>
    </div>
  );
}

export function MaterialBreakdownSection({
  parts,
  thicknessStock,
  thicknessStockProvided,
  currencyCode,
}: MaterialBreakdownSectionProps) {
  const [filters, setFilters] = useState<MaterialBreakdownViewFilters>(DEFAULT_FILTERS);

  const materialOptions = useMemo(() => uniqueMaterialGrades(parts), [parts]);
  const thicknessOptions = useMemo(() => uniqueThicknessOptions(parts), [parts]);
  const sheetOptions = useMemo(
    () => uniqueSheetSizeOptions(thicknessStock),
    [thicknessStock]
  );

  const filteredParts = useMemo(
    () => filterPartsForMaterialBreakdown(parts, filters, thicknessStock),
    [parts, filters, thicknessStock]
  );

  const displayRows = useMemo(
    () => buildMaterialBreakdown(filteredParts, thicknessStock),
    [filteredParts, thicknessStock]
  );

  const summary = useMemo(
    () => summarizeMaterialSelection(filteredParts, thicknessStock),
    [filteredParts, thicknessStock]
  );

  const filtered = isMaterialBreakdownFiltered(filters);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Material breakdown
        </h2>
        <p className="text-sm text-muted-foreground">
          Treemap by grade and thickness. Use the filters to slice the job; tiles and summary
          cards update for the current selection. Reset clears all filters.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          title="Types"
          value={String(summary.typeCount)}
          subtext="Grade × thickness lines in view"
        />
        <StatCard
          title="Quantity"
          value={summary.totalQuantity.toLocaleString()}
          subtext="Total plates (line qty sum)"
        />
        <StatCard
          title="Est. cost"
          value={formatQuickQuoteCurrency(summary.estimatedCost, currencyCode)}
          subtext="Mock line costs × qty (filtered)"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 flex-1 min-w-0">
          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Material grade
            </span>
            <Select
              value={filters.materialKey}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, materialKey: v }))
              }
            >
              <SelectTrigger
                className={cn(
                  "h-10 w-full font-normal",
                  filters.materialKey !== MATERIAL_FILTER_ALL &&
                    "ring-2 ring-foreground/15 border-foreground/25"
                )}
              >
                <SelectValue placeholder="All grades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MATERIAL_FILTER_ALL}>All grades</SelectItem>
                {materialOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Thickness
            </span>
            <Select
              value={filters.thicknessKey}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, thicknessKey: v }))
              }
            >
              <SelectTrigger
                className={cn(
                  "h-10 w-full font-normal",
                  filters.thicknessKey !== MATERIAL_FILTER_ALL &&
                    "ring-2 ring-foreground/15 border-foreground/25"
                )}
              >
                <SelectValue placeholder="All thicknesses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MATERIAL_FILTER_ALL}>All thicknesses</SelectItem>
                {thicknessOptions.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Sheet size
            </span>
            <Select
              value={filters.sheetKey}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, sheetKey: v }))
              }
              disabled={sheetOptions.length === 0}
            >
              <SelectTrigger
                className={cn(
                  "h-10 w-full font-normal",
                  filters.sheetKey !== MATERIAL_FILTER_ALL &&
                    "ring-2 ring-foreground/15 border-foreground/25"
                )}
              >
                <SelectValue
                  placeholder={
                    sheetOptions.length === 0
                      ? "No stock sizes"
                      : "All sheet sizes"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MATERIAL_FILTER_ALL}>All sheet sizes</SelectItem>
                {sheetOptions.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex items-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full gap-2 font-normal"
              onClick={resetFilters}
              disabled={!filtered}
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              Reset chart
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
        <CardContent className="p-3 sm:p-4">
          {displayRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center border border-dashed border-border rounded-lg">
              {filteredParts.length === 0
                ? "No parts match the current filters. Change or reset filters."
                : "No breakdown rows for this selection."}
            </p>
          ) : (
            <MaterialTreemapChart
              key={`${filters.materialKey}-${filters.thicknessKey}-${filters.sheetKey}`}
              rows={displayRows}
              thicknessStockProvided={thicknessStockProvided}
              shareScopeLabel={filtered ? "filtered selection" : "full job"}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
