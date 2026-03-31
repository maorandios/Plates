"use client";

import { useMemo } from "react";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { computeManualQuoteMetrics, suggestNextPartNumber } from "../../lib/manualQuoteParts";

interface ManualQuotePhaseProps {
  materialType: MaterialType;
  rows: ManualQuotePartRow[];
  onRowsChange: (rows: ManualQuotePartRow[]) => void;
}

function createRow(partNumber: string, materialType: MaterialType): ManualQuotePartRow {
  return {
    id: nanoid(),
    partNumber,
    thicknessMm: 10,
    widthMm: 0,
    lengthMm: 0,
    quantity: 1,
    material: defaultMaterialGradeForFamily(materialType),
    finish: DEFAULT_PLATE_FINISH,
  };
}

export function ManualQuotePhase({
  materialType,
  rows,
  onRowsChange,
}: ManualQuotePhaseProps) {
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
    onRowsChange([
      ...rows,
      createRow(suggestNextPartNumber(rows), materialType),
    ]);
  }

  function removeRow(id: string) {
    if (rows.length <= 1) {
      onRowsChange([createRow("PL01", materialType)]);
      return;
    }
    onRowsChange(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 py-1">
      <div className="space-y-2">
        <div className="flex flex-wrap items-start gap-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
            <ClipboardList className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Manually add parts
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed mt-1">
              Enter each line item. Part numbers default to PL01, PL02… and can be edited. Set
              thickness per row; weight uses row thickness and the material density from General.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMini
          label="Plate type"
          value={plateTypeLabel}
          sub="From General"
        />
        <SummaryMini
          label="Quantity"
          value={formatInteger(metrics.totalQty)}
          sub="Sum of line quantities"
        />
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4 space-y-3">
            <div>
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                Area
              </CardDescription>
              <CardTitle className="text-lg sm:text-xl tabular-nums pt-0.5">
                {formatDecimal(metrics.totalAreaM2, 2)} m²
              </CardTitle>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Width × length × qty
              </p>
            </div>
            <div className="border-t border-border pt-3">
              <CardDescription className="text-xs font-medium uppercase tracking-wide">
                Weight
              </CardDescription>
              <CardTitle className="text-lg sm:text-xl tabular-nums pt-0.5">
                {formatDecimal(metrics.totalWeightKg, 1)} kg
              </CardTitle>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Per-row thickness × area × density
              </p>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border bg-muted/20 py-3">
          <CardTitle className="text-base">Line items</CardTitle>
          <CardDescription>
            Add rows as needed. Dimensions are in millimeters.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-semibold min-w-[140px]">
                    Part number
                  </TableHead>
                  <TableHead className="text-xs font-semibold w-[110px]">
                    Thickness (mm)
                  </TableHead>
                  <TableHead className="text-xs font-semibold w-[120px]">Width (mm)</TableHead>
                  <TableHead className="text-xs font-semibold w-[120px]">Length (mm)</TableHead>
                  <TableHead className="text-xs font-semibold w-[100px]">Quantity</TableHead>
                  <TableHead className="text-xs font-semibold min-w-[140px]">Material</TableHead>
                  <TableHead className="w-[52px] pr-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="py-2 align-middle">
                      <Input
                        className="h-9 font-mono text-sm"
                        value={row.partNumber}
                        onChange={(e) =>
                          patchRow(row.id, { partNumber: e.target.value })
                        }
                        aria-label="Part number"
                      />
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
                        placeholder="10"
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
                        placeholder="1"
                        aria-label="Quantity"
                      />
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
            Add row
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryMini({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={cn("border-border shadow-sm", className)}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-lg sm:text-xl tabular-nums break-words leading-snug">
          {value}
        </CardTitle>
        {sub ? (
          <p className="text-[11px] text-muted-foreground leading-snug pt-0.5">{sub}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}
