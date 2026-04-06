"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLengthValueOnly } from "@/lib/settings/unitSystem";
import type { UnitSystem } from "@/types/settings";
import type { CuttingProfileRange } from "@/types/production";
import { formatCuttingProfileRangeLabel } from "@/lib/nesting/resolvedCuttingRules";

function rotationSummary(r: CuttingProfileRange): string {
  return r.rotationMode === "free" ? "Free rotation" : "90° only";
}

function markingSummary(r: CuttingProfileRange): string {
  return r.defaultIncludeClientCode
    ? "Part number · Client name"
    : "Part number";
}

interface CuttingProfileRangeTableProps {
  ranges: CuttingProfileRange[];
  unitSystem: UnitSystem;
  onEdit: (r: CuttingProfileRange) => void;
  onDelete: (r: CuttingProfileRange) => void;
}

export function CuttingProfileRangeTable({
  ranges,
  unitSystem,
  onEdit,
  onDelete,
}: CuttingProfileRangeTableProps) {
  const lenUnitShort = unitSystem === "metric" ? "mm" : "in";

  if (ranges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center rounded-lg border border-dashed border-border bg-muted/15">
        No thickness ranges yet. Add a rule to define defaults for this cutting method.
      </p>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="text-xs font-semibold h-10 w-[140px]">
              Thickness range
            </TableHead>
            <TableHead className="text-xs font-semibold h-10">
              Spacing ({lenUnitShort})
            </TableHead>
            <TableHead className="text-xs font-semibold h-10">
              Edge ({lenUnitShort})
            </TableHead>
            <TableHead className="text-xs font-semibold h-10">Rotation</TableHead>
            <TableHead className="text-xs font-semibold h-10">Marking</TableHead>
            <TableHead className="text-xs font-semibold h-10 w-[88px] text-right pr-3">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranges.map((r) => (
            <TableRow key={r.id} className="hover:bg-muted/30">
              <TableCell
                className={
                  r.maxThicknessMm === null && r.minThicknessMm <= 1
                    ? "text-sm text-foreground"
                    : "font-mono text-sm tabular-nums"
                }
              >
                {formatCuttingProfileRangeLabel(r, unitSystem)}
              </TableCell>
              <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                {formatLengthValueOnly(r.defaultSpacingMm, unitSystem)}
              </TableCell>
              <TableCell className="font-mono text-sm tabular-nums text-muted-foreground">
                {formatLengthValueOnly(r.defaultEdgeMarginMm, unitSystem)}
              </TableCell>
              <TableCell className="text-sm">{rotationSummary(r)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {markingSummary(r)}
              </TableCell>
              <TableCell className="text-right pr-2">
                <div className="flex justify-end items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(r)}
                    aria-label="Edit rule"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(r)}
                    aria-label="Delete rule"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
