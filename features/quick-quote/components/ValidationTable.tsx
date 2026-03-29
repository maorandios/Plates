"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { cn } from "@/lib/utils";
import type { ValidationRow, ValidationRowStatus } from "../types/quickQuote";

const FILTER_ALL = "__all__";

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
}

export function ValidationTable({ rows }: ValidationTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>(FILTER_ALL);
  const [thicknessFilter, setThicknessFilter] = useState<string>(FILTER_ALL);
  const [materialFilter, setMaterialFilter] = useState<string>(FILTER_ALL);
  const [search, setSearch] = useState("");

  const thicknessOptions = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) {
      if (Number.isFinite(r.thicknessMm)) set.add(r.thicknessMm);
    }
    return [...set].sort((a, b) => a - b);
  }, [rows]);

  const materialOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const a = r.excelMaterial?.trim();
      const b = r.dxfMaterial?.trim();
      if (a && a !== "-") set.add(a);
      if (b && b !== "-") set.add(b);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== FILTER_ALL && r.status !== statusFilter) return false;

      if (thicknessFilter !== FILTER_ALL) {
        const t = Number.parseFloat(thicknessFilter);
        if (!Number.isFinite(t) || Math.abs(r.thicknessMm - t) > 1e-6) return false;
      }

      if (materialFilter !== FILTER_ALL) {
        const ex = r.excelMaterial?.trim();
        const dx = r.dxfMaterial?.trim();
        if (ex !== materialFilter && dx !== materialFilter) return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!r.partName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, thicknessFilter, materialFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
          <div className="relative w-full max-w-sm shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search part name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 min-w-0">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Thickness (mm)</span>
              <Select value={thicknessFilter} onValueChange={setThicknessFilter}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All thicknesses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All thicknesses</SelectItem>
                  {thicknessOptions.map((t) => (
                    <SelectItem key={t} value={String(t)}>
                      {formatDecimal(t, t % 1 === 0 ? 0 : 2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Material</span>
              <Select value={materialFilter} onValueChange={setMaterialFilter}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All materials" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All materials</SelectItem>
                  {materialOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>All statuses</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/55 hover:bg-muted/55 border-b border-border">
              <TableHead
                colSpan={3}
                className="sticky left-0 z-20 min-w-[180px] bg-muted/55 text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/80"
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
              <TableHead className="text-center py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground min-w-[88px]">
                Status
              </TableHead>
            </TableRow>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
              <TableHead className="min-w-[100px] sticky left-0 bg-muted/40 z-10 border-r border-border/80 py-2 text-xs">
                Part name
              </TableHead>
              <TableHead className="text-right border-r border-border/40 py-2 text-xs">Qty</TableHead>
              <TableHead className="text-right border-r border-border/40 py-2 text-xs">
                Thickness (mm)
              </TableHead>
              <TableHead className="text-right py-2 text-xs">Excel L</TableHead>
              <TableHead className="text-right border-r border-border/40 py-2 text-xs">DXF L</TableHead>
              <TableHead className="text-right py-2 text-xs">Excel W</TableHead>
              <TableHead className="text-right border-r border-border/40 py-2 text-xs">DXF W</TableHead>
              <TableHead className="text-right py-2 text-xs">Excel area</TableHead>
              <TableHead className="text-right border-r border-border/40 py-2 text-xs">DXF area</TableHead>
              <TableHead className="text-right py-2 text-xs">Excel wt</TableHead>
              <TableHead className="text-right border-r border-border/40 py-2 text-xs">DXF wt</TableHead>
              <TableHead className="py-2 text-xs">Excel mat.</TableHead>
              <TableHead className="border-r border-border/40 py-2 text-xs">DXF mat.</TableHead>
              <TableHead className="min-w-[88px] py-2 text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="h-20 text-center text-muted-foreground text-sm">
                  No rows match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className={cn(
                    "group h-10",
                    r.status === "error" && "bg-destructive/[0.04]",
                    r.status === "warning" && "bg-amber-500/[0.04]"
                  )}
                >
                  <TableCell className="font-medium sticky left-0 bg-background group-hover:bg-muted/30 z-10 border-r border-border/80 py-2 text-sm">
                    {r.partName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums border-r border-border/40 py-2 text-sm">
                    {formatInteger(r.qty)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums border-r border-border/40 py-2 text-sm">
                    {formatDecimal(r.thicknessMm, r.thicknessMm % 1 === 0 ? 0 : 2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-2 text-sm">
                    {formatDecimal(r.excelLengthMm, 1)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums border-r border-border/40 py-2 text-sm",
                      r.excelLengthMm !== r.dxfLengthMm && "text-amber-800 dark:text-amber-200 font-medium"
                    )}
                  >
                    {formatDecimal(r.dxfLengthMm, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-2 text-sm">
                    {formatDecimal(r.excelWidthMm, 1)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums border-r border-border/40 py-2 text-sm",
                      r.excelWidthMm !== r.dxfWidthMm && "text-amber-800 dark:text-amber-200 font-medium"
                    )}
                  >
                    {formatDecimal(r.dxfWidthMm, 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-2 text-sm">
                    {formatDecimal(r.excelAreaM2, 3)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums border-r border-border/40 py-2 text-sm",
                      Math.abs(r.excelAreaM2 - r.dxfAreaM2) > 0.001 &&
                        "text-amber-800 dark:text-amber-200 font-medium"
                    )}
                  >
                    {formatDecimal(r.dxfAreaM2, 3)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums py-2 text-sm">
                    {formatDecimal(r.excelWeightKg, 1)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums border-r border-border/40 py-2 text-sm",
                      Math.abs(r.excelWeightKg - r.dxfWeightKg) > 0.05 &&
                        "text-amber-800 dark:text-amber-200 font-medium"
                    )}
                  >
                    {formatDecimal(r.dxfWeightKg, 1)}
                  </TableCell>
                  <TableCell className="text-xs py-2">{r.excelMaterial}</TableCell>
                  <TableCell
                    className={cn(
                      "text-xs border-r border-border/40 py-2",
                      r.excelMaterial !== r.dxfMaterial &&
                        "text-destructive font-medium"
                    )}
                  >
                    {r.dxfMaterial}
                  </TableCell>
                  <TableCell className="py-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-pointer inline-block">
                            {statusBadge(r.status)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-sm">
                          <div className="space-y-2">
                            {r.mismatchFields.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold">Mismatch Fields:</p>
                                <p className="text-xs text-muted-foreground">{r.mismatchFields.join(", ")}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-semibold">Reason:</p>
                              <p className="text-xs text-muted-foreground">{r.suggestedReason}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold">Action:</p>
                              <p className="text-xs text-muted-foreground">{r.actionRecommendation}</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
