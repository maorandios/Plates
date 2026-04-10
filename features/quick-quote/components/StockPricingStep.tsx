"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { badgeVariants } from "@/components/ui/badge";
import { getPurchasedSheetSizes } from "@/lib/store";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { nanoid } from "@/lib/utils/nanoid";
import { formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import {
  MATERIAL_TYPE_LABELS,
  type MaterialConfig,
  type MaterialType,
} from "@/types/materials";
import type { PurchasedSheetSize } from "@/types/settings";
import type { QuoteSheetStockLine, ThicknessStockInput } from "../types/quickQuote";
import { hasDuplicateSheetSizes } from "../lib/quoteStockAvailability";

const SP = "quote.stockMaterialPhase" as const;

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
  formatLengthValue: (mm: number) => string,
  settingsSuffix: string
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
      return `${w} × ${l} · ${settingsSuffix}`;
    }
  }
  return `${formatInteger(line.sheetLengthMm)} × ${formatInteger(line.sheetWidthMm)} ${t(`${SP}.unitMm`)}`;
}

interface StockPricingStepProps {
  stockRows: ThicknessStockInput[];
  materialType: MaterialType;
  onSheetsChange: (thicknessMm: number, sheets: QuoteSheetStockLine[]) => void;
}

export function StockPricingStep({
  stockRows,
  materialType,
  onSheetsChange,
}: StockPricingStepProps) {
  const { formatLengthValue } = useAppPreferences();

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
  const settingsSuffix = t(`${SP}.fromSettingsSuffix`);

  return (
    <div className="space-y-8" dir="rtl">
      <div className="w-full text-start">
        <h1 className="text-2xl font-semibold tracking-tight">{t(`${SP}.title`)}</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base leading-relaxed">
          {t(`${SP}.subtitle`, { material: materialLabel })}
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground text-start">
          {t(`${SP}.stockByThickness`)}
        </h2>

        <div className="flex flex-col gap-2">
          {stockRows.map((row, index) => {
            function updateSheets(next: QuoteSheetStockLine[]) {
              onSheetsChange(row.thicknessMm, next);
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
            const lineCount = row.sheets.length;

            return (
              <details
                key={row.thicknessMm}
                className="border-0 rounded-xl bg-card overflow-hidden open:shadow-sm"
                open={index === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 bg-muted/25 hover:bg-muted/40 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 text-start">
                    {t(`${SP}.thicknessHeader`, {
                      mm: formatInteger(Math.round(row.thicknessMm)),
                    })}
                    <span className="font-normal text-muted-foreground ms-2">
                      {lineCount === 1
                        ? t(`${SP}.sheetCountOne`)
                        : t(`${SP}.sheetCountMany`, { n: lineCount })}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
                </summary>
                <div className="border-t border-white/[0.08] px-4 py-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground font-normal block text-start">
                      {t(`${SP}.sheetSizesLabel`)}
                    </Label>
                    {row.sheets.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic rounded-md border border-dashed border-white/15 px-3 py-2 text-start leading-relaxed">
                        {t(`${SP}.emptySizesHint`)}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {row.sheets.map((line) =>
                          line.catalogId || line.materialSheetId ? (
                            <div
                              key={line.id}
                              className={cn(
                                badgeVariants({ variant: "secondary" }),
                                "inline-flex w-fit max-w-full items-center gap-1 ps-3 pe-1 py-1.5 h-auto font-normal"
                              )}
                            >
                              <span className="text-start leading-snug pe-1">
                                {lineLabelForStockLine(
                                  line,
                                  purchasedCatalog,
                                  materialConfig,
                                  formatLengthValue,
                                  settingsSuffix
                                )}
                              </span>
                              <button
                                type="button"
                                className="rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-background/60 shrink-0"
                                aria-label={t(`${SP}.removeSheetAria`)}
                                onClick={() => removeLine(line.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              key={line.id}
                              className="flex flex-wrap items-end gap-3 gap-y-2 rounded-xl border-0 bg-white/[0.03] p-3"
                            >
                              <div className="space-y-1.5 flex-1 min-w-[120px]">
                                <Label className="text-xs text-muted-foreground font-normal block text-start">
                                  {t(`${SP}.sheetLength`)}
                                </Label>
                                <div className="flex gap-2 items-center">
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    className="h-9 font-mono text-sm"
                                    dir="ltr"
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
                                    {t(`${SP}.unitMm`)}
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1.5 flex-1 min-w-[120px]">
                                <Label className="text-xs text-muted-foreground font-normal block text-start">
                                  {t(`${SP}.sheetWidth`)}
                                </Label>
                                <div className="flex gap-2 items-center">
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    className="h-9 font-mono text-sm"
                                    dir="ltr"
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
                                    {t(`${SP}.unitMm`)}
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                                aria-label={t(`${SP}.removeManualAria`)}
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
                      <p className="text-xs text-destructive text-start leading-relaxed">
                        {t(`${SP}.duplicateWarning`)}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1.5"
                    onClick={addManual}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t(`${SP}.addCustomSheet`)}
                  </Button>
                </div>
              </details>
            );
          })}
        </div>

        {stockRows.length === 0 && (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-white/15 px-4 py-8 text-center leading-relaxed">
            {t(`${SP}.noPartsHint`)}
          </p>
        )}
      </div>
    </div>
  );
}
