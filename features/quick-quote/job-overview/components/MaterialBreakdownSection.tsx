"use client";

import { useMemo, useState } from "react";
import { BarChart3, RotateCcw, Table2 } from "lucide-react";
import { t } from "@/lib/i18n";
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

const QA = "quote.quantityAnalysis" as const;

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
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">
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

  const scopeLabel = filtered
    ? t(`${QA}.chartScopeFiltered`)
    : t(`${QA}.chartScopeFull`);

  return (
    <section className="space-y-6" dir="rtl">
      <div className="space-y-1 text-start">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
          {t(`${QA}.materialSectionTitle`)}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(`${QA}.materialSectionIntro`)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          title={t(`${QA}.statStockLines`)}
          value={String(stockTotals.sizeCount)}
          subtext={
            filtered
              ? t(`${QA}.statStockLinesSubFiltered`)
              : t(`${QA}.statStockLinesSubRollup`)
          }
        />
        <StatCard
          title={t(`${QA}.statTotalSheets`)}
          value={stockTotals.sheetCount.toLocaleString("he-IL")}
          subtext={
            filtered
              ? t(`${QA}.statTotalSheetsSubFiltered`)
              : t(`${QA}.statTotalSheetsSubFull`)
          }
        />
        <StatCard
          title={t(`${QA}.statGrossStock`)}
          value={formatAreaM2(stockTotals.grossStockAreaM2)}
          subtext={t(`${QA}.statGrossStockSub`)}
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 flex-1 min-w-0">
          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {t(`${QA}.filterMaterial`)}
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
                <SelectValue placeholder={t(`${QA}.filterAllGrades`)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MATERIAL_FILTER_ALL}>
                  {t(`${QA}.filterAllGrades`)}
                </SelectItem>
                {materialOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {t(`${QA}.filterThickness`)}
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
                <SelectValue placeholder={t(`${QA}.filterAllThicknesses`)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MATERIAL_FILTER_ALL}>
                  {t(`${QA}.filterAllThicknesses`)}
                </SelectItem>
                {thicknessOptions.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
              {t(`${QA}.filterSheetSize`)}
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
              {t(`${QA}.resetChart`)}
            </Button>
          </div>
        </div>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-3 sm:p-4">
          {stockRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center border border-dashed border-white/15 rounded-xl leading-relaxed px-2">
              {filteredParts.length === 0
                ? t(`${QA}.emptyFiltered`)
                : !thicknessStockProvided
                  ? t(`${QA}.emptyNoStock`)
                  : t(`${QA}.emptyNoNesting`)}
            </p>
          ) : (
            <Tabs defaultValue="bars" className="w-full">
              <TabsList className="mb-3 grid w-full grid-cols-2 sm:inline-flex sm:w-auto sm:max-w-full">
                <TabsTrigger value="bars" className="gap-2">
                  <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
                  {t(`${QA}.tabColumns`)}
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-2">
                  <Table2 className="h-4 w-4 shrink-0" aria-hidden />
                  {t(`${QA}.tabTable`)}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="bars" className="mt-0">
                <MaterialBreakdownBarChart
                  key={`bars-${filters.materialKey}-${filters.thicknessKey}-${filters.sheetKey}`}
                  rows={stockRows}
                  shareScopeLabel={scopeLabel}
                  groupedByThickness={!filtered}
                />
              </TabsContent>
              <TabsContent value="table" className="mt-0">
                <MaterialBreakdownTable
                  key={`table-${filters.materialKey}-${filters.thicknessKey}-${filters.sheetKey}`}
                  rows={stockRows}
                  shareScopeLabel={scopeLabel}
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
