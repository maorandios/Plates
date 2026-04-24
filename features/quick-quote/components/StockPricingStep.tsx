"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Edit2, Layers, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogFooterActionsStartClassName,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { StockSheetForm } from "@/features/settings/materials/StockSheetForm";
import { nanoid } from "@/lib/utils/nanoid";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { MaterialStockSheet } from "@/types/materials";
import type { MaterialType } from "@/types/materials";
import type { QuotePartRow, QuoteSheetStockLine, ThicknessStockInput } from "../types/quickQuote";
import { hasDuplicateSheetSizes, sheetFootprintKey } from "../lib/quoteStockAvailability";

const SP = "quote.stockMaterialPhase" as const;
const SKM = "settings.materials" as const;

function thicknessKey(mm: number): number {
  return Math.round(mm * 1000) / 1000;
}

function metricsForThickness(parts: QuotePartRow[], thicknessMm: number): {
  areaM2: number;
  weightKg: number;
} {
  const key = thicknessKey(thicknessMm);
  let areaM2 = 0;
  let weightKg = 0;
  for (const p of parts) {
    if (thicknessKey(p.thicknessMm) !== key) continue;
    const q = Math.max(0, Math.floor(p.qty));
    areaM2 += p.areaM2 * q;
    weightKg += p.weightKg * q;
  }
  return { areaM2, weightKg };
}

/** Total part quantity (sum of qty) for this thickness from the phase-3 parts list. */
function partQtySumForThickness(parts: QuotePartRow[], thicknessMm: number): number {
  const key = thicknessKey(thicknessMm);
  let total = 0;
  for (const p of parts) {
    if (thicknessKey(p.thicknessMm) !== key) continue;
    total += Math.max(0, Math.floor(p.qty));
  }
  return total;
}

function normalizeQuoteSheetDims(widthMm: number, lengthMm: number): {
  sheetWidthMm: number;
  sheetLengthMm: number;
} {
  return {
    sheetWidthMm: Math.min(widthMm, lengthMm),
    sheetLengthMm: Math.max(widthMm, lengthMm),
  };
}

function quoteLineToMaterialSheet(line: QuoteSheetStockLine): MaterialStockSheet {
  return {
    id: line.id,
    widthMm: line.sheetWidthMm,
    lengthMm: line.sheetLengthMm,
    enabled: true,
    updatedAt: new Date().toISOString(),
  };
}

function hasDuplicateFootprintForLines(
  sheets: QuoteSheetStockLine[],
  widthMm: number,
  lengthMm: number,
  excludeId?: string
): boolean {
  const { sheetWidthMm, sheetLengthMm } = normalizeQuoteSheetDims(widthMm, lengthMm);
  const k = sheetFootprintKey(sheetWidthMm, sheetLengthMm);
  return sheets.some((s) => {
    if (excludeId && s.id === excludeId) return false;
    if (s.sheetWidthMm <= 0 || s.sheetLengthMm <= 0) return false;
    return sheetFootprintKey(s.sheetWidthMm, s.sheetLengthMm) === k;
  });
}

interface DraftRowState {
  id: string;
  width: string;
  length: string;
}

function ThicknessSheetsPanel({
  sheets,
  materialType,
  onSheetsChange,
}: {
  sheets: QuoteSheetStockLine[];
  materialType: MaterialType;
  onSheetsChange: (next: QuoteSheetStockLine[]) => void;
}) {
  const { formatLengthValue, formatAreaValue, parseLengthInputToMm } = useAppPreferences();
  const [draftRow, setDraftRow] = useState<DraftRowState | null>(null);
  const [editingLine, setEditingLine] = useState<QuoteSheetStockLine | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [inputValidationMessage, setInputValidationMessage] = useState<string | null>(null);

  const tableBusy = !!draftRow || !!editingLine;

  const sorted = useMemo(
    () =>
      [...sheets].sort((a, b) => {
        const areaA = a.sheetWidthMm * a.sheetLengthMm;
        const areaB = b.sheetWidthMm * b.sheetLengthMm;
        return areaB - areaA;
      }),
    [sheets]
  );

  const draftPreviewArea = (() => {
    if (!draftRow) return null;
    const w = parseLengthInputToMm(draftRow.width);
    const l = parseLengthInputToMm(draftRow.length);
    if (w != null && l != null && Number.isFinite(w) && Number.isFinite(l) && w > 0 && l > 0) {
      return formatAreaValue((w * l) / 1_000_000);
    }
    return "—";
  })();

  function handleStartAdd() {
    setEditingLine(null);
    setDraftRow({ id: nanoid(), width: "", length: "" });
  }

  function handleCancelDraft() {
    setDraftRow(null);
  }

  function handleCommitDraft() {
    if (!draftRow) return;
    const w = parseLengthInputToMm(draftRow.width);
    const l = parseLengthInputToMm(draftRow.length);
    if (w == null || !Number.isFinite(w) || w <= 0) {
      setInputValidationMessage(t(`${SKM}.widthInvalid`));
      return;
    }
    if (l == null || !Number.isFinite(l) || l <= 0) {
      setInputValidationMessage(t(`${SKM}.lengthInvalid`));
      return;
    }
    const dims = normalizeQuoteSheetDims(w, l);
    if (hasDuplicateFootprintForLines(sheets, w, l)) {
      setInputValidationMessage(t(`${SKM}.duplicateSheetDims`));
      return;
    }
    onSheetsChange([
      ...sheets,
      {
        id: draftRow.id,
        sheetWidthMm: dims.sheetWidthMm,
        sheetLengthMm: dims.sheetLengthMm,
      },
    ]);
    setDraftRow(null);
  }

  function requestDelete(lineId: string) {
    setDeleteTargetId(lineId);
  }

  function confirmDeleteSheet() {
    if (deleteTargetId == null) return;
    onSheetsChange(sheets.filter((s) => s.id !== deleteTargetId));
    setDeleteTargetId(null);
  }

  function handleEdit(line: QuoteSheetStockLine) {
    setDraftRow(null);
    setEditingLine(line);
  }

  const showEmptyMessage = sorted.length === 0 && !draftRow;
  const dupInRow = hasDuplicateSheetSizes(sheets);

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground font-normal block text-start">
          {t(`${SP}.sheetSizesLabel`)}
        </Label>
        <div className="overflow-x-auto rounded-md border border-border">
          <Table dir="rtl" className="table-fixed min-w-[32rem]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[24%] text-right font-medium">
                  {t(`${SKM}.colWidth`)}
                </TableHead>
                <TableHead className="w-[24%] text-right font-medium">
                  {t(`${SKM}.colLength`)}
                </TableHead>
                <TableHead className="w-[22%] text-right font-medium">
                  {t(`${SKM}.colArea`)}
                </TableHead>
                <TableHead className="w-[15%] text-center font-medium">
                  {t(`${SKM}.colEdit`)}
                </TableHead>
                <TableHead className="w-[15%] text-center font-medium">
                  {t(`${SKM}.colDelete`)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showEmptyMessage && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-sm leading-relaxed text-muted-foreground"
                  >
                    {t(`${SP}.emptySizesHint`)}
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((line) => {
                const areaM2 = (line.sheetWidthMm * line.sheetLengthMm) / 1_000_000;
                return (
                  <TableRow key={line.id}>
                    <TableCell
                      className="whitespace-nowrap text-right font-medium tabular-nums"
                      dir="ltr"
                    >
                      {formatLengthValue(line.sheetWidthMm)}
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-right font-medium tabular-nums"
                      dir="ltr"
                    >
                      {formatLengthValue(line.sheetLengthMm)}
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground"
                      dir="ltr"
                    >
                      {formatAreaValue(areaM2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(line)}
                        disabled={tableBusy}
                        className="h-8 w-8 p-0"
                        aria-label={t(`${SKM}.editSheetAria`)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => requestDelete(line.id)}
                        disabled={tableBusy}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        aria-label={t(`${SKM}.deleteSheetAria`)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {draftRow && (
                <TableRow>
                  <TableCell className="align-middle">
                    <Input
                      value={draftRow.width}
                      onChange={(e) =>
                        setDraftRow((d) => (d ? { ...d, width: e.target.value } : d))
                      }
                      dir="ltr"
                      className="h-9 text-end tabular-nums"
                      aria-label={t(`${SKM}.colWidth`)}
                      autoFocus
                    />
                  </TableCell>
                  <TableCell className="align-middle">
                    <Input
                      value={draftRow.length}
                      onChange={(e) =>
                        setDraftRow((d) => (d ? { ...d, length: e.target.value } : d))
                      }
                      dir="ltr"
                      className="h-9 text-end tabular-nums"
                      aria-label={t(`${SKM}.colLength`)}
                    />
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground"
                    dir="ltr"
                  >
                    {draftPreviewArea}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCommitDraft}
                      className="h-8 w-8 p-0 text-primary"
                      aria-label={t(`${SKM}.save`)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelDraft}
                      className="h-8 w-8 p-0"
                      aria-label={t(`${SKM}.cancel`)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {dupInRow ? (
          <p className="text-xs text-destructive text-start leading-relaxed">
            {t(`${SP}.duplicateWarning`)}
          </p>
        ) : null}

        <div className="flex justify-start pt-1" dir="rtl">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5 bg-card/30 hover:bg-card/50"
            onClick={handleStartAdd}
            disabled={tableBusy}
          >
            <Plus className="h-4 w-4" />
            {t(`${SKM}.addSheet`)}
          </Button>
        </div>
      </div>

      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t(`${SKM}.deleteSheetDialogTitle`)}</DialogTitle>
            <DialogDescription className="text-start text-sm leading-relaxed">
              {t(`${SKM}.deleteSheetConfirm`)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn(dialogFooterActionsStartClassName)}>
            <Button type="button" variant="destructive" onClick={confirmDeleteSheet}>
              {t(`${SKM}.deleteSheetDialogDelete`)}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDeleteTargetId(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inputValidationMessage != null}
        onOpenChange={(open) => {
          if (!open) setInputValidationMessage(null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md" dir="rtl">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t(`${SKM}.alertDialogTitle`)}</DialogTitle>
            <DialogDescription className="text-start text-sm leading-relaxed">
              {inputValidationMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn(dialogFooterActionsStartClassName)}>
            <Button type="button" onClick={() => setInputValidationMessage(null)}>
              {t(`${SKM}.alertDialogOk`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingLine && (
        <StockSheetForm
          sheet={quoteLineToMaterialSheet(editingLine)}
          isNew={false}
          materialType={materialType}
          onSave={(saved) => {
            const dims = normalizeQuoteSheetDims(saved.widthMm, saved.lengthMm);
            if (
              hasDuplicateFootprintForLines(
                sheets,
                saved.widthMm,
                saved.lengthMm,
                editingLine.id
              )
            ) {
              setInputValidationMessage(t(`${SKM}.duplicateSheetDims`));
              return;
            }
            onSheetsChange(
              sheets.map((s) =>
                s.id === saved.id
                  ? {
                      ...s,
                      sheetWidthMm: dims.sheetWidthMm,
                      sheetLengthMm: dims.sheetLengthMm,
                      catalogId: undefined,
                      materialSheetId: undefined,
                    }
                  : s
              )
            );
            setEditingLine(null);
          }}
          onCancel={() => setEditingLine(null)}
        />
      )}
    </>
  );
}

interface StockPricingStepProps {
  stockRows: ThicknessStockInput[];
  parts: QuotePartRow[];
  materialType: MaterialType;
  onSheetsChange: (thicknessMm: number, sheets: QuoteSheetStockLine[]) => void;
}

export function StockPricingStep({
  stockRows,
  parts,
  materialType,
  onSheetsChange,
}: StockPricingStepProps) {
  return (
    <div className="space-y-8" dir="rtl">
      <div className="w-full max-w-4xl mx-auto text-start">
        <h1 className="text-2xl font-semibold tracking-tight">{t(`${SP}.title`)}</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base leading-relaxed">
          {t(`${SP}.subtitle`)}
        </p>
      </div>

      <div className="space-y-3 w-full max-w-4xl mx-auto">
        <div className="flex flex-col gap-3">
          {stockRows.map((row, index) => {
            function updateSheets(next: QuoteSheetStockLine[]) {
              onSheetsChange(row.thicknessMm, next);
            }

            const { areaM2: lineAreaM2, weightKg: lineWeight } = metricsForThickness(
              parts,
              row.thicknessMm
            );
            const partsQtyForThickness = partQtySumForThickness(parts, row.thicknessMm);

            return (
              <details
                key={row.thicknessMm}
                className="group/details rounded-lg border border-border bg-card overflow-hidden open:border-primary/25 open:bg-primary/[0.04]"
                open={index === 0}
              >
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center gap-3 px-4 py-3.5",
                    "[&::-webkit-details-marker]:hidden",
                    "hover:bg-white/[0.03]"
                  )}
                >
                  <div className="flex shrink-0 items-stretch gap-3">
                    <div className="flex items-center">
                      <Layers
                        className="h-5 w-5 text-primary dark:text-primary"
                        aria-hidden
                      />
                    </div>
                    <div
                      className="w-px self-stretch min-h-[2.25rem] bg-white/10"
                      aria-hidden
                    />
                  </div>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                        {t(`${SP}.cardColThickness`)}
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatInteger(Math.round(row.thicknessMm))} {t(`${SP}.unitMm`)}
                      </p>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                        {t(`${SP}.cardColSheetsRequired`)}
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {formatInteger(partsQtyForThickness)}
                      </p>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                        {t(`${SP}.cardColArea`)}
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {lineAreaM2 > 0 ? formatDecimal(lineAreaM2, 4) : "—"}
                      </p>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] font-medium leading-tight text-muted-foreground">
                        {t(`${SP}.cardColWeight`)}
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-foreground">
                        {lineWeight > 0 ? formatDecimal(lineWeight, 2) : "—"}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180"
                    aria-hidden
                  />
                </summary>

                <div className="border-t border-border px-4 py-4 space-y-4 bg-card/40">
                  <ThicknessSheetsPanel
                    sheets={row.sheets}
                    materialType={materialType}
                    onSheetsChange={updateSheets}
                  />
                </div>
              </details>
            );
          })}
        </div>

        {stockRows.length === 0 && (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-8 text-center leading-relaxed max-w-4xl mx-auto">
            {t(`${SP}.noPartsHint`)}
          </p>
        )}
      </div>
    </div>
  );
}
