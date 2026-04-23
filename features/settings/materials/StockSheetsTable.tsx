"use client";

import { useState } from "react";
import { Check, Edit2, Plus, Trash2, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { t } from "@/lib/i18n";
import type { MaterialConfig, MaterialStockSheet } from "@/types/materials";
import { nanoid } from "@/lib/utils/nanoid";

const SK = "settings.materials" as const;

/** Order-independent key so 1000×2000 matches 2000×1000. */
function sheetDimsKey(widthMm: number, lengthMm: number): string {
  const a = Math.min(widthMm, lengthMm);
  const b = Math.max(widthMm, lengthMm);
  return `${Math.round(a * 1000) / 1000}x${Math.round(b * 1000) / 1000}`;
}

function hasDuplicateDims(
  sheets: MaterialStockSheet[],
  widthMm: number,
  lengthMm: number,
  excludeId?: string
): boolean {
  const k = sheetDimsKey(widthMm, lengthMm);
  return sheets.some(
    (s) => s.id !== excludeId && sheetDimsKey(s.widthMm, s.lengthMm) === k
  );
}

interface StockSheetsTableProps {
  config: MaterialConfig;
  onUpdate: (patch: Partial<MaterialConfig>) => void;
}

/** Inline create (new row at bottom) or edit (replace the row in place). */
interface InlineEditState {
  id: string;
  width: string;
  length: string;
  mode: "create" | "edit";
}

type StockSheetsDialogState =
  | null
  | { type: "alert"; message: string; titleKey: string }
  | { type: "delete"; sheetId: string };

export function StockSheetsTable({ config, onUpdate }: StockSheetsTableProps) {
  const { formatLengthValue, formatAreaValue, parseLengthInputToMm } = useAppPreferences();
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [dialog, setDialog] = useState<StockSheetsDialogState>(null);

  const tableBusy = !!inlineEdit;

  function handleStartAdd() {
    setInlineEdit({ id: nanoid(), width: "", length: "", mode: "create" });
  }

  function handleCancelInline() {
    setInlineEdit(null);
  }

  function openAlert(message: string, titleKey: string = `${SK}.alertDialogTitle`) {
    setDialog({ type: "alert", message, titleKey });
  }

  function handleCommitInline() {
    if (!inlineEdit) return;
    const widthMm = parseLengthInputToMm(inlineEdit.width);
    const lengthMm = parseLengthInputToMm(inlineEdit.length);

    if (widthMm == null || !Number.isFinite(widthMm) || widthMm <= 0) {
      openAlert(t(`${SK}.widthInvalid`));
      return;
    }
    if (lengthMm == null || !Number.isFinite(lengthMm) || lengthMm <= 0) {
      openAlert(t(`${SK}.lengthInvalid`));
      return;
    }

    if (inlineEdit.mode === "create") {
      if (hasDuplicateDims(config.stockSheets, widthMm, lengthMm)) {
        openAlert(t(`${SK}.duplicateSheetDims`), `${SK}.duplicateStockDialogTitle`);
        return;
      }
      const now = new Date().toISOString();
      const newSheet: MaterialStockSheet = {
        id: inlineEdit.id,
        widthMm,
        lengthMm,
        enabled: true,
        updatedAt: now,
      };
      onUpdate({ stockSheets: [...config.stockSheets, newSheet] });
    } else {
      if (hasDuplicateDims(config.stockSheets, widthMm, lengthMm, inlineEdit.id)) {
        openAlert(t(`${SK}.duplicateSheetDims`), `${SK}.duplicateStockDialogTitle`);
        return;
      }
      onUpdate({
        stockSheets: config.stockSheets.map((s) =>
          s.id === inlineEdit.id
            ? {
                ...s,
                widthMm,
                lengthMm,
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      });
    }
    setInlineEdit(null);
  }

  function handleEdit(sheet: MaterialStockSheet) {
    setInlineEdit({
      id: sheet.id,
      width: formatLengthValue(sheet.widthMm),
      length: formatLengthValue(sheet.lengthMm),
      mode: "edit",
    });
  }

  function handleDelete(sheetId: string) {
    setDialog({ type: "delete", sheetId });
  }

  function handleConfirmDelete() {
    if (dialog?.type !== "delete") return;
    const sheetId = dialog.sheetId;
    onUpdate({
      stockSheets: config.stockSheets.filter((s) => s.id !== sheetId),
    });
    setDialog(null);
  }

  const sorted = [...config.stockSheets].sort((a, b) => {
    const areaA = a.widthMm * a.lengthMm;
    const areaB = b.widthMm * b.lengthMm;
    return areaB - areaA;
  });

  const inlinePreviewArea = (() => {
    if (!inlineEdit) return "—";
    const w = parseLengthInputToMm(inlineEdit.width);
    const l = parseLengthInputToMm(inlineEdit.length);
    if (w != null && l != null && Number.isFinite(w) && Number.isFinite(l) && w > 0 && l > 0) {
      return formatAreaValue((w * l) / 1_000_000);
    }
    return "—";
  })();

  const showEmptyMessage = sorted.length === 0 && !inlineEdit;

  function renderInlineSheetRowCells(autoFocusWidth: boolean) {
    if (!inlineEdit) return null;
    return (
      <>
        <TableCell className="align-middle">
          <Input
            value={inlineEdit.width}
            onChange={(e) =>
              setInlineEdit((d) => (d ? { ...d, width: e.target.value } : d))
            }
            dir="ltr"
            className="h-9 text-end tabular-nums"
            aria-label={t(`${SK}.colWidth`)}
            autoFocus={autoFocusWidth}
          />
        </TableCell>
        <TableCell className="align-middle">
          <Input
            value={inlineEdit.length}
            onChange={(e) =>
              setInlineEdit((d) => (d ? { ...d, length: e.target.value } : d))
            }
            dir="ltr"
            className="h-9 text-end tabular-nums"
            aria-label={t(`${SK}.colLength`)}
          />
        </TableCell>
        <TableCell
          className="whitespace-nowrap text-right text-sm tabular-nums text-muted-foreground"
          dir="ltr"
        >
          {inlinePreviewArea}
        </TableCell>
        <TableCell className="text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCommitInline}
            className="h-8 w-8 p-0 text-primary"
            aria-label={t(`${SK}.save`)}
          >
            <Check className="h-4 w-4" />
          </Button>
        </TableCell>
        <TableCell className="text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancelInline}
            className="h-8 w-8 p-0"
            aria-label={t(`${SK}.cancel`)}
          >
            <X className="h-4 w-4" />
          </Button>
        </TableCell>
      </>
    );
  }

  return (
    <>
      <Card dir="rtl" className="shadow-none">
        <CardHeader className="space-y-0 text-start">
          <div className="space-y-1.5">
            <CardTitle className="text-base">{t(`${SK}.stockSheetsTitle`)}</CardTitle>
            <CardDescription className="leading-relaxed">
              {t(`${SK}.stockSheetsDescription`)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="overflow-x-auto rounded-md">
            <Table dir="rtl" className="table-fixed min-w-[32rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[24%] text-right font-medium">
                    {t(`${SK}.colWidth`)}
                  </TableHead>
                  <TableHead className="w-[24%] text-right font-medium">
                    {t(`${SK}.colLength`)}
                  </TableHead>
                  <TableHead className="w-[22%] text-right font-medium">
                    {t(`${SK}.colArea`)}
                  </TableHead>
                  <TableHead className="w-[15%] text-center font-medium">
                    {t(`${SK}.colEdit`)}
                  </TableHead>
                  <TableHead className="w-[15%] text-center font-medium">
                    {t(`${SK}.colDelete`)}
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
                      {t(`${SK}.emptyStock`)}
                    </TableCell>
                  </TableRow>
                )}
                {sorted.map((sheet) => {
                  if (inlineEdit?.mode === "edit" && inlineEdit.id === sheet.id) {
                    return (
                      <TableRow key={sheet.id}>
                        {renderInlineSheetRowCells(true)}
                      </TableRow>
                    );
                  }

                  const areaM2 = (sheet.widthMm * sheet.lengthMm) / 1_000_000;
                  return (
                    <TableRow key={sheet.id}>
                      <TableCell
                        className="whitespace-nowrap text-right font-medium tabular-nums"
                        dir="ltr"
                      >
                        {formatLengthValue(sheet.widthMm)}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap text-right font-medium tabular-nums"
                        dir="ltr"
                      >
                        {formatLengthValue(sheet.lengthMm)}
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
                          onClick={() => handleEdit(sheet)}
                          disabled={tableBusy}
                          className="h-8 w-8 p-0"
                          aria-label={t(`${SK}.editSheetAria`)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sheet.id)}
                          disabled={tableBusy}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          aria-label={t(`${SK}.deleteSheetAria`)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {inlineEdit?.mode === "create" && (
                  <TableRow key={inlineEdit.id}>
                    {renderInlineSheetRowCells(true)}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-start" dir="rtl">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 bg-card/30 hover:bg-card/50"
              onClick={handleStartAdd}
              disabled={tableBusy}
            >
              <Plus className="h-4 w-4" />
              {t(`${SK}.addSheet`)}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent
          dir="rtl"
          showCloseButton={false}
          className="max-w-md border-border text-start sm:text-start"
        >
          {dialog?.type === "alert" && (
            <>
              <DialogHeader className="text-start sm:text-start">
                <DialogTitle>{t(dialog.titleKey)}</DialogTitle>
                <DialogDescription className="text-start text-sm leading-relaxed">
                  {dialog.message}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:justify-start">
                <Button type="button" onClick={() => setDialog(null)}>
                  {t(`${SK}.alertDialogOk`)}
                </Button>
              </DialogFooter>
            </>
          )}
          {dialog?.type === "delete" && (
            <>
              <DialogHeader className="text-start sm:text-start">
                <DialogTitle>{t(`${SK}.deleteSheetDialogTitle`)}</DialogTitle>
                <DialogDescription className="text-start text-sm leading-relaxed">
                  {t(`${SK}.deleteSheetConfirm`)}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex w-full flex-row flex-wrap items-center gap-2">
                <Button type="button" variant="destructive" onClick={handleConfirmDelete}>
                  {t(`${SK}.deleteSheetDialogDelete`)}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialog(null)}>
                  {t("common.cancel")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
