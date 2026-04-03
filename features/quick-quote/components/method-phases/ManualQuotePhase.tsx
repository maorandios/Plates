"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMaterialConfig } from "@/lib/settings/materialConfig";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { nanoid } from "@/lib/utils/nanoid";
import { cn } from "@/lib/utils";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/types/materials";
import {
  DEFAULT_PLATE_FINISH,
  PLATE_FINISH_OPTIONS,
  defaultMaterialGradeForFamily,
} from "../../lib/plateFields";
import type { PlateFinish } from "../../lib/plateFields";
import type { ManualQuotePartRow } from "../../types/quickQuote";
import {
  computeManualQuoteMetrics,
  getManualQuoteValidationLines,
  getManualRowValidationIssues,
  manualRowLineAreaM2,
  manualRowLineWeightKg,
} from "../../lib/manualQuoteParts";
import { MethodPhaseMetricStrip } from "./MethodPhaseMetricStrip";

interface ManualQuotePhaseProps {
  materialType: MaterialType;
  rows: ManualQuotePartRow[];
  onRowsChange: (rows: ManualQuotePartRow[]) => void;
  /** Return to the quote method step (e.g. step back in the wizard). */
  onBack: () => void;
  /** Called when the user completes this phase and validation passes — e.g. return to quote methods. */
  onComplete: () => void;
}

/** Fills content area below stepper (parent must be flex with min-h-0). */
const MANUAL_PHASE_VIEWPORT =
  "flex h-full min-h-0 max-h-full flex-col overflow-hidden";

function createRow(materialType: MaterialType): ManualQuotePartRow {
  return {
    id: nanoid(),
    partNumber: "",
    thicknessMm: 0,
    widthMm: 0,
    lengthMm: 0,
    quantity: 0,
    material: defaultMaterialGradeForFamily(materialType),
    finish: DEFAULT_PLATE_FINISH,
    sourceMethod: "manualAdd",
    clientPartLabel: "",
  };
}

export function ManualQuotePhase({
  materialType,
  rows,
  onRowsChange,
  onBack,
  onComplete,
}: ManualQuotePhaseProps) {
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationLines, setValidationLines] = useState<string[]>([]);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);

  const materialConfig = useMemo(() => getMaterialConfig(materialType), [materialType]);
  const plateTypeLabel = MATERIAL_TYPE_LABELS[materialType];

  const metrics = useMemo(
    () => computeManualQuoteMetrics(rows, materialConfig.densityKgPerM3),
    [rows, materialConfig.densityKgPerM3]
  );

  function patchRow(id: string, patch: Partial<ManualQuotePartRow>) {
    onRowsChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    onRowsChange([...rows, createRow(materialType)]);
  }

  function removeRow(id: string) {
    const next = rows.filter((r) => r.id !== id);
    onRowsChange(next);
  }

  function handleBackClick() {
    if (rows.length === 0) {
      onBack();
      return;
    }
    const incomplete = getManualQuoteValidationLines(rows);
    if (incomplete) {
      setBackConfirmOpen(true);
      return;
    }
    onBack();
  }

  function confirmBackAndDropIncomplete() {
    const validOnly = rows.filter((r) => getManualRowValidationIssues(r).length === 0);
    onRowsChange(validOnly);
    setBackConfirmOpen(false);
    onBack();
  }

  function handleCompleteClick() {
    if (rows.length === 0) {
      setValidationLines(["Add at least one line item before completing."]);
      setValidationDialogOpen(true);
      return;
    }
    const lines = getManualQuoteValidationLines(rows);
    if (lines) {
      setValidationLines(lines);
      setValidationDialogOpen(true);
      return;
    }
    onComplete();
  }

  return (
    <div
      className={cn(
        "flex w-full max-w-[1800px] mx-auto flex-col gap-0 overflow-hidden",
        MANUAL_PHASE_VIEWPORT
      )}
    >
      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden">
        <aside className="flex h-full min-h-0 w-full max-w-[min(420px,42vw)] shrink-0 flex-col border-r border-border/80">
          <div className="shrink-0 space-y-2 px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-snug">
              Manually add parts
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enter line items in millimeters. Plate names are assigned when you merge sources into
              one quote table.
            </p>
            <p className="text-xs text-muted-foreground pt-1">
              Plate type from General:{" "}
              <span className="font-medium text-foreground">{plateTypeLabel}</span>
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col divide-y divide-border/70">
            <MethodPhaseMetricStrip
              label="Quantity"
              value={formatInteger(metrics.totalQty)}
              sub="Sum of line quantities"
            />
            <MethodPhaseMetricStrip
              label="Area (m²)"
              value={formatDecimal(metrics.totalAreaM2, 2)}
              sub="Width × length × qty"
            />
            <MethodPhaseMetricStrip
              label="Weight (kg)"
              value={formatDecimal(metrics.totalWeightKg, 1)}
              sub="Thickness × area × density (General)"
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="shrink-0 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">Line items</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Add parts as needed. Only this panel scrolls when the list grows.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="gap-2"
                  onClick={handleBackClick}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  size="default"
                  className="gap-2"
                  onClick={handleCompleteClick}
                >
                  <Check className="h-4 w-4" />
                  Complete
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-4 sm:p-5">
              {rows.length === 0 ? (
                <div
                  className="flex min-h-[min(320px,50vh)] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12"
                >
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    No parts yet. Add a line to enter thickness, width, length, and quantity.
                  </p>
                  <Button type="button" size="default" className="gap-2" onClick={addRow}>
                    <Plus className="h-4 w-4" />
                    Add new Part
                  </Button>
                </div>
              ) : (
                <>
              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-semibold w-12 text-center">#</TableHead>
                      <TableHead className="text-xs font-semibold w-[110px]">
                        Thickness (mm)
                      </TableHead>
                      <TableHead className="text-xs font-semibold w-[120px]">Width (mm)</TableHead>
                      <TableHead className="text-xs font-semibold w-[120px]">Length (mm)</TableHead>
                      <TableHead className="text-xs font-semibold w-[100px]">Quantity</TableHead>
                      <TableHead className="text-xs font-semibold w-[110px] text-right">
                        Area (m²)
                      </TableHead>
                      <TableHead className="text-xs font-semibold w-[110px] text-right">
                        Weight (kg)
                      </TableHead>
                      <TableHead className="text-xs font-semibold min-w-[140px]">
                        Material grade
                      </TableHead>
                      <TableHead className="text-xs font-semibold min-w-[120px]">Finish</TableHead>
                      <TableHead className="text-xs font-semibold w-[100px] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="py-2 align-middle text-center text-muted-foreground text-sm tabular-nums">
                          {index + 1}
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          <Input
                            type="number"
                            min={0.1}
                            step={0.01}
                            className="h-9 font-mono tabular-nums text-sm w-[100px]"
                            value={row.thicknessMm > 0 ? row.thicknessMm : ""}
                            onChange={(e) =>
                              patchRow(row.id, {
                                thicknessMm: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            placeholder="0"
                            aria-label="Thickness mm"
                          />
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className="h-9 font-mono tabular-nums text-sm"
                            value={row.widthMm > 0 ? row.widthMm : ""}
                            onChange={(e) =>
                              patchRow(row.id, { widthMm: Number(e.target.value) })
                            }
                            placeholder="0"
                            aria-label="Width mm"
                          />
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className="h-9 font-mono tabular-nums text-sm"
                            value={row.lengthMm > 0 ? row.lengthMm : ""}
                            onChange={(e) =>
                              patchRow(row.id, { lengthMm: Number(e.target.value) })
                            }
                            placeholder="0"
                            aria-label="Length mm"
                          />
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className="h-9 font-mono tabular-nums text-sm w-[88px]"
                            value={row.quantity > 0 ? row.quantity : ""}
                            onChange={(e) =>
                              patchRow(row.id, {
                                quantity: Math.max(0, Math.floor(Number(e.target.value))),
                              })
                            }
                            placeholder="0"
                            aria-label="Quantity"
                          />
                        </TableCell>
                        <TableCell className="py-2 align-middle text-right font-mono tabular-nums text-sm text-muted-foreground">
                          {formatDecimal(manualRowLineAreaM2(row), 3)}
                        </TableCell>
                        <TableCell className="py-2 align-middle text-right font-mono tabular-nums text-sm text-muted-foreground">
                          {formatDecimal(
                            manualRowLineWeightKg(row, materialConfig.densityKgPerM3),
                            2
                          )}
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          <Input
                            className="h-9 text-sm"
                            value={row.material}
                            onChange={(e) =>
                              patchRow(row.id, { material: e.target.value })
                            }
                            placeholder="e.g. S235"
                            aria-label="Material grade"
                          />
                        </TableCell>
                        <TableCell className="py-2 align-middle">
                          <Select
                            value={row.finish}
                            onValueChange={(v) =>
                              patchRow(row.id, { finish: v as PlateFinish })
                            }
                          >
                            <SelectTrigger className="h-9 w-full min-w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PLATE_FINISH_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-2 text-right pr-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            aria-label="Remove row"
                            onClick={() => removeRow(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={addRow}
              >
                <Plus className="h-4 w-4" />
                Add new Part
              </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete line items first</DialogTitle>
            <DialogDescription>
              Fix the following before you can complete this step.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
            {validationLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" onClick={() => setValidationDialogOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={backConfirmOpen} onOpenChange={setBackConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard incomplete line items?</DialogTitle>
            <DialogDescription>
              Some rows are still incomplete. Going back will remove those line items. Complete rows
              are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setBackConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="default" onClick={confirmBackAndDropIncomplete}>
              Remove incomplete and go back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
