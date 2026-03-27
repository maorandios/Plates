"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatQuickQuoteCurrency,
  formatQuickQuoteCurrencyAmount,
  quickQuoteCurrencySymbol,
} from "../lib/quickQuoteCurrencies";
import type { QuotePartRow, ValidationRowStatus } from "../types/quickQuote";

type SortDir = "asc" | "desc";

type PartBreakdownSortKey =
  | "partName"
  | "qty"
  | "material"
  | "thicknessMm"
  | "lengthMm"
  | "widthMm"
  | "areaM2"
  | "totalWeightKg"
  | "cutLengthM"
  | "validationStatus"
  | "preview"
  | "estimatedLineCost";

function validationRank(s: ValidationRowStatus): number {
  if (s === "error") return 0;
  if (s === "warning") return 1;
  return 2;
}

function comparePartRows(
  a: QuotePartRow,
  b: QuotePartRow,
  key: PartBreakdownSortKey,
  dir: SortDir
): number {
  const sign = dir === "asc" ? 1 : -1;
  let cmp = 0;
  switch (key) {
    case "partName":
      cmp = a.partName.localeCompare(b.partName, undefined, { sensitivity: "base" });
      break;
    case "qty":
      cmp = a.qty - b.qty;
      break;
    case "material":
      cmp = a.material.localeCompare(b.material, undefined, { sensitivity: "base" });
      break;
    case "thicknessMm":
      cmp = a.thicknessMm - b.thicknessMm;
      break;
    case "lengthMm":
      cmp = a.lengthMm - b.lengthMm;
      break;
    case "widthMm":
      cmp = a.widthMm - b.widthMm;
      break;
    case "areaM2":
      cmp = a.areaM2 - b.areaM2;
      break;
    case "totalWeightKg":
      cmp = a.weightKg * a.qty - (b.weightKg * b.qty);
      break;
    case "cutLengthM":
      cmp = a.cutLengthMm - b.cutLengthMm;
      break;
    case "validationStatus":
      cmp = validationRank(a.validationStatus) - validationRank(b.validationStatus);
      break;
    case "preview":
      cmp = a.id.localeCompare(b.id, undefined, { numeric: true });
      break;
    case "estimatedLineCost":
      cmp = a.estimatedLineCost - b.estimatedLineCost;
      break;
    }
  if (cmp !== 0) return cmp * sign;
  return a.id.localeCompare(b.id, undefined, { numeric: true }) * sign;
}

const SORT_BUTTON_ARIA: Record<PartBreakdownSortKey, string> = {
  partName: "part number",
  qty: "quantity",
  material: "material",
  thicknessMm: "thickness",
  lengthMm: "length",
  widthMm: "width",
  areaM2: "area",
  totalWeightKg: "total weight",
  cutLengthM: "cut length",
  validationStatus: "validation status",
  preview: "preview order",
  estimatedLineCost: "line price",
};

/**
 * Table-fixed column shares (sum 100). Part number kept relatively narrow; extra % to
 * dimension/processing columns. Order matches columns left → right.
 */
const COLUMN_WIDTH_PCT = [
  11, 6, 8, 9, 9, 9, 10, 11, 9, 7, 5, 6,
] as const;

const sectionHeadClass =
  "text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/60 bg-muted/55";
const subHeadClass =
  "h-auto py-2 px-3 text-left align-middle font-medium text-muted-foreground bg-muted/40 border-b border-border";

function SortableColumnHead({
  sortKey,
  sortState,
  onSort,
  className,
  thAriaLabel,
  children,
}: {
  sortKey: PartBreakdownSortKey;
  sortState: { key: PartBreakdownSortKey; dir: SortDir };
  onSort: (key: PartBreakdownSortKey) => void;
  className?: string;
  thAriaLabel?: string;
  children: ReactNode;
}) {
  const active = sortState.key === sortKey;
  const sortHint = SORT_BUTTON_ARIA[sortKey];
  const buttonLabel = thAriaLabel
    ? `Sort by ${sortHint} (${thAriaLabel})`
    : `Sort by ${sortHint}`;
  return (
    <TableHead
      scope="col"
      aria-sort={active ? (sortState.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`${className ?? ""} overflow-hidden`}
    >
      <button
        type="button"
        aria-label={buttonLabel}
        onClick={() => onSort(sortKey)}
        className="-mx-1 -my-1 flex w-full min-w-0 max-w-full items-center gap-2 rounded px-1 py-0.5 text-left font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
          {children}
        </span>
        <span
          className="inline-flex h-4 w-4 shrink-0 flex-none items-center justify-center"
          aria-hidden
        >
          {active ? (
            sortState.dir === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-45" />
          )}
        </span>
      </button>
    </TableHead>
  );
}

function statusBadge(status: ValidationRowStatus) {
  if (status === "valid")
    return (
      <Badge variant="outline" className="border-emerald-600/35 bg-emerald-600/10 text-xs">
        Valid
      </Badge>
    );
  if (status === "warning")
    return (
      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-xs">
        Warn
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-xs">
      Error
    </Badge>
  );
}

interface PartBreakdownTableProps {
  parts: QuotePartRow[];
  currency: string;
}

export function PartBreakdownTable({ parts, currency }: PartBreakdownTableProps) {
  const [previewPart, setPreviewPart] = useState<QuotePartRow | null>(null);
  const [sortState, setSortState] = useState<{
    key: PartBreakdownSortKey;
    dir: SortDir;
  }>({ key: "partName", dir: "asc" });

  const fmtMoney = (n: number) => formatQuickQuoteCurrency(n, currency);
  const fmtAmount = (n: number) => formatQuickQuoteCurrencyAmount(n, currency);
  const priceHeaderSymbol = quickQuoteCurrencySymbol(currency);

  const sortedParts = useMemo(() => {
    const next = [...parts];
    next.sort((a, b) => comparePartRows(a, b, sortState.key, sortState.dir));
    return next;
  }, [parts, sortState.key, sortState.dir]);

  function handleSort(key: PartBreakdownSortKey) {
    setSortState((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const p = previewPart;
  const totalWeightLine = p ? p.weightKg * p.qty : 0;
  const cutLengthM = p ? p.cutLengthMm / 1000 : 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="w-full overflow-x-auto">
        <Table className="table-fixed w-full min-w-[1100px]">
          <colgroup>
            {COLUMN_WIDTH_PCT.map((pct, i) => (
              <col key={i} style={{ width: `${pct}%` }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-muted/55">
              <TableHead colSpan={2} className={sectionHeadClass}>
                Part
              </TableHead>
              <TableHead colSpan={2} className={sectionHeadClass}>
                Material
              </TableHead>
              <TableHead colSpan={3} className={sectionHeadClass}>
                Dimensions
              </TableHead>
              <TableHead colSpan={2} className={sectionHeadClass}>
                Processing
              </TableHead>
              <TableHead colSpan={3} className={`${sectionHeadClass} border-r-0`}>
                Quote
              </TableHead>
            </TableRow>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
              <SortableColumnHead
                sortKey="partName"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} min-w-0`}
              >
                Part number
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="qty"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} whitespace-nowrap border-r border-border/40`}
              >
                Quantity
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="material"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} min-w-0`}
              >
                Material
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="thicknessMm"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} whitespace-nowrap border-r border-border/40`}
              >
                Thickness(mm)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="lengthMm"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} whitespace-nowrap`}
              >
                Length(mm)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="widthMm"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} whitespace-nowrap`}
              >
                Width(mm)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="areaM2"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} whitespace-nowrap border-r border-border/40`}
              >
                Area(m2)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="totalWeightKg"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} whitespace-nowrap`}
              >
                Total Weight(kg)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="cutLengthM"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} whitespace-nowrap border-r border-border/40`}
              >
                Cut length(m)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="validationStatus"
                sortState={sortState}
                onSort={handleSort}
                className={subHeadClass}
              >
                Validation
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="preview"
                sortState={sortState}
                onSort={handleSort}
                className={`${subHeadClass} border-r border-border/40`}
              >
                Preview
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="estimatedLineCost"
                sortState={sortState}
                onSort={handleSort}
                thAriaLabel={`Price in ${currency}`}
                className={`${subHeadClass} whitespace-nowrap`}
              >
                <span className="tabular-nums text-foreground" aria-hidden>
                  {priceHeaderSymbol}
                </span>
                Price
              </SortableColumnHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedParts.map((row) => {
              const totalWeightKg = row.weightKg * row.qty;
              const cutM = row.cutLengthMm / 1000;
              return (
                <TableRow key={row.id}>
                  <TableCell className="py-2 px-3 text-left align-middle font-medium min-w-0">
                    <span className="truncate block" title={row.partName}>
                      {row.partName}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle tabular-nums border-r border-border/40">
                    {row.qty}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle text-xs min-w-0">
                    <span className="truncate block" title={row.material}>
                      {row.material}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle tabular-nums text-xs border-r border-border/40">
                    {row.thicknessMm}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle tabular-nums text-xs">
                    {row.lengthMm}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle tabular-nums text-xs">
                    {row.widthMm}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle tabular-nums text-xs border-r border-border/40">
                    {row.areaM2.toFixed(3)}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle tabular-nums text-xs">
                    {totalWeightKg.toFixed(1)}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle tabular-nums text-xs border-r border-border/40">
                    {cutM.toFixed(2)}
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle">
                    {statusBadge(row.validationStatus)}
                  </TableCell>
                  <TableCell className="py-1.5 px-3 text-left align-middle border-r border-border/40">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Preview ${row.partName}`}
                      onClick={() => setPreviewPart(row)}
                    >
                      <Eye className="h-4 w-4" strokeWidth={1.75} />
                    </Button>
                  </TableCell>
                  <TableCell className="py-2 px-3 text-left align-middle tabular-nums text-xs font-medium">
                    {fmtAmount(row.estimatedLineCost)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={previewPart !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewPart(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {p && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-base">{p.partName}</DialogTitle>
                <DialogDescription>Plate line detail from the quote breakdown.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <dl className="space-y-2 sm:col-span-2">
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Quantity</dt>
                    <dd className="tabular-nums font-medium">{p.qty}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Material</dt>
                    <dd className="font-medium text-right">{p.material}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Thickness</dt>
                    <dd className="tabular-nums">{p.thicknessMm} mm</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Length × width</dt>
                    <dd className="tabular-nums">
                      {p.lengthMm} × {p.widthMm} mm
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Area (per plate)</dt>
                    <dd className="tabular-nums">{p.areaM2.toFixed(3)} m²</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Total weight (line)</dt>
                    <dd className="tabular-nums">{totalWeightLine.toFixed(1)} kg</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Cut length (per plate)</dt>
                    <dd className="tabular-nums">{cutLengthM.toFixed(2)} m</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Pierce count</dt>
                    <dd className="tabular-nums">{p.pierceCount}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Line price (est.)</dt>
                    <dd className="tabular-nums font-medium">{fmtMoney(p.estimatedLineCost)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">DXF file</dt>
                    <dd className="font-mono text-xs text-right break-all">{p.dxfFileName}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border pb-2">
                    <dt className="text-muted-foreground">Excel ref</dt>
                    <dd className="font-mono text-xs">{p.excelRowRef}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground mb-1">Notes</dt>
                    <dd className="text-foreground leading-relaxed">{p.notes?.trim() || "—"}</dd>
                  </div>
                </dl>
                <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-muted/20 aspect-video flex items-center justify-center text-sm text-muted-foreground">
                  Geometry preview (placeholder)
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
