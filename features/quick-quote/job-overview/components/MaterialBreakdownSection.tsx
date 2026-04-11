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
} from "../jobOverview.utils";
import {
  filterPartsForMaterialBreakdown,
  isMaterialBreakdownFiltered,
  MATERIAL_FILTER_ALL,
  uniqueMaterialGrades,
  uniqueSheetSizeOptions,
  uniqueThicknessOptions,
  type SheetSizeOption,
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

function formatStockSheetOptionLabel(s: SheetSizeOption): string {
  const l = Math.round(s.lengthMm);
  const w = Math.round(s.widthMm);
  return `${l.toLocaleString("he-IL")} × ${w.toLocaleString("he-IL")} ${t(`${QA}.unitMm`)}`;
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

  const filtered = filtersActive;

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  const scopeLabel = filtered
    ? t(`${QA}.chartScopeFiltered`)
    : t(`${QA}.chartScopeFull`);

  const filterGrid = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            {thicknessOptions.map((opt) => (
              <SelectItem key={opt.key} value={opt.key}>
                {opt.label}
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
                  ? t(`${QA}.filterNoStockSizes`)
                  : t(`${QA}.filterAllSheets`)
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MATERIAL_FILTER_ALL}>
              {t(`${QA}.filterAllSheets`)}
            </SelectItem>
            {sheetOptions.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {formatStockSheetOptionLabel(s)}
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
  );

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

      {stockRows.length === 0 ? (
        <>
          {filterGrid}
          <Card className="shadow-sm overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <p className="text-sm text-muted-foreground py-16 text-center border border-dashed border-white/15 rounded-xl leading-relaxed px-2">
                {filteredParts.length === 0
                  ? t(`${QA}.emptyFiltered`)
                  : !thicknessStockProvided
                    ? t(`${QA}.emptyNoStock`)
                    : t(`${QA}.emptyNoNesting`)}
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Tabs defaultValue="bars" dir="rtl" className="w-full space-y-6">
          {filterGrid}
          <Card className="shadow-sm overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="mb-3 flex w-full justify-center">
                <TabsList className="inline-flex h-10 w-auto max-w-full gap-1">
                  <TabsTrigger value="bars" className="gap-2 px-4">
                    <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
                    {t(`${QA}.tabColumns`)}
                  </TabsTrigger>
                  <TabsTrigger value="table" className="gap-2 px-4">
                    <Table2 className="h-4 w-4 shrink-0" aria-hidden />
                    {t(`${QA}.tabTable`)}
                  </TabsTrigger>
                </TabsList>
              </div>
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
            </CardContent>
          </Card>
        </Tabs>
      )}
    </section>
  );
}
