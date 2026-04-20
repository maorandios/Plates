"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ValidationRow, ValidationRowStatus } from "../types/quickQuote";

const FILTER_ALL = "__all__";
/** Filter value: rows that are warning or error (shown as “לא תקין”). */
const FILTER_NOT_OK = "__not_ok__";

const VT = "quote.dxfPhase.validationTable";

/** Same amber/orange treatment as “לא תואם” metric cards on the compare screen. */
const MISMATCH_CELL_CLASS =
  "bg-amber-500/[0.06] font-medium text-amber-600 dark:bg-amber-500/[0.08] dark:text-amber-400";

/** Section dividers — physical left edge so header/body align in RTL table. */
const SEC_BORDER = "border-l border-border";
/** Split between Excel | DXF within a section (same token — visible on light surfaces). */
const INNER_BORDER = "border-l border-border";

/** Filter row: paler field fill than default `bg-input` on light theme. */
const FILTER_FIELD_SURFACE = "border-border bg-white dark:bg-input";

function SectionGroupTitle({
  titleKey,
  unitKey,
}: {
  titleKey: string;
  unitKey?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-start leading-tight">
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
        {t(titleKey)}
      </span>
      {unitKey ? (
        <span className="text-[10px] font-normal text-muted-foreground/85">{t(unitKey)}</span>
      ) : null}
    </div>
  );
}

function formatMismatchFieldLabel(field: string): string {
  const map: Record<string, string> = {
    Length: `${VT}.mismatchLength`,
    Width: `${VT}.mismatchWidth`,
    Area: `${VT}.mismatchArea`,
    Weight: `${VT}.mismatchWeight`,
    Material: `${VT}.mismatchMaterial`,
    "DXF file not found": `${VT}.mismatchDxfNotFound`,
  };
  const key = map[field];
  return key ? t(key) : field;
}

function mismatchFieldsHebrew(row: ValidationRow): string {
  return row.mismatchFields.map(formatMismatchFieldLabel).join(" · ");
}

function tooltipReasonText(row: ValidationRow): string {
  if (row.mismatchFields.length === 0) return t(`${VT}.tooltipReasonMatch`);
  return t(`${VT}.tooltipReasonMismatch`, { fields: mismatchFieldsHebrew(row) });
}

function tooltipActionText(row: ValidationRow): string {
  if (row.status === "error") return t(`${VT}.tooltipActionError`);
  if (row.status === "warning") return t(`${VT}.tooltipActionWarning`);
  return t(`${VT}.tooltipActionOk`);
}

function statusBadge(status: ValidationRowStatus) {
  switch (status) {
    case "valid":
      return (
        <Badge
          variant="outline"
          className="border-[#00E35F] bg-[#D2FFEE] font-medium text-[#14765F]"
        >
          {t(`${VT}.exportStatusOk`)}
        </Badge>
      );
    case "warning":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/[0.08] font-medium text-amber-600 dark:text-amber-400"
        >
          {t(`${VT}.exportStatusNotOk`)}
        </Badge>
      );
    case "error":
      return (
        <Badge
          variant="outline"
          className="border-destructive/50 bg-destructive/10 font-medium text-destructive"
        >
          {t(`${VT}.exportStatusNotOk`)}
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

  const resetFilters = () => {
    setStatusFilter(FILTER_ALL);
    setThicknessFilter(FILTER_ALL);
    setMaterialFilter(FILTER_ALL);
    setSearch("");
  };

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
      if (statusFilter !== FILTER_ALL) {
        if (statusFilter === FILTER_NOT_OK) {
          if (r.status === "valid") return false;
        } else if (r.status !== statusFilter) {
          return false;
        }
      }

      if (thicknessFilter !== FILTER_ALL) {
        const tVal = Number.parseFloat(thicknessFilter);
        if (!Number.isFinite(tVal) || Math.abs(r.thicknessMm - tVal) > 1e-6) return false;
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
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t(`${VT}.searchPlaceholder`)}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("h-9 ps-8", FILTER_FIELD_SURFACE)}
            />
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t(`${VT}.filterThicknessLabel`)}
              </span>
              <Select value={thicknessFilter} onValueChange={setThicknessFilter}>
                <SelectTrigger className={cn("h-9 w-full", FILTER_FIELD_SURFACE)}>
                  <SelectValue placeholder={t(`${VT}.allThicknesses`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>{t(`${VT}.allThicknesses`)}</SelectItem>
                  {thicknessOptions.map((th) => (
                    <SelectItem key={th} value={String(th)}>
                      {formatDecimal(th, th % 1 === 0 ? 0 : 2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t(`${VT}.filterMaterialLabel`)}
              </span>
              <Select value={materialFilter} onValueChange={setMaterialFilter}>
                <SelectTrigger className={cn("h-9 w-full", FILTER_FIELD_SURFACE)}>
                  <SelectValue placeholder={t(`${VT}.allMaterials`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>{t(`${VT}.allMaterials`)}</SelectItem>
                  {materialOptions.map((mat) => (
                    <SelectItem key={mat} value={mat}>
                      {mat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t(`${VT}.filterStatusLabel`)}
              </span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={cn("h-9 w-full", FILTER_FIELD_SURFACE)}>
                  <SelectValue placeholder={t(`${VT}.allStatuses`)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>{t(`${VT}.allStatuses`)}</SelectItem>
                  <SelectItem value="valid">{t(`${VT}.statusValid`)}</SelectItem>
                  <SelectItem value="warning">{t(`${VT}.statusWarning`)}</SelectItem>
                  <SelectItem value="error">{t(`${VT}.statusError`)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1.5"
            onClick={resetFilters}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t(`${VT}.resetFilters`)}
          </Button>
        </div>
      </div>

      <TooltipProvider delayDuration={250}>
        <div className="min-w-0 rounded-md border border-border">
          <Table
            dir="rtl"
            className="min-w-[1080px] border-separate border-spacing-0"
            containerClassName="overflow-visible"
          >
            <TableHeader className="sticky top-0 z-40 isolate border-b border-border bg-card shadow-[0_1px_0_0_hsl(var(--border))] [&_th]:bg-card">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead
                  colSpan={3}
                  className="sticky start-0 z-50 min-w-[180px] bg-card py-3 text-start shadow-[1px_0_0_0_hsl(var(--border)/0.35)]"
                >
                  <SectionGroupTitle titleKey={`${VT}.groupGeneral`} />
                </TableHead>
                <TableHead colSpan={2} className={cn("bg-card py-3 text-start", SEC_BORDER)}>
                  <SectionGroupTitle
                    titleKey={`${VT}.groupLength`}
                    unitKey={`${VT}.sectionUnitMm`}
                  />
                </TableHead>
                <TableHead colSpan={2} className={cn("bg-card py-3 text-start", SEC_BORDER)}>
                  <SectionGroupTitle
                    titleKey={`${VT}.groupWidth`}
                    unitKey={`${VT}.sectionUnitMm`}
                  />
                </TableHead>
                <TableHead colSpan={2} className={cn("bg-card py-3 text-start", SEC_BORDER)}>
                  <SectionGroupTitle
                    titleKey={`${VT}.groupArea`}
                    unitKey={`${VT}.sectionUnitM2`}
                  />
                </TableHead>
                <TableHead colSpan={2} className={cn("bg-card py-3 text-start", SEC_BORDER)}>
                  <SectionGroupTitle
                    titleKey={`${VT}.groupWeight`}
                    unitKey={`${VT}.sectionUnitKg`}
                  />
                </TableHead>
                <TableHead colSpan={2} className={cn("bg-card py-3 text-start", SEC_BORDER)}>
                  <SectionGroupTitle titleKey={`${VT}.groupMaterial`} />
                </TableHead>
                <TableHead className={cn("min-w-[88px] bg-card py-3 text-start", SEC_BORDER)}>
                  <SectionGroupTitle titleKey={`${VT}.groupStatus`} />
                </TableHead>
              </TableRow>
              <TableRow className="border-b border-border bg-card hover:bg-transparent [&_th]:bg-card">
                <TableHead
                  className={cn(
                    "sticky start-0 z-50 min-w-[100px] bg-card py-3 text-start text-xs font-medium text-muted-foreground shadow-[1px_0_0_0_hsl(var(--border)/0.35)]",
                    INNER_BORDER
                  )}
                >
                  {t(`${VT}.colPartName`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    INNER_BORDER
                  )}
                >
                  {t(`${VT}.colQty`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    INNER_BORDER
                  )}
                >
                  {t(`${VT}.colThickness`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    SEC_BORDER
                  )}
                >
                  {t(`${VT}.colExcelLength`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    INNER_BORDER
                  )}
                >
                  {t(`${VT}.colDxfLength`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    SEC_BORDER
                  )}
                >
                  {t(`${VT}.colExcelWidth`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    INNER_BORDER
                  )}
                >
                  {t(`${VT}.colDxfWidth`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    SEC_BORDER
                  )}
                >
                  {t(`${VT}.colExcelArea`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    INNER_BORDER
                  )}
                >
                  {t(`${VT}.colDxfArea`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    SEC_BORDER
                  )}
                >
                  {t(`${VT}.colExcelWeight`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    INNER_BORDER
                  )}
                >
                  {t(`${VT}.colDxfWeight`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    SEC_BORDER
                  )}
                >
                  {t(`${VT}.colExcelMaterial`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    INNER_BORDER
                  )}
                >
                  {t(`${VT}.colDxfMaterial`)}
                </TableHead>
                <TableHead
                  className={cn(
                    "min-w-[88px] bg-card py-3 text-start text-xs font-medium text-muted-foreground",
                    SEC_BORDER
                  )}
                >
                  {t(`${VT}.colStatus`)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableCell
                    colSpan={14}
                    className="h-20 text-center text-muted-foreground"
                  >
                    {t(`${VT}.emptyFiltered`)}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className={cn(
                      "border-b border-border",
                      r.status === "error" && "bg-destructive/[0.04]"
                    )}
                  >
                    <TableCell
                      className={cn(
                        "group sticky start-0 z-30 bg-card font-medium shadow-[1px_0_0_0_hsl(var(--border)/0.35)] group-hover:bg-white/[0.04]",
                        INNER_BORDER
                      )}
                    >
                      {r.partName}
                    </TableCell>
                    <TableCell className={cn("tabular-nums text-start", INNER_BORDER)}>
                      {formatInteger(r.qty)}
                    </TableCell>
                    <TableCell className={cn("tabular-nums text-start", INNER_BORDER)}>
                      {formatDecimal(r.thicknessMm, r.thicknessMm % 1 === 0 ? 0 : 2)}
                    </TableCell>
                    <TableCell className={cn("tabular-nums text-start", SEC_BORDER)}>
                      {formatDecimal(r.excelLengthMm, 1)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums text-start",
                        INNER_BORDER,
                        r.excelLengthMm !== r.dxfLengthMm && MISMATCH_CELL_CLASS
                      )}
                    >
                      {formatDecimal(r.dxfLengthMm, 1)}
                    </TableCell>
                    <TableCell className={cn("tabular-nums text-start", SEC_BORDER)}>
                      {formatDecimal(r.excelWidthMm, 1)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums text-start",
                        INNER_BORDER,
                        r.excelWidthMm !== r.dxfWidthMm && MISMATCH_CELL_CLASS
                      )}
                    >
                      {formatDecimal(r.dxfWidthMm, 1)}
                    </TableCell>
                    <TableCell className={cn("tabular-nums text-start", SEC_BORDER)}>
                      {formatDecimal(r.excelAreaM2, 3)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums text-start",
                        INNER_BORDER,
                        Math.abs(r.excelAreaM2 - r.dxfAreaM2) > 0.001 && MISMATCH_CELL_CLASS
                      )}
                    >
                      {formatDecimal(r.dxfAreaM2, 3)}
                    </TableCell>
                    <TableCell className={cn("tabular-nums text-start", SEC_BORDER)}>
                      {formatDecimal(r.excelWeightKg, 1)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "tabular-nums text-start",
                        INNER_BORDER,
                        Math.abs(r.excelWeightKg - r.dxfWeightKg) > 0.05 && MISMATCH_CELL_CLASS
                      )}
                    >
                      {formatDecimal(r.dxfWeightKg, 1)}
                    </TableCell>
                    <TableCell className={cn("text-start text-xs", SEC_BORDER)}>
                      {r.excelMaterial}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-start text-xs",
                        INNER_BORDER,
                        r.excelMaterial !== r.dxfMaterial && MISMATCH_CELL_CLASS
                      )}
                    >
                      {r.dxfMaterial}
                    </TableCell>
                    <TableCell className={cn(SEC_BORDER)}>
                      <div className="flex justify-start">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-block cursor-pointer">{statusBadge(r.status)}</div>
                          </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-sm text-start">
                          <div className="space-y-2 text-xs">
                            {r.mismatchFields.length > 0 && (
                              <div>
                                <p className="font-semibold">{t(`${VT}.tooltipMismatchTitle`)}</p>
                                <p className="text-muted-foreground">{mismatchFieldsHebrew(r)}</p>
                              </div>
                            )}
                            <div>
                              <p className="font-semibold">{t(`${VT}.tooltipReasonTitle`)}</p>
                              <p className="text-muted-foreground">{tooltipReasonText(r)}</p>
                            </div>
                            <div>
                              <p className="font-semibold">{t(`${VT}.tooltipActionTitle`)}</p>
                              <p className="text-muted-foreground">{tooltipActionText(r)}</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>
    </div>
  );
}
