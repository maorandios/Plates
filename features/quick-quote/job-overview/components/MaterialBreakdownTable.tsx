"use client";

import { useMemo } from "react";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StockSheetSizeBreakdownRow } from "../jobOverview.types";
import { formatAreaM2 } from "../jobOverview.utils";

interface MaterialBreakdownTableProps {
  rows: StockSheetSizeBreakdownRow[];
  shareScopeLabel?: string;
  groupedByThickness?: boolean;
}

function sheetSizeLabel(r: StockSheetSizeBreakdownRow): string {
  const w = Math.round(r.sheetWidthMm);
  const l = Math.round(r.sheetLengthMm);
  if (w <= 0 || l <= 0) return "—";
  return `${w.toLocaleString()} × ${l.toLocaleString()} mm`;
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Waste as % of gross (0–100); mirrors 100 − util when areas are consistent. */
function wasteSharePct(r: StockSheetSizeBreakdownRow): number {
  const g = r.grossStockAreaM2;
  if (g <= 0) return 0;
  return Math.round((r.wasteAreaM2 / g) * 1000) / 10;
}

/**
 * Utilization heat: higher = greener (good stock use), lower = redder (poor).
 * Tuned for light + dark backgrounds.
 */
function utilHeatCellClass(pct: number): string {
  const u = clampPct(pct);
  if (u >= 85)
    return "bg-emerald-500/25 dark:bg-emerald-500/[0.22] font-semibold text-foreground";
  if (u >= 72)
    return "bg-lime-500/20 dark:bg-lime-500/[0.18] font-semibold text-foreground";
  if (u >= 58)
    return "bg-amber-400/22 dark:bg-amber-500/[0.18] font-semibold text-foreground";
  if (u >= 42)
    return "bg-orange-400/24 dark:bg-orange-500/[0.2] font-semibold text-foreground";
  return "bg-red-500/25 dark:bg-red-500/[0.22] font-semibold text-foreground";
}

/** Inverse of util: high waste share = red (bad). */
function wasteShareHeatCellClass(wastePct: number): string {
  return utilHeatCellClass(100 - clampPct(wastePct));
}

/** Subtle row tint + left stripe so rows scan quickly. */
function utilHeatRowClass(pct: number): string {
  const u = clampPct(pct);
  if (u >= 85)
    return "border-l-4 border-l-emerald-500 bg-emerald-500/[0.05] dark:bg-emerald-500/[0.09]";
  if (u >= 72)
    return "border-l-4 border-l-lime-500 bg-lime-500/[0.05] dark:bg-lime-500/[0.08]";
  if (u >= 58)
    return "border-l-4 border-l-amber-500 bg-amber-400/[0.06] dark:bg-amber-500/[0.09]";
  if (u >= 42)
    return "border-l-4 border-l-orange-500 bg-orange-400/[0.07] dark:bg-orange-500/[0.1]";
  return "border-l-4 border-l-red-500 bg-red-500/[0.06] dark:bg-red-500/[0.11]";
}

export function MaterialBreakdownTable({
  rows,
  shareScopeLabel = "job",
  groupedByThickness = false,
}: MaterialBreakdownTableProps) {
  const totals = useMemo(() => {
    let gross = 0;
    let net = 0;
    let waste = 0;
    let sheets = 0;
    for (const r of rows) {
      gross += r.grossStockAreaM2;
      net += r.netPlateAreaM2;
      waste += r.wasteAreaM2;
      sheets += r.sheetCount;
    }
    const util = gross > 0 ? (net / gross) * 100 : 0;
    return {
      grossStockAreaM2: gross,
      netPlateAreaM2: net,
      wasteAreaM2: waste,
      sheetCount: sheets,
      utilizationPct: Math.round(util * 10) / 10,
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-16 text-center border border-dashed border-border rounded-lg">
        No part rows available.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[100px]">Material</TableHead>
            <TableHead className="text-right tabular-nums w-[88px]">Thick. (mm)</TableHead>
            <TableHead className="min-w-[120px]">Sheet size</TableHead>
            <TableHead className="text-right tabular-nums w-[80px]">Sheets</TableHead>
            <TableHead className="text-right tabular-nums min-w-[96px]">Gross</TableHead>
            <TableHead className="text-right tabular-nums min-w-[96px]">Net</TableHead>
            <TableHead
              className="text-right tabular-nums min-w-[96px]"
              title="Cell color: higher waste share of gross = worse (redder)"
            >
              Waste
            </TableHead>
            <TableHead
              className="text-right tabular-nums w-[104px] min-w-[104px]"
              title="Cell color: higher utilization = better (greener)"
            >
              Util.
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const wShare = wasteSharePct(r);
            return (
              <TableRow key={r.label} className={utilHeatRowClass(r.utilizationPct)}>
                <TableCell className="font-medium text-foreground">{r.material}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatDecimal(r.thicknessMm, 1)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {sheetSizeLabel(r)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatInteger(r.sheetCount)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatAreaM2(r.grossStockAreaM2)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatAreaM2(r.netPlateAreaM2)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${wasteShareHeatCellClass(wShare)}`}
                >
                  {formatAreaM2(r.wasteAreaM2)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${utilHeatCellClass(r.utilizationPct)}`}
                >
                  {formatDecimal(r.utilizationPct, 1)}%
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow
            className={`hover:bg-muted/50 ${utilHeatRowClass(totals.utilizationPct)}`}
          >
            <TableCell className="font-medium" colSpan={3}>
              Total ({shareScopeLabel})
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatInteger(totals.sheetCount)}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatAreaM2(totals.grossStockAreaM2)}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatAreaM2(totals.netPlateAreaM2)}
            </TableCell>
            <TableCell
              className={`text-right tabular-nums font-medium ${wasteShareHeatCellClass(
                totals.grossStockAreaM2 > 0
                  ? (totals.wasteAreaM2 / totals.grossStockAreaM2) * 100
                  : 0
              )}`}
            >
              {formatAreaM2(totals.wasteAreaM2)}
            </TableCell>
            <TableCell
              className={`text-right tabular-nums font-medium ${utilHeatCellClass(
                totals.utilizationPct
              )}`}
            >
              {formatDecimal(totals.utilizationPct, 1)}%
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      <div className="space-y-2 px-1">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="shrink-0 font-medium text-foreground">Util. heat</span>
          <div
            className="h-2.5 min-w-[140px] flex-1 max-w-xs rounded-sm border border-border bg-gradient-to-r from-red-500/40 via-amber-400/35 via-lime-500/35 to-emerald-500/40 dark:from-red-500/30 dark:via-amber-500/25 dark:via-lime-500/25 dark:to-emerald-500/30"
            title="Poor → strong utilization"
          />
          <span className="tabular-nums text-[10px]">poor</span>
          <span className="text-muted-foreground/70">→</span>
          <span className="tabular-nums text-[10px]">strong</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {groupedByThickness
            ? "One row per thickness (all materials and sheet sizes summed). "
            : "One row per material + thickness + chosen stock size (separate nesting run each). "}
          Rows and Util./Waste cells are tinted: greener = better material use, redder = worse. Waste
          column uses the inverse scale (more waste share = redder). Gross = sheets × sheet area;
          waste = gross − net.
        </p>
      </div>
    </div>
  );
}
