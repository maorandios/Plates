"use client";

import { useMemo, useState } from "react";
import { BarChart3, RotateCcw, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { QuotePartRow, ThicknessStockInput } from "../../types/quickQuote";
import {
  aggregateStockSheetBreakdownByThickness,
  buildStockSheetSizeBreakdown,
  formatAreaM2,
} from "../jobOverview.utils";
import {
  filterPartsForMaterialBreakdown,
  isMaterialBreakdownFiltered,
  MATERIAL_FILTER_ALL,
  uniqueMaterialGrades,
  uniqueSheetSizeOptions,
  uniqueThicknessOptions,
  type MaterialBreakdownViewFilters,
} from "../materialBreakdownFilters";
import { MaterialBreakdownBarChart } from "./MaterialBreakdownBarChart";
import { MaterialBreakdownTable } from "./MaterialBreakdownTable";
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
    <div className="rounded-xl border-0 bg-card px-4 py-4 shadow-sm">
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
  currencyCode: _currencyCode,
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

  const detailStockRows = useMemo(
    () => buildStockSheetSizeBreakdown(filteredParts, thicknessStock),
    [filteredParts, thicknessStock]
  );

  const filtersActive = isMaterialBreakdownFiltered(filters);

  const stockRows = useMemo(() => {
    if (!filtersActive) {
      return aggregateStockSheetBreakdownByThickness(detailStockRows);
    }
    return detailStockRows;
  }, [detailStockRows, filtersActive]);

  const stockTotals = useMemo(() => {
    let gross = 0;
    let sheets = 0;
    for (const r of stockRows) {
      gross += r.grossStockAreaM2;
      sheets += r.sheetCount;
    }
    return {
      grossStockAreaM2: gross,
      sheetCount: sheets,
      sizeCount: stockRows.length,
    };
  }, [stockRows]);

  const filtered = filtersActive;

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
          With no filters, charts roll up to{" "}
          <span className="font-medium text-foreground">one row per thickness</span>{" "}
          (all materials and sheet sizes combined). When you filter material, thickness, or sheet size,
          each line is one nesting run: grade × thickness × chosen stock (same rect-pack rules as the
          quote). Reset clears filters.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          title="Stock lines"
          value={String(stockTotals.sizeCount)}
          subtext={
            filtered
              ? "Material × thickness × sheet size (nesting each)"
              : "Per thickness (all materials & sizes combined)"
          }
        />
        <StatCard
          title="Total sheets"
          value={stockTotals.sheetCount.toLocaleString()}
          subtext={
            filtered
              ? "Sheets to buy for the filtered selection"
              : "Sheets to buy (full job, all sizes)"
          }
        />
        <StatCard
          title="Gross stock"
          value={formatAreaM2(stockTotals.grossStockAreaM2)}
          subtext="Purchased sheet area (rect-pack)"
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

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-3 sm:p-4">
          {stockRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center border border-dashed border-white/15 rounded-xl">
              {filteredParts.length === 0
                ? "No parts match the current filters. Change or reset filters."
                : !thicknessStockProvided
                  ? "Complete Stock & pricing so we can estimate sheet sizes, nesting, and waste."
                  : "No nesting data for this selection."}
            </p>
          ) : (
            <Tabs defaultValue="bars" className="w-full">
              <TabsList className="mb-3 grid w-full grid-cols-2 sm:inline-flex sm:w-auto sm:max-w-full">
                <TabsTrigger value="bars" className="gap-2">
                  <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
                  Columns
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-2">
                  <Table2 className="h-4 w-4 shrink-0" aria-hidden />
                  Table
                </TabsTrigger>
              </TabsList>
              <TabsContent value="bars" className="mt-0">
                <MaterialBreakdownBarChart
                  key={`bars-${filters.materialKey}-${filters.thicknessKey}-${filters.sheetKey}`}
                  rows={stockRows}
                  shareScopeLabel={filtered ? "filtered selection" : "full job"}
                  groupedByThickness={!filtered}
                />
              </TabsContent>
              <TabsContent value="table" className="mt-0">
                <MaterialBreakdownTable
                  key={`table-${filters.materialKey}-${filters.thicknessKey}-${filters.sheetKey}`}
                  rows={stockRows}
                  shareScopeLabel={filtered ? "filtered selection" : "full job"}
                  groupedByThickness={!filtered}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
