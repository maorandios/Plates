"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ValidationRow, ValidationRowStatus } from "../types/quickQuote";

type FilterTab = "all" | ValidationRowStatus;

function statusBadge(status: ValidationRowStatus) {
  switch (status) {
    case "valid":
      return (
        <Badge
          variant="outline"
          className="font-medium border-emerald-600/40 bg-emerald-600/10 text-emerald-800 dark:text-emerald-200"
        >
          Valid
        </Badge>
      );
    case "warning":
      return (
        <Badge
          variant="outline"
          className="font-medium border-amber-600/45 bg-amber-500/10 text-amber-900 dark:text-amber-200"
        >
          Warning
        </Badge>
      );
    case "error":
      return (
        <Badge
          variant="outline"
          className="font-medium border-destructive/50 bg-destructive/10 text-destructive"
        >
          Error
        </Badge>
      );
  }
}

interface ValidationTableProps {
  rows: ValidationRow[];
  onRowOpen: (row: ValidationRow) => void;
}

export function ValidationTable({ rows, onRowOpen }: ValidationTableProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [mismatchesOnly, setMismatchesOnly] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (mismatchesOnly && r.status === "valid") return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.partName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search, mismatchesOnly]);

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "valid", label: "Valid" },
    { id: "warning", label: "Warnings" },
    { id: "error", label: "Errors" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button
              key={t.id}
              type="button"
              size="sm"
              variant={filter === t.id ? "default" : "outline"}
              className="h-8"
              onClick={() => setFilter(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search part name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              id="qq-mismatch-only"
              checked={mismatchesOnly}
              onCheckedChange={setMismatchesOnly}
            />
            <Label htmlFor="qq-mismatch-only" className="text-sm cursor-pointer">
              Show only mismatches
            </Label>
          </div>
        </div>
      </div>

      <ScrollArea className="w-full max-h-[min(560px,70vh)] rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/55 hover:bg-muted/55 border-b border-border">
              <TableHead
                colSpan={2}
                className="sticky left-0 z-20 min-w-[140px] bg-muted/55 text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/80"
              >
                General
              </TableHead>
              <TableHead
                colSpan={2}
                className="text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/60"
              >
                Length
              </TableHead>
              <TableHead
                colSpan={2}
                className="text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/60"
              >
                Width
              </TableHead>
              <TableHead
                colSpan={2}
                className="text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/60"
              >
                Area
              </TableHead>
              <TableHead
                colSpan={2}
                className="text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/60"
              >
                Weight
              </TableHead>
              <TableHead
                colSpan={2}
                className="text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/60"
              >
                Material
              </TableHead>
              <TableHead className="text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/60 min-w-[88px]">
                Status
              </TableHead>
              <TableHead className="w-[100px] bg-muted/55" aria-hidden />
            </TableRow>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
              <TableHead className="min-w-[100px] sticky left-0 bg-muted/40 z-10 border-r border-border/80">
                Part name
              </TableHead>
              <TableHead className="text-right border-r border-border/40">Qty</TableHead>
              <TableHead className="text-right">Excel L</TableHead>
              <TableHead className="text-right border-r border-border/40">DXF L</TableHead>
              <TableHead className="text-right">Excel W</TableHead>
              <TableHead className="text-right border-r border-border/40">DXF W</TableHead>
              <TableHead className="text-right">Excel area</TableHead>
              <TableHead className="text-right border-r border-border/40">DXF area</TableHead>
              <TableHead className="text-right">Excel wt</TableHead>
              <TableHead className="text-right border-r border-border/40">DXF wt</TableHead>
              <TableHead>Excel mat.</TableHead>
              <TableHead className="border-r border-border/40">DXF mat.</TableHead>
              <TableHead className="min-w-[88px] border-r border-border/40">Status</TableHead>
              <TableHead className="w-[100px]"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="h-24 text-center text-muted-foreground">
                  No rows match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className={cn(
                    "group",
                    r.status === "error" && "bg-destructive/[0.04]",
                    r.status === "warning" && "bg-amber-500/[0.04]"
                  )}
                >
                  <TableCell className="font-medium sticky left-0 bg-background group-hover:bg-muted/30 z-10 border-r border-border/80">
                    {r.partName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums border-r border-border/40">
                    {r.qty}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.excelLengthMm}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums border-r border-border/40",
                      r.excelLengthMm !== r.dxfLengthMm && "text-amber-800 dark:text-amber-200 font-medium"
                    )}
                  >
                    {r.dxfLengthMm}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.excelWidthMm}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums border-r border-border/40",
                      r.excelWidthMm !== r.dxfWidthMm && "text-amber-800 dark:text-amber-200 font-medium"
                    )}
                  >
                    {r.dxfWidthMm}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.excelAreaM2.toFixed(3)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums border-r border-border/40",
                      Math.abs(r.excelAreaM2 - r.dxfAreaM2) > 0.001 &&
                        "text-amber-800 dark:text-amber-200 font-medium"
                    )}
                  >
                    {r.dxfAreaM2.toFixed(3)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.excelWeightKg.toFixed(1)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums border-r border-border/40",
                      Math.abs(r.excelWeightKg - r.dxfWeightKg) > 0.05 &&
                        "text-amber-800 dark:text-amber-200 font-medium"
                    )}
                  >
                    {r.dxfWeightKg.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-xs">{r.excelMaterial}</TableCell>
                  <TableCell
                    className={cn(
                      "text-xs border-r border-border/40",
                      r.excelMaterial !== r.dxfMaterial &&
                        "text-destructive font-medium"
                    )}
                  >
                    {r.dxfMaterial}
                  </TableCell>
                  <TableCell className="border-r border-border/40">
                    {statusBadge(r.status)}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 -ml-2"
                      onClick={() => onRowOpen(r)}
                    >
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
