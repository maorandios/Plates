"use client";

import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
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

function formatRangeDisplay(
  r: CuttingProfileRange,
  unitSystem: UnitSystem
): string {
  const u = unitSystem === "metric" ? "mm" : "in";
  const a = formatLengthValueOnly(r.minThicknessMm, unitSystem);
  if (r.maxThicknessMm === null) {
    return `${a}+ ${u}`;
  }
  const b = formatLengthValueOnly(r.maxThicknessMm, unitSystem);
  return `${a}–${b} ${u}`;
}

function rotationSummary(r: CuttingProfileRange): string {
  if (!r.allowRotation) return "Off";
  return r.rotationMode === "free" ? "On · Free" : "On · 90°";
}

function markingSummary(r: CuttingProfileRange): string {
  const parts: string[] = [];
  if (r.defaultMarkPartName) parts.push("Part");
  if (r.defaultIncludeClientCode) parts.push("Client");
  return parts.length ? parts.join(" · ") : "—";
}

interface CuttingProfileRangeTableProps {
  ranges: CuttingProfileRange[];
  unitSystem: UnitSystem;
  onEdit: (r: CuttingProfileRange) => void;
  onDelete: (r: CuttingProfileRange) => void;
  onMoveUp: (r: CuttingProfileRange) => void;
  onMoveDown: (r: CuttingProfileRange) => void;
}

export function CuttingProfileRangeTable({
  ranges,
  unitSystem,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
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
    <div className="rounded-lg border border-border overflow-hidden bg-card">
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
            <TableHead className="text-xs font-semibold h-10 w-[120px] text-right pr-3">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ranges.map((r, idx) => (
            <TableRow key={r.id} className="hover:bg-muted/30">
              <TableCell className="font-mono text-sm tabular-nums">
                {formatRangeDisplay(r, unitSystem)}
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
                    disabled={idx === 0}
                    onClick={() => onMoveUp(r)}
                    aria-label="Move rule up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={idx === ranges.length - 1}
                    onClick={() => onMoveDown(r)}
                    aria-label="Move rule down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
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
