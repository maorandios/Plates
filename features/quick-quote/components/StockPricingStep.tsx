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
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { nanoid } from "@/lib/utils/nanoid";
import { cn } from "@/lib/utils";
import type { PurchasedSheetSize } from "@/types/settings";
import type {
  JobSummaryMetrics,
  QuoteSheetStockLine,
  ThicknessStockInput,
} from "../types/quickQuote";
import { isThicknessStockComplete } from "../lib/deriveQuoteSelection";

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

function lineLabelFromCatalog(
  line: QuoteSheetStockLine,
  catalog: PurchasedSheetSize[],
  formatLengthValue: (mm: number) => string
): string {
  if (line.catalogId) {
    const c = catalog.find((x) => x.id === line.catalogId);
    if (c) return catalogLabel(c, formatLengthValue);
  }
  return `${line.sheetLengthMm} × ${line.sheetWidthMm} mm`;
}

interface StockPricingStepProps {
  jobSummary: JobSummaryMetrics;
  stockRows: ThicknessStockInput[];
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
  useEffect(() => {
    const onCatalog = () => setCatalogRev((n) => n + 1);
    window.addEventListener("plate-purchased-sheet-catalog-changed", onCatalog);
    return () =>
      window.removeEventListener("plate-purchased-sheet-catalog-changed", onCatalog);
  }, []);

  const purchasedCatalog = useMemo(
    () => getPurchasedSheetSizes(),
    [catalogRev]
  );

  const canContinue = useMemo(() => {
    if (stockRows.length === 0) return false;
    const priceOk =
      materialPricePerKg >= 0 && Number.isFinite(materialPricePerKg);
    return priceOk && isThicknessStockComplete(stockRows);
  }, [stockRows, materialPricePerKg]);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Stock & pricing</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Add one or more purchased sheet sizes per thickness using{" "}
          <Link
            href="/settings"
            className="text-foreground underline underline-offset-2 font-medium"
          >
            Preferences
          </Link>{" "}
          shortcuts (badges) or{" "}
          <span className="font-medium text-foreground">Add sheet manually</span> when you
          need a custom size. Remove a sheet from this quote with ×. One purchase price per
          kg applies to all thicknesses.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMini
          label="Unique parts"
          value={String(jobSummary.uniqueParts)}
        />
        <SummaryMini
          label="Total quantity"
          value={String(jobSummary.totalQty)}
        />
        <SummaryMini
          label="Total plate area"
          value={`${jobSummary.totalPlateAreaM2.toFixed(2)} m²`}
        />
        <SummaryMini
          label="Est. weight"
          value={`${jobSummary.totalEstWeightKg.toFixed(1)} kg`}
        />
      </div>

      <Card className="border-border shadow-sm max-w-xl">
        <CardHeader className="border-b border-border bg-muted/20 py-3">
          <CardTitle className="text-base">Material purchase price</CardTitle>
          <CardDescription>
            Single rate for all plate in this quote ({currencyCode}/kg, before other
            costs).
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
            <Link href="/settings">
              <Settings2 className="h-3.5 w-3.5" />
              Edit saved sheet sizes
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {stockRows.map((row) => {
            const forTh = filterCatalogForThickness(purchasedCatalog, row.thicknessMm);

            function updateSheets(next: QuoteSheetStockLine[]) {
              onSheetsChange(row.thicknessMm, next);
            }

            function addFromCatalog(c: PurchasedSheetSize) {
              updateSheets([
                ...row.sheets,
                {
                  id: nanoid(),
                  sheetLengthMm: c.lengthMm,
                  sheetWidthMm: c.widthMm,
                  catalogId: c.id,
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
                    ? { ...s, ...patch, catalogId: undefined }
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

            return (
              <Card key={row.thicknessMm} className="border-border shadow-sm">
                <CardHeader className="border-b border-border bg-muted/20 py-3">
                  <CardTitle className="text-base">{row.thicknessMm} mm plate</CardTitle>
                  <CardDescription>
                    Saved sizes use your catalog ({unitSystem} labels). Manual rows appear
                    only after you choose Add sheet manually.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 grid gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground font-normal">
                      Saved sizes
                    </Label>
                    {forTh.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {forTh.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => addFromCatalog(c)}
                            className={cn(
                              badgeVariants({ variant: "outline" }),
                              "h-auto min-h-8 cursor-pointer gap-1.5 py-1.5 pl-2.5 pr-2 font-normal hover:bg-muted/80 text-left"
                            )}
                          >
                            <span className="max-w-[220px] leading-snug">
                              {catalogLabel(c, formatLengthValue)}
                            </span>
                            <Plus
                              className="h-3.5 w-3.5 shrink-0 opacity-70"
                              aria-hidden
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border px-3 py-2">
                        No saved sizes for this thickness — use{" "}
                        <span className="font-medium text-foreground">
                          Add sheet manually
                        </span>{" "}
                        or define sizes under{" "}
                        <Link href="/settings" className="underline underline-offset-2">
                          Preferences
                        </Link>
                        .
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground font-normal">
                      Sheets in this quote
                    </Label>
                    {row.sheets.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        None yet — tap a saved size above or add manually.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {row.sheets.map((line) =>
                          line.catalogId ? (
                            <div
                              key={line.id}
                              className={cn(
                                badgeVariants({ variant: "secondary" }),
                                "inline-flex w-fit max-w-full items-center gap-1 pl-3 pr-1 py-1 h-auto font-normal"
                              )}
                            >
                              <span className="text-left leading-snug pr-1">
                                {lineLabelFromCatalog(
                                  line,
                                  purchasedCatalog,
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
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1.5"
                    onClick={addManual}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add sheet manually
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
