"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Card } from "@/components/ui/card";
import type { DxfPartGeometry } from "@/types";
import { cn } from "@/lib/utils";
import { jobSummaryFromParts } from "../lib/deriveQuoteSelection";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import {
  formatQuickQuoteCurrency,
  formatQuickQuoteCurrencyAmount,
  quickQuoteCurrencySymbol,
} from "../lib/quickQuoteCurrencies";
import type { MaterialType } from "@/types/materials";
import {
  materialPricingRowKey,
  parseMaterialPricePerKg,
} from "../job-overview/materialCalculations";
import { splitMaterialGradeAndFinish } from "../lib/plateFields";
import type { QuotePartRow } from "../types/quickQuote";
import { QuotePartGeometryPreview } from "./QuotePartGeometryPreview";

type SortDir = "asc" | "desc";

type PartBreakdownSortKey =
  | "sourceRef"
  | "partName"
  | "qty"
  | "thicknessMm"
  | "materialGrade"
  | "finish"
  | "widthMm"
  | "lengthMm"
  | "areaM2"
  | "lineWeightKg"
  | "preview";

function comparePartRows(
  a: QuotePartRow,
  b: QuotePartRow,
  key: PartBreakdownSortKey,
  dir: SortDir
): number {
  const sign = dir === "asc" ? 1 : -1;
  let cmp = 0;
  const { grade: ga, finish: fa } = splitMaterialGradeAndFinish(a.material);
  const { grade: gb, finish: fb } = splitMaterialGradeAndFinish(b.material);
  switch (key) {
    case "sourceRef":
      cmp = (a.sourceRef ?? "").localeCompare(b.sourceRef ?? "", undefined, {
        sensitivity: "base",
      });
      break;
    case "partName":
      cmp = a.partName.localeCompare(b.partName, undefined, { sensitivity: "base" });
      break;
    case "qty":
      cmp = a.qty - b.qty;
      break;
    case "thicknessMm":
      cmp = a.thicknessMm - b.thicknessMm;
      break;
    case "materialGrade":
      cmp = ga.localeCompare(gb, undefined, { sensitivity: "base" });
      break;
    case "finish":
      cmp = fa.localeCompare(fb, undefined, { sensitivity: "base" });
      break;
    case "widthMm":
      cmp = a.widthMm - b.widthMm;
      break;
    case "lengthMm":
      cmp = a.lengthMm - b.lengthMm;
      break;
    case "areaM2":
      cmp = a.areaM2 - b.areaM2;
      break;
    case "lineWeightKg":
      cmp = a.weightKg * a.qty - b.weightKg * b.qty;
      break;
    case "preview":
      cmp = a.id.localeCompare(b.id, undefined, { numeric: true });
      break;
  }
  if (cmp !== 0) return cmp * sign;
  return a.id.localeCompare(b.id, undefined, { numeric: true }) * sign;
}

/** Empty selection = no filter (show all). Non-empty = row must match one of the selected values (OR). */
function filterPartRows(
  rows: QuotePartRow[],
  partNameQuery: string,
  refSelected: string[],
  thicknessSelected: string[],
  gradeSelected: string[],
  finishSelected: string[]
): QuotePartRow[] {
  const q = partNameQuery.trim().toLowerCase();
  const refSet = new Set(refSelected);
  const thickSet = new Set(thicknessSelected);
  const gradeSet = new Set(gradeSelected);
  const finishSet = new Set(finishSelected);

  return rows.filter((row) => {
    if (q && !row.partName.toLowerCase().includes(q)) return false;
    if (refSet.size > 0 && !refSet.has((row.sourceRef ?? "").trim())) {
      return false;
    }
    if (thickSet.size > 0 && !thickSet.has(String(row.thicknessMm))) {
      return false;
    }
    const { grade, finish } = splitMaterialGradeAndFinish(row.material);
    if (gradeSet.size > 0 && !gradeSet.has(grade)) return false;
    if (finishSet.size > 0 && !finishSet.has(finish)) return false;
    return true;
  });
}

function deriveFilterOptions(parts: QuotePartRow[]) {
  const refs = new Set<string>();
  const thicknessesMm = new Set<number>();
  const grades = new Set<string>();
  const finishes = new Set<string>();
  for (const row of parts) {
    const r = row.sourceRef?.trim();
    if (r) refs.add(r);
    thicknessesMm.add(row.thicknessMm);
    const { grade, finish } = splitMaterialGradeAndFinish(row.material);
    grades.add(grade);
    finishes.add(finish);
  }
  return {
    refs: [...refs].sort((a, b) => a.localeCompare(b)),
    thicknessesMm: [...thicknessesMm].sort((a, b) => a - b),
    grades: [...grades].sort((a, b) => a.localeCompare(b)),
    finishes: [...finishes].sort((a, b) => a.localeCompare(b)),
  };
}

const SORT_BUTTON_ARIA: Record<PartBreakdownSortKey, string> = {
  sourceRef: "Ref",
  partName: "part number",
  qty: "quantity",
  thicknessMm: "thickness",
  materialGrade: "material grade",
  finish: "finish",
  widthMm: "width",
  lengthMm: "length",
  areaM2: "area",
  lineWeightKg: "weight",
  preview: "preview",
};

/** Part (5) + Dimensions (4 or 5 with material sell) + Preview (1) + optional Delete (1). */
function columnCount(
  showRef: boolean,
  showDelete: boolean,
  showMaterialPricing: boolean
): number {
  const dim = showMaterialPricing ? 5 : 4;
  return (showRef ? 1 : 0) + 5 + dim + 1 + (showDelete ? 1 : 0);
}

/** Equal-width columns: share 100% across n columns (handles rounding). */
function equalColumnWidthsPct(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((10000 / n)) / 100;
  const arr = Array.from({ length: n }, () => base);
  const sum = arr.reduce((a, b) => a + b, 0);
  arr[n - 1] = Math.round((arr[n - 1] + (100 - sum)) * 100) / 100;
  return arr;
}

/** Vertical rules: standard column vs section boundary (Ref | Part | Dim | Actions). */
const colRule = "border-r border-border/50";
const sectionRule = "border-r border-border";

const sectionHeadClass =
  "text-center py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/55";
const subHeadClass =
  "h-auto py-2 px-3 text-left align-middle font-medium text-muted-foreground bg-muted/40 border-b border-border";

type MultiSelectOption = { value: string; label: string };

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const summary = useMemo(() => {
    if (selected.length === 0) return "All";
    if (selected.length === 1) {
      return options.find((o) => o.value === selected[0])?.label ?? selected[0];
    }
    return `${selected.length} selected`;
  }, [selected, options]);

  return (
    <div className="w-full min-w-[9rem] sm:w-[11rem]">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-between gap-2 px-3 font-normal"
            disabled={disabled || options.length === 0}
          >
            <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-64 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {selected.length > 0 ? `${selected.length} selected` : "Choose one or more"}
          </DropdownMenuLabel>
          {selected.length > 0 ? (
            <>
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => {
                  onChange([]);
                }}
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={selected.includes(opt.value)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selected, opt.value]);
                } else {
                  onChange(selected.filter((v) => v !== opt.value));
                }
              }}
              onSelect={(e) => e.preventDefault()}
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

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

interface PartBreakdownTableProps {
  parts: QuotePartRow[];
  currency: string;
  /** When set, shows a delete action per row (e.g. merged quote lines step). */
  onDeletePart?: (row: QuotePartRow) => void;
  /** With {@link materialPricePerKgByRow}, adds a material sell column from Pricing. */
  materialType?: MaterialType;
  materialPricePerKgByRow?: Record<string, string>;
  /** DXF geometries from the quote session — used to show real outlines in the preview modal. */
  dxfPartGeometries?: DxfPartGeometry[] | null;
}

export function PartBreakdownTable({
  parts,
  currency,
  onDeletePart,
  materialType,
  materialPricePerKgByRow,
  dxfPartGeometries,
}: PartBreakdownTableProps) {
  const [previewPart, setPreviewPart] = useState<QuotePartRow | null>(null);
  const [sortState, setSortState] = useState<{
    key: PartBreakdownSortKey;
    dir: SortDir;
  }>({ key: "partName", dir: "asc" });

  const [partNameSearch, setPartNameSearch] = useState("");
  const [filterRef, setFilterRef] = useState<string[]>([]);
  const [filterThickness, setFilterThickness] = useState<string[]>([]);
  const [filterGrade, setFilterGrade] = useState<string[]>([]);
  const [filterFinish, setFilterFinish] = useState<string[]>([]);

  const showRefColumn = useMemo(
    () => parts.some((row) => Boolean(row.sourceRef?.trim())),
    [parts]
  );
  const showDelete = Boolean(onDeletePart);
  const showMaterialPricing = Boolean(materialType && materialPricePerKgByRow);

  const dimCols = showMaterialPricing ? 5 : 4;

  const columnWidthsPct = useMemo(
    () =>
      equalColumnWidthsPct(
        columnCount(showRefColumn, showDelete, showMaterialPricing)
      ),
    [showRefColumn, showDelete, showMaterialPricing]
  );

  const fmtAmount = (n: number) => formatQuickQuoteCurrencyAmount(n, currency);
  const priceHeaderSymbol = quickQuoteCurrencySymbol(currency);

  const filterOptions = useMemo(() => deriveFilterOptions(parts), [parts]);

  const refFilterOptions = useMemo(
    () => filterOptions.refs.map((r) => ({ value: r, label: r })),
    [filterOptions.refs]
  );
  const thicknessFilterOptions = useMemo(
    () =>
      filterOptions.thicknessesMm.map((t) => ({
        value: String(t),
        label: formatInteger(Math.round(t)),
      })),
    [filterOptions.thicknessesMm]
  );
  const gradeFilterOptions = useMemo(
    () => filterOptions.grades.map((g) => ({ value: g, label: g })),
    [filterOptions.grades]
  );
  const finishFilterOptions = useMemo(
    () => filterOptions.finishes.map((f) => ({ value: f, label: f })),
    [filterOptions.finishes]
  );

  const filteredParts = useMemo(
    () =>
      filterPartRows(
        parts,
        partNameSearch,
        filterRef,
        filterThickness,
        filterGrade,
        filterFinish
      ),
    [parts, partNameSearch, filterRef, filterThickness, filterGrade, filterFinish]
  );

  const sortedParts = useMemo(() => {
    const next = [...filteredParts];
    next.sort((a, b) => comparePartRows(a, b, sortState.key, sortState.dir));
    return next;
  }, [filteredParts, sortState.key, sortState.dir]);

  const breakdownMetrics = useMemo(
    () => jobSummaryFromParts(filteredParts),
    [filteredParts]
  );

  const hasActiveFilters = useMemo(() => {
    return (
      partNameSearch.trim().length > 0 ||
      filterRef.length > 0 ||
      filterThickness.length > 0 ||
      filterGrade.length > 0 ||
      filterFinish.length > 0
    );
  }, [partNameSearch, filterRef, filterThickness, filterGrade, filterFinish]);

  function clearFilters() {
    setPartNameSearch("");
    setFilterRef([]);
    setFilterThickness([]);
    setFilterGrade([]);
    setFilterFinish([]);
  }

  const showRefFilter = filterOptions.refs.length > 0;
  const colSpanEmpty = columnCount(showRefColumn, showDelete, showMaterialPricing);

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

  const pricingPreviewLayout =
    Boolean(p) &&
    showMaterialPricing &&
    materialType != null &&
    materialPricePerKgByRow != null;

  const { grade: previewGradeLabel, finish: previewFinishLabel } =
    splitMaterialGradeAndFinish(p?.material ?? "");

  const lineMaterialSellPreview =
    p && pricingPreviewLayout && materialType && materialPricePerKgByRow
      ? totalWeightLine *
        parseMaterialPricePerKg(
          materialPricePerKgByRow[materialPricingRowKey(p, materialType)] ?? ""
        )
      : 0;

  const actionCols = showDelete ? 2 : 1;
  const partCols = 5;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-2 gap-3 border-b border-border bg-muted/20 p-4 sm:grid-cols-4">
        <Card className="border-border/80 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Plates
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatInteger(breakdownMetrics.uniqueParts)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Quote lines</p>
        </Card>
        <Card className="border-border/80 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quantity
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatInteger(breakdownMetrics.totalQty)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Total pieces</p>
        </Card>
        <Card className="border-border/80 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Area
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatDecimal(breakdownMetrics.totalPlateAreaM2, 2)}
            <span className="ml-1 text-lg font-medium text-muted-foreground">m²</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Total plate area</p>
        </Card>
        <Card className="border-border/80 p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Weight
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatDecimal(breakdownMetrics.totalEstWeightKg, 1)}
            <span className="ml-1 text-lg font-medium text-muted-foreground">kg</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Estimated total</p>
        </Card>
      </div>

      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-0 flex-1 lg:min-w-[220px] lg:max-w-md">
            <label
              htmlFor="part-breakdown-search"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Search part name
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="part-breakdown-search"
                type="search"
                value={partNameSearch}
                onChange={(e) => setPartNameSearch(e.target.value)}
                placeholder="Type to filter…"
                className="h-10 pl-9"
                autoComplete="off"
              />
            </div>
          </div>

          {showRefFilter ? (
            <MultiSelectFilter
              label="Reference"
              options={refFilterOptions}
              selected={filterRef}
              onChange={setFilterRef}
            />
          ) : null}

          <MultiSelectFilter
            label="Thickness (mm)"
            options={thicknessFilterOptions}
            selected={filterThickness}
            onChange={setFilterThickness}
            disabled={parts.length === 0}
          />

          <MultiSelectFilter
            label="Material grade"
            options={gradeFilterOptions}
            selected={filterGrade}
            onChange={setFilterGrade}
            disabled={parts.length === 0}
          />

          <MultiSelectFilter
            label="Finish"
            options={finishFilterOptions}
            selected={filterFinish}
            onChange={setFilterFinish}
            disabled={parts.length === 0}
          />

          {hasActiveFilters ? (
            <div className="flex w-full shrink-0 lg:w-auto lg:pb-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <Table
          className={cn(
            "table-fixed w-full border-collapse",
            showRefColumn && showDelete && (showMaterialPricing ? "min-w-[1300px]" : "min-w-[1180px]"),
            showRefColumn && !showDelete && (showMaterialPricing ? "min-w-[1220px]" : "min-w-[1100px]"),
            !showRefColumn && showDelete && (showMaterialPricing ? "min-w-[1200px]" : "min-w-[1080px]"),
            !showRefColumn && !showDelete && (showMaterialPricing ? "min-w-[1100px]" : "min-w-[980px]")
          )}
        >
          <colgroup>
            {columnWidthsPct.map((pct, i) => (
              <col key={i} style={{ width: `${pct}%` }} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="border-b border-border hover:bg-muted/55">
              {showRefColumn ? (
                <TableHead colSpan={1} className={cn(sectionHeadClass, sectionRule)}>
                  Ref
                </TableHead>
              ) : null}
              <TableHead colSpan={partCols} className={cn(sectionHeadClass, sectionRule)}>
                Part
              </TableHead>
              <TableHead
                colSpan={dimCols}
                className={cn(sectionHeadClass, sectionRule)}
              >
                Dimensions
              </TableHead>
              <TableHead colSpan={actionCols} className={cn(sectionHeadClass, "border-r-0")}>
                Actions
              </TableHead>
            </TableRow>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border">
              {showRefColumn ? (
                <SortableColumnHead
                  sortKey="sourceRef"
                  sortState={sortState}
                  onSort={handleSort}
                  className={cn(subHeadClass, sectionRule, "min-w-0 whitespace-nowrap")}
                >
                  Ref
                </SortableColumnHead>
              ) : null}
              <SortableColumnHead
                sortKey="partName"
                sortState={sortState}
                onSort={handleSort}
                className={cn(subHeadClass, colRule, "min-w-0")}
              >
                Part number
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="qty"
                sortState={sortState}
                onSort={handleSort}
                className={cn(subHeadClass, colRule, "whitespace-nowrap")}
              >
                Quantity
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="thicknessMm"
                sortState={sortState}
                onSort={handleSort}
                className={cn(subHeadClass, colRule, "whitespace-nowrap")}
              >
                Thickness (mm)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="materialGrade"
                sortState={sortState}
                onSort={handleSort}
                className={cn(subHeadClass, colRule, "min-w-0")}
              >
                Material grade
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="finish"
                sortState={sortState}
                onSort={handleSort}
                className={cn(subHeadClass, sectionRule, "min-w-0")}
              >
                Finish
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="widthMm"
                sortState={sortState}
                onSort={handleSort}
                className={cn(subHeadClass, colRule, "whitespace-nowrap")}
              >
                Width (mm)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="lengthMm"
                sortState={sortState}
                onSort={handleSort}
                className={cn(subHeadClass, colRule, "whitespace-nowrap")}
              >
                Length (mm)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="areaM2"
                sortState={sortState}
                onSort={handleSort}
                className={cn(subHeadClass, colRule, "whitespace-nowrap")}
              >
                Area (m²)
              </SortableColumnHead>
              <SortableColumnHead
                sortKey="lineWeightKg"
                sortState={sortState}
                onSort={handleSort}
                className={cn(
                  subHeadClass,
                  showMaterialPricing ? colRule : sectionRule,
                  "whitespace-nowrap"
                )}
              >
                Weight (kg)
              </SortableColumnHead>
              {showMaterialPricing ? (
                <TableHead
                  scope="col"
                  className={cn(subHeadClass, sectionRule, "whitespace-nowrap text-right tabular-nums")}
                  title="Line weight × price/kg from Calculations"
                >
                  Material ({priceHeaderSymbol})
                </TableHead>
              ) : null}
              <SortableColumnHead
                sortKey="preview"
                sortState={sortState}
                onSort={handleSort}
                className={cn(subHeadClass, showDelete ? colRule : "border-r-0")}
              >
                Preview
              </SortableColumnHead>
              {showDelete ? (
                <TableHead scope="col" className={cn(subHeadClass, "w-[1%] border-r-0")}>
                  <span className="sr-only">Delete</span>
                  <span aria-hidden className="text-muted-foreground">
                    Delete
                  </span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedParts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpanEmpty}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {parts.length === 0
                    ? "No parts in this quote."
                    : "No rows match your search and filters."}
                </TableCell>
              </TableRow>
            ) : null}
            {sortedParts.map((row) => {
              const lineWeightKg = row.weightKg * row.qty;
              const { grade, finish } = splitMaterialGradeAndFinish(row.material);
              return (
                <TableRow key={row.id}>
                  {showRefColumn ? (
                    <TableCell
                      className={cn(
                        "py-2 px-3 text-left align-middle text-xs font-medium whitespace-nowrap min-w-0",
                        sectionRule
                      )}
                    >
                      <span
                        className="truncate block"
                        title={row.sourceRef ?? ""}
                      >
                        {row.sourceRef ?? "—"}
                      </span>
                    </TableCell>
                  ) : null}
                  <TableCell
                    className={cn(
                      "py-2 px-3 text-left align-middle font-medium min-w-0",
                      colRule
                    )}
                  >
                    <span className="truncate block" title={row.partName}>
                      {row.partName}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "py-2 px-3 text-left align-middle tabular-nums",
                      colRule
                    )}
                  >
                    {row.qty}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "py-2 px-3 text-left align-middle tabular-nums text-xs",
                      colRule
                    )}
                  >
                    {formatInteger(Math.round(row.thicknessMm))}
                  </TableCell>
                  <TableCell
                    className={cn("py-2 px-3 text-left align-middle text-xs min-w-0", colRule)}
                  >
                    <span className="truncate block" title={grade}>
                      {grade}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn("py-2 px-3 text-left align-middle text-xs min-w-0", sectionRule)}
                  >
                    <span className="truncate block" title={finish}>
                      {finish}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "py-2 px-3 text-left align-middle tabular-nums text-xs",
                      colRule
                    )}
                  >
                    {formatDecimal(row.widthMm, 2)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "py-2 px-3 text-left align-middle tabular-nums text-xs",
                      colRule
                    )}
                  >
                    {formatDecimal(row.lengthMm, 2)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "py-2 px-3 text-left align-middle tabular-nums text-xs",
                      colRule
                    )}
                  >
                    {formatDecimal(row.areaM2, 3)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "py-2 px-3 text-left align-middle tabular-nums text-xs",
                      showMaterialPricing ? colRule : sectionRule
                    )}
                  >
                    {formatDecimal(lineWeightKg, 2)}
                  </TableCell>
                  {showMaterialPricing && materialType && materialPricePerKgByRow ? (
                    <TableCell
                      className={cn(
                        "py-2 px-3 text-right align-middle tabular-nums text-xs font-medium text-foreground",
                        sectionRule
                      )}
                    >
                      {fmtAmount(
                        lineWeightKg *
                          parseMaterialPricePerKg(
                            materialPricePerKgByRow[materialPricingRowKey(row, materialType)] ??
                              ""
                          )
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell
                    className={cn(
                      "py-1.5 px-3 text-left align-middle",
                      showDelete ? colRule : "border-r-0"
                    )}
                  >
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
                  {showDelete ? (
                    <TableCell className="py-1.5 px-3 text-left align-middle border-r-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${row.partName} from quote`}
                        onClick={() => onDeletePart?.(row)}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </Button>
                    </TableCell>
                  ) : null}
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
        <DialogContent
          className={cn(
            pricingPreviewLayout
              ? "w-[min(100vw-1.5rem,72rem)] max-w-[72rem] sm:max-w-[72rem] gap-0 p-0 overflow-hidden"
              : "sm:max-w-lg"
          )}
        >
          {p && (
            <>
              <DialogHeader
                className={cn(
                  "px-6 pt-6 pb-2 text-left",
                  pricingPreviewLayout && "border-b border-border bg-muted/20 px-6 py-4 sm:py-5"
                )}
              >
                <DialogTitle className="font-mono text-base sm:text-lg">{p.partName}</DialogTitle>
                <DialogDescription>
                  {pricingPreviewLayout
                    ? "Plate line detail — material pricing uses your price/kg for this grade, thickness, and finish."
                    : "Plate line detail from the quote breakdown."}
                </DialogDescription>
              </DialogHeader>

              {pricingPreviewLayout ? (
                <div className="grid md:grid-cols-2 md:divide-x md:divide-border min-h-[min(60vh,420px)]">
                  <div className="p-6 min-w-0 flex flex-col">
                    <dl className="space-y-2.5 text-sm flex-1">
                      {p.sourceRef ? (
                        <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                          <dt className="text-muted-foreground shrink-0">Ref</dt>
                          <dd className="font-medium text-right min-w-0">{p.sourceRef}</dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Quantity</dt>
                        <dd className="tabular-nums font-medium">{p.qty}</dd>
                      </div>
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Material grade</dt>
                        <dd className="font-medium text-right min-w-0">{previewGradeLabel}</dd>
                      </div>
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Finish</dt>
                        <dd className="font-medium text-right min-w-0">{previewFinishLabel}</dd>
                      </div>
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Thickness</dt>
                        <dd className="tabular-nums">
                          {formatInteger(Math.round(p.thicknessMm))} mm
                        </dd>
                      </div>
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Width</dt>
                        <dd className="tabular-nums">{formatDecimal(p.widthMm, 2)} mm</dd>
                      </div>
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Length</dt>
                        <dd className="tabular-nums">{formatDecimal(p.lengthMm, 2)} mm</dd>
                      </div>
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Area (per plate)</dt>
                        <dd className="tabular-nums">{formatDecimal(p.areaM2, 3)} m²</dd>
                      </div>
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Total weight (line)</dt>
                        <dd className="tabular-nums">{formatDecimal(totalWeightLine, 2)} kg</dd>
                      </div>
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Cut length (per plate)</dt>
                        <dd className="tabular-nums">{formatDecimal(cutLengthM, 2)} m</dd>
                      </div>
                      <div className="flex justify-between gap-6 border-b border-border pb-2.5">
                        <dt className="text-muted-foreground shrink-0">Pierce count</dt>
                        <dd className="tabular-nums">{p.pierceCount}</dd>
                      </div>
                      <div className="flex justify-between gap-6 pb-0">
                        <dt className="text-muted-foreground shrink-0">Line price</dt>
                        <dd className="tabular-nums font-semibold text-foreground">
                          {formatQuickQuoteCurrency(lineMaterialSellPreview, currency)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="p-6 min-w-0 flex flex-col bg-muted/10">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
                      Plate geometry
                    </p>
                    <QuotePartGeometryPreview
                      part={p}
                      dxfGeometries={dxfPartGeometries}
                      className="flex-1 border-0 bg-transparent min-h-[240px]"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 text-sm px-6 pb-6">
                  <dl className="space-y-2 sm:col-span-2">
                    {p.sourceRef ? (
                      <div className="flex justify-between gap-4 border-b border-border pb-2">
                        <dt className="text-muted-foreground">Ref</dt>
                        <dd className="font-medium text-right">{p.sourceRef}</dd>
                      </div>
                    ) : null}
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
                      <dd className="tabular-nums">
                        {formatInteger(Math.round(p.thicknessMm))} mm
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Width × length</dt>
                      <dd className="tabular-nums">
                        {formatDecimal(p.widthMm, 2)} × {formatDecimal(p.lengthMm, 2)} mm
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Area (per plate)</dt>
                      <dd className="tabular-nums">{formatDecimal(p.areaM2, 3)} m²</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Total weight (line)</dt>
                      <dd className="tabular-nums">{formatDecimal(totalWeightLine, 2)} kg</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Cut length (per plate)</dt>
                      <dd className="tabular-nums">{formatDecimal(cutLengthM, 2)} m</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Pierce count</dt>
                      <dd className="tabular-nums">{p.pierceCount}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Line price (est.)</dt>
                      <dd className="tabular-nums font-medium">
                        <span className="tabular-nums text-foreground" aria-hidden>
                          {priceHeaderSymbol}
                        </span>{" "}
                        {fmtAmount(p.estimatedLineCost)}
                      </dd>
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
                  <div className="sm:col-span-2">
                    <QuotePartGeometryPreview
                      part={p}
                      dxfGeometries={dxfPartGeometries}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
