"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptimisticCheckbox } from "@/components/ui/optimistic-checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import type { BendPlateQuoteItem, BendTemplateId } from "./types";

const BP = "quote.bendPlatePhase";

function templateLabel(id: BendTemplateId): string {
  return t(`${BP}.template.${id}.name`);
}

/** Hub / labels: legacy PlateFinish codes → i18n; settings Hebrew strings pass through. */
function bendPlateFinishDisplay(finish: string): string {
  if (finish === "carbon" || finish === "galvanized" || finish === "paint") {
    return t(`quote.finishLabels.${finish}`);
  }
  return finish;
}

export interface BendPlateLineItemsTableProps {
  quoteItems: BendPlateQuoteItem[];
  onEdit: (item: BendPlateQuoteItem) => void;
  onUpdateItem: (item: BendPlateQuoteItem) => void;
  onRemove: (id: string) => void;
  /** Optional class on the scroll wrapper (max-height, etc.). */
  className?: string;
}

export function BendPlateLineItemsTable({
  quoteItems,
  onEdit,
  onUpdateItem,
  onRemove,
  className,
}: BendPlateLineItemsTableProps) {
  if (quoteItems.length === 0) return null;

  return (
    <div
      className={cn(
        "max-h-[min(70vh,800px)] overflow-auto rounded-md border border-border bg-card",
        className
      )}
      dir="rtl"
    >
      <Table
        className="border-separate border-spacing-0"
        containerClassName="overflow-visible"
      >
        <TableHeader className="sticky top-0 z-30 isolate border-b border-border bg-card shadow-[0_1px_0_0_hsl(var(--border))] [&_th]:bg-card [&_tr]:border-b-0">
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead
              className={cn(
                "min-w-[3.5rem] sticky top-0 right-0 z-40 bg-card py-2 pe-3 ps-3 text-center text-xs font-medium border-e border-border"
              )}
            >
              {t(`${BP}.colIndex`)}
            </TableHead>
            <TableHead className="min-w-[72px] py-2 pe-3 ps-3 text-xs font-medium">
              {t(`${BP}.colShape`)}
            </TableHead>
            <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
              {t(`${BP}.colThickness`)}
            </TableHead>
            <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
              {t(`${BP}.colWidth`)}
            </TableHead>
            <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
              {t(`${BP}.colLength`)}
            </TableHead>
            <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
              {t(`${BP}.colQuantity`)}
            </TableHead>
            <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
              {t(`${BP}.colArea`)}
            </TableHead>
            <TableHead className="min-w-[88px] py-2 pe-3 ps-3 text-xs font-medium">
              {t(`${BP}.colWeight`)}
            </TableHead>
            <TableHead className="min-w-[120px] py-2 pe-3 ps-3 text-xs font-medium">
              {t(`${BP}.colMaterial`)}
            </TableHead>
            <TableHead className="min-w-[100px] py-2 pe-3 ps-3 text-xs font-medium">
              {t(`${BP}.colFinish`)}
            </TableHead>
            <TableHead className="min-w-[5rem] py-2 pe-3 ps-3 text-center text-xs font-medium">
              {t(`${BP}.colCorrugated`)}
            </TableHead>
            <TableHead className="min-w-[4.5rem] py-2 pe-3 ps-3 text-center text-xs font-medium">
              {t(`${BP}.colEdit`)}
            </TableHead>
            <TableHead className="min-w-[4.5rem] py-2 pe-3 ps-3 text-center text-xs font-medium">
              {t(`${BP}.colDelete`)}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quoteItems.map((it, index) => {
            const q = Math.max(0, Math.floor(it.global.quantity) || 0);
            const lineArea = it.calc.areaM2 * q;
            return (
              <TableRow key={it.id} className="group/row">
                <TableCell
                  className={cn(
                    "sticky right-0 z-20 bg-card py-2 pe-3 ps-3 text-center text-sm tabular-nums text-muted-foreground border-e border-border",
                    "group-hover/row:bg-white/[0.04]"
                  )}
                >
                  {index + 1}
                </TableCell>
                <TableCell className="py-2 pe-3 ps-3 text-sm font-medium tabular-nums">
                  {templateLabel(it.template)}
                </TableCell>
                <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                  {formatDecimal(it.global.thicknessMm, 2)}
                </TableCell>
                <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                  {formatDecimal(it.calc.blankWidthMm, 1)}
                </TableCell>
                <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                  {formatDecimal(it.calc.blankLengthMm, 1)}
                </TableCell>
                <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                  {formatInteger(q)}
                </TableCell>
                <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                  {formatDecimal(lineArea, 3)}
                </TableCell>
                <TableCell className="py-2 pe-3 ps-3 text-sm tabular-nums">
                  {formatDecimal(it.calc.weightKg, 2)}
                </TableCell>
                <TableCell className="py-2 pe-3 ps-3 text-sm text-muted-foreground max-w-[180px] truncate">
                  {it.global.material || "—"}
                </TableCell>
                <TableCell className="py-2 pe-3 ps-3 text-sm text-muted-foreground whitespace-nowrap">
                  {bendPlateFinishDisplay(it.global.finish)}
                </TableCell>
                <TableCell className="py-2 pe-2 ps-2">
                  <div className="flex justify-center">
                    <OptimisticCheckbox
                      checked={it.global.corrugated === true}
                      aria-label={t(`${BP}.ariaCorrugatedRow`, {
                        index: index + 1,
                      })}
                      onCheckedChange={(v) =>
                        onUpdateItem({
                          ...it,
                          global: { ...it.global, corrugated: v },
                        })
                      }
                    />
                  </div>
                </TableCell>
                <TableCell className="py-2 pe-2 ps-2">
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t(`${BP}.editRowAria`)}
                      onClick={() => onEdit(it)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="py-2 pe-2 ps-2">
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={t(`${BP}.deleteRowAria`)}
                      onClick={() => onRemove(it.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
