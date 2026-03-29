"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { badgeVariants } from "@/components/ui/badge";
import { getPurchasedSheetSizes } from "@/lib/store";
import { filterCatalogForThickness } from "@/lib/settings/purchasedSheetsCatalog";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { nanoid } from "@/lib/utils/nanoid";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import {
  MATERIAL_TYPE_LABELS,
  type MaterialConfig,
  type MaterialStockSheet,
  type MaterialType,
} from "@/types/materials";
import type { PurchasedSheetSize } from "@/types/settings";
import type {
  JobSummaryMetrics,
  QuoteSheetStockLine,
  ThicknessStockInput,
} from "../types/quickQuote";
import { isThicknessStockComplete } from "../lib/deriveQuoteSelection";
import {
  hasDuplicateSheetSizes,
  sheetFootprintKey,
  thicknessMatchesStockList,
} from "../lib/quoteStockAvailability";

function catalogLabel(
  c: PurchasedSheetSize,
  formatLengthValue: (mm: number) => string
): string {
  const w = formatLengthValue(c.widthMm);
  const l = formatLengthValue(c.lengthMm);
  const base = `${w} × ${l}`;
  const name = c.label?.trim();
  return name ? `${name} · ${base}` : base;
}

function lineLabelForStockLine(
  line: QuoteSheetStockLine,
  catalog: PurchasedSheetSize[],
  materialConfig: MaterialConfig,
  formatLengthValue: (mm: number) => string
): string {
  if (line.catalogId) {
    const c = catalog.find((x) => x.id === line.catalogId);
    if (c) return catalogLabel(c, formatLengthValue);
  }
  if (line.materialSheetId) {
    const s = materialConfig.stockSheets.find((x) => x.id === line.materialSheetId);
    if (s) {
      const w = formatLengthValue(s.widthMm);
      const l = formatLengthValue(s.lengthMm);
      return `${w} × ${l} · settings`;
    }
  }
  return `${formatInteger(line.sheetLengthMm)} × ${formatInteger(line.sheetWidthMm)} mm`;
}

function isFootprintInSheets(
  sheets: QuoteSheetStockLine[],
  widthMm: number,
  lengthMm: number
): boolean {
  const k = sheetFootprintKey(widthMm, lengthMm);
  return sheets.some(
    (s) =>
      s.sheetLengthMm > 0 &&
      s.sheetWidthMm > 0 &&
      sheetFootprintKey(s.sheetWidthMm, s.sheetLengthMm) === k
  );
}

interface StockPricingStepProps {
  jobSummary: JobSummaryMetrics;
  stockRows: ThicknessStockInput[];
  materialType: MaterialType;
  currencyCode: string;
  materialPricePerKg: number;
  onMaterialPriceChange: (value: number) => void;
  onSheetsChange: (thicknessMm: number, sheets: QuoteSheetStockLine[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function StockPricingStep({
  jobSummary,
  stockRows,
  materialType,
  currencyCode,
  materialPricePerKg,
  onMaterialPriceChange,
  onSheetsChange,
  onBack,
  onContinue,
}: StockPricingStepProps) {
  const { preferences, formatLengthValue } = useAppPreferences();
  const unitSystem = preferences.unitSystem;

  const [catalogRev, setCatalogRev] = useState(0);
  const [materialRev, setMaterialRev] = useState(0);

  useEffect(() => {
    const onCatalog = () => setCatalogRev((n) => n + 1);
    window.addEventListener("plate-purchased-sheet-catalog-changed", onCatalog);
    return () =>
      window.removeEventListener("plate-purchased-sheet-catalog-changed", onCatalog);
  }, []);

  useEffect(() => {
    const onMat = () => setMaterialRev((n) => n + 1);
    window.addEventListener("plate-material-config-changed", onMat);
    return () => window.removeEventListener("plate-material-config-changed", onMat);
  }, []);

  const purchasedCatalog = useMemo(
    () => getPurchasedSheetSizes(),
    [catalogRev]
  );

  const materialConfig = useMemo(
    () => getMaterialConfig(materialType),
    [materialType, materialRev]
  );

  const materialLabel = MATERIAL_TYPE_LABELS[materialType];

  const canContinue = useMemo(() => {
    if (stockRows.length === 0) return false;
    const priceOk =
      materialPricePerKg >= 0 && Number.isFinite(materialPricePerKg);
    return priceOk && isThicknessStockComplete(stockRows);
  }, [stockRows, materialPricePerKg]);

  return (
    <div className="space-y-8">
      <div className="w-full">
        <h1 className="text-2xl font-semibold tracking-tight">Stock & pricing</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base max-w-2xl">
          Price per kg for <span className="font-medium text-foreground">{materialLabel}</span>
          , then sheet sizes per plate thickness from this job. One size per footprint per
          thickness; remove any line you will not use.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMini
          label="Unique parts"
          value={formatInteger(jobSummary.uniqueParts)}
        />
        <SummaryMini
          label="Total quantity"
          value={formatInteger(jobSummary.totalQty)}
        />
        <SummaryMini
          label="Total plate area"
          value={`${formatDecimal(jobSummary.totalPlateAreaM2, 2)} m²`}
        />
        <SummaryMini
          label="Est. weight"
          value={`${formatDecimal(jobSummary.totalEstWeightKg, 1)} kg`}
        />
      </div>

      <Card className="border-border shadow-sm w-full">
        <CardHeader className="border-b border-border bg-muted/20 py-3">
          <CardTitle className="text-base">Material purchase price</CardTitle>
          <CardDescription>
            One rate for all plate in this quote ({currencyCode}/kg, before other costs).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs text-muted-foreground font-normal">
              Price ({currencyCode}/kg)
            </Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              className="h-9 font-mono text-sm"
              value={materialPricePerKg}
              onChange={(e) => onMaterialPriceChange(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Purchased stock by thickness
          </h2>
          <Button variant="outline" size="sm" className="h-8 gap-1.5" asChild>
            <Link href="/settings/materials">
              <Settings2 className="h-3.5 w-3.5" />
              Edit material &amp; sheet sizes
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {stockRows.map((row) => {
            const forTh = filterCatalogForThickness(purchasedCatalog, row.thicknessMm);
            const materialSheetsForTh = materialConfig.stockSheets.filter(
              (s) =>
                s.enabled && thicknessMatchesStockList(row.thicknessMm, s.thicknessesMm)
            );

            function updateSheets(next: QuoteSheetStockLine[]) {
              onSheetsChange(row.thicknessMm, next);
            }

            function addFromCatalog(c: PurchasedSheetSize) {
              if (isFootprintInSheets(row.sheets, c.widthMm, c.lengthMm)) return;
              updateSheets([
                ...row.sheets,
                {
                  id: nanoid(),
                  sheetLengthMm: Math.max(c.widthMm, c.lengthMm),
                  sheetWidthMm: Math.min(c.widthMm, c.lengthMm),
                  catalogId: c.id,
                },
              ]);
            }

            function addFromMaterialSheet(s: MaterialStockSheet) {
              if (isFootprintInSheets(row.sheets, s.widthMm, s.lengthMm)) return;
              updateSheets([
                ...row.sheets,
                {
                  id: nanoid(),
                  sheetLengthMm: Math.max(s.widthMm, s.lengthMm),
                  sheetWidthMm: Math.min(s.widthMm, s.lengthMm),
                  materialSheetId: s.id,
                },
              ]);
            }

            function removeLine(id: string) {
              updateSheets(row.sheets.filter((s) => s.id !== id));
            }

            function patchLine(
              id: string,
              patch: Partial<
                Pick<QuoteSheetStockLine, "sheetLengthMm" | "sheetWidthMm">
              >
            ) {
              updateSheets(
                row.sheets.map((s) =>
                  s.id === id
                    ? { ...s, ...patch, catalogId: undefined, materialSheetId: undefined }
                    : s
                )
              );
            }

            function addManual() {
              updateSheets([
                ...row.sheets,
                {
                  id: nanoid(),
                  sheetLengthMm: 0,
                  sheetWidthMm: 0,
                },
              ]);
            }

            const dupInRow = hasDuplicateSheetSizes(row.sheets);

            return (
              <Card key={row.thicknessMm} className="border-border shadow-sm">
                <CardHeader className="border-b border-border bg-muted/20 py-3">
                  <CardTitle className="text-base">{row.thicknessMm} mm plate</CardTitle>
                  <CardDescription>
                    Parts at this thickness use these purchased sheet sizes for costing (
                    {unitSystem}).
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 grid gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground font-normal">
                      Sheet sizes for this quote
                    </Label>
                    {row.sheets.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic rounded-md border border-dashed border-border px-3 py-2">
                        Add at least one sheet size — use settings, saved catalog, or manual
                        entry.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {row.sheets.map((line) =>
                          line.catalogId || line.materialSheetId ? (
                            <div
                              key={line.id}
                              className={cn(
                                badgeVariants({ variant: "secondary" }),
                                "inline-flex w-fit max-w-full items-center gap-1 pl-3 pr-1 py-1 h-auto font-normal"
                              )}
                            >
                              <span className="text-left leading-snug pr-1">
                                {lineLabelForStockLine(
                                  line,
                                  purchasedCatalog,
                                  materialConfig,
                                  formatLengthValue
                                )}
                              </span>
                              <button
                                type="button"
                                className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-background/60 shrink-0"
                                aria-label="Remove sheet from quote"
                                onClick={() => removeLine(line.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              key={line.id}
                              className="flex flex-wrap items-end gap-3 gap-y-2 rounded-lg border border-border bg-muted/20 p-3"
                            >
                              <div className="space-y-1.5 flex-1 min-w-[120px]">
                                <Label className="text-xs text-muted-foreground font-normal">
                                  Sheet length (mm)
                                </Label>
                                <div className="flex gap-2 items-center">
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    className="h-9 font-mono text-sm"
                                    value={
                                      line.sheetLengthMm > 0
                                        ? line.sheetLengthMm
                                        : ""
                                    }
                                    onChange={(e) =>
                                      patchLine(line.id, {
                                        sheetLengthMm: Number(e.target.value),
                                      })
                                    }
                                  />
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    mm
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1.5 flex-1 min-w-[120px]">
                                <Label className="text-xs text-muted-foreground font-normal">
                                  Sheet width (mm)
                                </Label>
                                <div className="flex gap-2 items-center">
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    className="h-9 font-mono text-sm"
                                    value={
                                      line.sheetWidthMm > 0
                                        ? line.sheetWidthMm
                                        : ""
                                    }
                                    onChange={(e) =>
                                      patchLine(line.id, {
                                        sheetWidthMm: Number(e.target.value),
                                      })
                                    }
                                  />
                                  <span className="text-xs text-muted-foreground shrink-0">
                                    mm
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                                aria-label="Remove manual sheet"
                                onClick={() => removeLine(line.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                    {dupInRow ? (
                      <p className="text-xs text-destructive">
                        Two or more lines use the same sheet size — change or remove one.
                      </p>
                    ) : null}
                  </div>

                  {(materialSheetsForTh.length > 0 || forTh.length > 0) && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground font-normal">
                        Add from settings or saved catalog
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {materialSheetsForTh.map((s) => {
                          const inQuote = isFootprintInSheets(
                            row.sheets,
                            s.widthMm,
                            s.lengthMm
                          );
                          return (
                            <button
                              key={`m-${s.id}`}
                              type="button"
                              disabled={inQuote}
                              onClick={() => addFromMaterialSheet(s)}
                              className={cn(
                                badgeVariants({ variant: "outline" }),
                                "h-auto min-h-8 gap-1.5 py-1.5 pl-2.5 pr-2 font-normal text-left",
                                inQuote
                                  ? "opacity-40 cursor-not-allowed"
                                  : "cursor-pointer hover:bg-muted/80"
                              )}
                            >
                              <span className="max-w-[220px] leading-snug">
                                {formatLengthValue(s.widthMm)} ×{" "}
                                {formatLengthValue(s.lengthMm)}
                                <span className="text-muted-foreground"> · settings</span>
                              </span>
                              {!inQuote ? (
                                <Plus
                                  className="h-3.5 w-3.5 shrink-0 opacity-70"
                                  aria-hidden
                                />
                              ) : null}
                            </button>
                          );
                        })}
                        {forTh.map((c) => {
                          const inQuote = isFootprintInSheets(
                            row.sheets,
                            c.widthMm,
                            c.lengthMm
                          );
                          return (
                            <button
                              key={`c-${c.id}`}
                              type="button"
                              disabled={inQuote}
                              onClick={() => addFromCatalog(c)}
                              className={cn(
                                badgeVariants({ variant: "outline" }),
                                "h-auto min-h-8 gap-1.5 py-1.5 pl-2.5 pr-2 font-normal text-left",
                                inQuote
                                  ? "opacity-40 cursor-not-allowed"
                                  : "cursor-pointer hover:bg-muted/80"
                              )}
                            >
                              <span className="max-w-[220px] leading-snug">
                                {catalogLabel(c, formatLengthValue)}
                                <span className="text-muted-foreground"> · saved</span>
                              </span>
                              {!inQuote ? (
                                <Plus
                                  className="h-3.5 w-3.5 shrink-0 opacity-70"
                                  aria-hidden
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1.5"
                    onClick={addManual}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add custom sheet size
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {stockRows.length === 0 && (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed border-border px-4 py-8 text-center">
            No parts in this run — go back and select plates from validation.
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onBack}>
          Back to validation
        </Button>
        <Button type="button" size="lg" disabled={!canContinue} onClick={onContinue}>
          Continue to calculation
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function SummaryMini({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-2 pt-4">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
