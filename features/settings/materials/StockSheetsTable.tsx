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
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import { t } from "@/lib/i18n";
import type { MaterialConfig, MaterialStockSheet } from "@/types/materials";
import { StockSheetForm } from "./StockSheetForm";
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

interface DraftRowState {
  id: string;
  width: string;
  length: string;
}

export function StockSheetsTable({ config, onUpdate }: StockSheetsTableProps) {
  const { formatLengthValue, formatAreaValue, parseLengthInputToMm } = useAppPreferences();
  const [editingSheet, setEditingSheet] = useState<MaterialStockSheet | null>(null);
  const [draftRow, setDraftRow] = useState<DraftRowState | null>(null);

  const tableBusy = !!editingSheet || !!draftRow;

  function handleSaveForm(sheet: MaterialStockSheet) {
    if (
      hasDuplicateDims(config.stockSheets, sheet.widthMm, sheet.lengthMm, sheet.id)
    ) {
      window.alert(t(`${SK}.duplicateSheetDims`));
      return;
    }
    onUpdate({
      stockSheets: config.stockSheets.map((s) => (s.id === sheet.id ? sheet : s)),
    });
    setEditingSheet(null);
  }

  function handleCancelForm() {
    setEditingSheet(null);
  }

  function handleStartAdd() {
    setEditingSheet(null);
    setDraftRow({ id: nanoid(), width: "", length: "" });
  }

  function handleCancelDraft() {
    setDraftRow(null);
  }

  function handleCommitDraft() {
    if (!draftRow) return;
    const widthMm = parseLengthInputToMm(draftRow.width);
    const lengthMm = parseLengthInputToMm(draftRow.length);

    if (widthMm == null || !Number.isFinite(widthMm) || widthMm <= 0) {
      window.alert(t(`${SK}.widthInvalid`));
      return;
    }
    if (lengthMm == null || !Number.isFinite(lengthMm) || lengthMm <= 0) {
      window.alert(t(`${SK}.lengthInvalid`));
      return;
    }

    if (hasDuplicateDims(config.stockSheets, widthMm, lengthMm)) {
      window.alert(t(`${SK}.duplicateSheetDims`));
      return;
    }

    const now = new Date().toISOString();
    const newSheet: MaterialStockSheet = {
      id: draftRow.id,
      widthMm,
      lengthMm,
      enabled: true,
      updatedAt: now,
    };
    onUpdate({ stockSheets: [...config.stockSheets, newSheet] });
    setDraftRow(null);
  }

  function handleEdit(sheet: MaterialStockSheet) {
    setDraftRow(null);
    setEditingSheet(sheet);
  }

  function handleDelete(sheetId: string) {
    if (!confirm(t(`${SK}.deleteSheetConfirm`))) return;
    onUpdate({
      stockSheets: config.stockSheets.filter((s) => s.id !== sheetId),
    });
  }

  const sorted = [...config.stockSheets].sort((a, b) => {
    const areaA = a.widthMm * a.lengthMm;
    const areaB = b.widthMm * b.lengthMm;
    return areaB - areaA;
  });

  const draftPreviewArea = (() => {
    if (!draftRow) return null;
    const w = parseLengthInputToMm(draftRow.width);
    const l = parseLengthInputToMm(draftRow.length);
    if (w != null && l != null && Number.isFinite(w) && Number.isFinite(l) && w > 0 && l > 0) {
      return formatAreaValue((w * l) / 1_000_000);
    }
    return "—";
  })();

  const showEmptyMessage = sorted.length === 0 && !draftRow;

  return (
    <>
      <Card className="shadow-none">
        <CardHeader className="text-start space-y-0">
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
                  const areaM2 = (sheet.widthMm * sheet.lengthMm) / 1_000_000;
                  return (
                    <TableRow key={sheet.id}>
                      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums" dir="ltr">
                        {formatLengthValue(sheet.widthMm)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums" dir="ltr">
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
                        aria-label={t(`${SK}.colWidth`)}
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
                        aria-label={t(`${SK}.colLength`)}
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
                        onClick={handleCancelDraft}
                        className="h-8 w-8 p-0"
                        aria-label={t(`${SK}.cancel`)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
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

      {editingSheet && (
        <StockSheetForm
          sheet={editingSheet}
          isNew={false}
          materialType={config.materialType}
          onSave={handleSaveForm}
          onCancel={handleCancelForm}
        />
      )}
    </>
  );
}
