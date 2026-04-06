"use client";

import { useMemo, useState } from "react";
import { ChevronDown, X, Filter, Search, Eye, Trash2, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PartPreviewModal } from "@/components/parts/PartPreviewModal";
import type { Part } from "@/types";
import { cn } from "@/lib/utils";
import {
  estimateDxfTotalWeightKg,
  isExcelDxfFullMatch,
  namePairingSummary,
  validateExcelVsDxf,
} from "@/lib/parts/excelDxfValidation";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import {
  tableAreaHeader,
  tableLengthHeader,
  tablePerimeterHeader,
  tableThicknessHeader,
  tableWeightHeader,
  tableWidthHeader,
} from "@/lib/settings/unitSystem";
import type { UnitSystem } from "@/types/settings";

interface PartsTableProps {
  parts: Part[];
  /** Permanently remove parts from storage (caller should delete DXF + Excel sources). */
  onRemoveParts?: (parts: Part[]) => void;
}

interface Filters {
  partName: string;
  codes: Set<string>;
  thicknesses: Set<string>;
  materials: Set<string>;
  dxfWidths: Set<string>;
  dxfLengths: Set<string>;
  dxfStatus: Set<"present" | "missing">;
  excelDxfDataMatch: Set<"match" | "not_match">;
}

const EMPTY_FILTERS: Filters = {
  partName: "",
  codes: new Set(),
  thicknesses: new Set(),
  materials: new Set(),
  dxfWidths: new Set(),
  dxfLengths: new Set(),
  dxfStatus: new Set(),
  excelDxfDataMatch: new Set(),
};

/** Stable filter key from mm (internal); label is formatted separately for display */
function scalarMmKey(n: number | undefined | null, decimals: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const m = 10 ** decimals;
  return String(Math.round(n * m) / m);
}

/** Green = OK, red = problem (DXF file presence). */
function StatusDot({
  ok,
  title,
  showNativeTitle = true,
}: {
  ok: boolean;
  title?: string;
  showNativeTitle?: boolean;
}) {
  return (
    <span
      className="inline-flex w-full justify-center items-center"
      title={showNativeTitle && title ? title : undefined}
      role="img"
      aria-hidden
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full shrink-0",
          ok ? "bg-emerald-500" : "bg-red-500"
        )}
      />
    </span>
  );
}

const COL_COUNT = 15;

export function PartsTable({ parts, onRemoveParts }: PartsTableProps) {
  const {
    preferences,
    formatLengthValue,
    formatAreaValue,
    formatWeightValue,
  } = useAppPreferences();
  const unitSystem = preferences.unitSystem;

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [previewPart, setPreviewPart] = useState<Part | null>(null);
  const [partPendingDelete, setPartPendingDelete] = useState<Part | null>(null);

  const options = useMemo(() => {
    const thMap = new Map<string, string>();
    for (const p of parts) {
      const k = scalarMmKey(p.thickness, 6);
      if (!thMap.has(k)) {
        thMap.set(k, k === "—" ? "—" : formatLengthValue(p.thickness!));
      }
    }
    const thicknesses = [...thMap.keys()].sort((a, b) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return Number(a) - Number(b);
    });
    const thicknessLabels = Object.fromEntries(thMap) as Record<string, string>;

    const wMap = new Map<string, string>();
    for (const p of parts) {
      const k = scalarMmKey(p.dxfWidthMm, 1);
      if (!wMap.has(k)) {
        wMap.set(k, k === "—" ? "—" : formatLengthValue(p.dxfWidthMm!));
      }
    }
    const dxfWidths = [...wMap.keys()].sort((a, b) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return Number(a) - Number(b);
    });
    const dxfWidthLabels = Object.fromEntries(wMap) as Record<string, string>;

    const lMap = new Map<string, string>();
    for (const p of parts) {
      const k = scalarMmKey(p.dxfLengthMm, 1);
      if (!lMap.has(k)) {
        lMap.set(k, k === "—" ? "—" : formatLengthValue(p.dxfLengthMm!));
      }
    }
    const dxfLengths = [...lMap.keys()].sort((a, b) => {
      if (a === "—") return 1;
      if (b === "—") return -1;
      return Number(a) - Number(b);
    });
    const dxfLengthLabels = Object.fromEntries(lMap) as Record<string, string>;

    const materials = [...new Set(parts.map((p) => p.material ?? "—"))].sort();
    const codes = [...new Set(parts.map((p) => p.clientCode))].sort();
    return {
      thicknesses,
      thicknessLabels,
      materials,
      codes,
      dxfWidths,
      dxfWidthLabels,
      dxfLengths,
      dxfLengthLabels,
    };
  }, [parts, formatLengthValue]);

  const filtered = useMemo(() => {
    return parts.filter((p) => {
      if (
        filters.partName &&
        !p.partName.toLowerCase().includes(filters.partName.toLowerCase())
      )
        return false;
      if (filters.codes.size > 0 && !filters.codes.has(p.clientCode))
        return false;
      if (
        filters.thicknesses.size > 0 &&
        !filters.thicknesses.has(scalarMmKey(p.thickness, 6))
      )
        return false;
      if (
        filters.materials.size > 0 &&
        !filters.materials.has(p.material ?? "—")
      )
        return false;
      if (filters.dxfWidths.size > 0 && !filters.dxfWidths.has(scalarMmKey(p.dxfWidthMm, 1)))
        return false;
      if (filters.dxfLengths.size > 0 && !filters.dxfLengths.has(scalarMmKey(p.dxfLengthMm, 1)))
        return false;
      if (filters.dxfStatus.size > 0 && !filters.dxfStatus.has(p.dxfStatus))
        return false;
      if (filters.excelDxfDataMatch.size > 0) {
        const bucket = isExcelDxfFullMatch(p) ? "match" : "not_match";
        if (!filters.excelDxfDataMatch.has(bucket)) return false;
      }
      return true;
    });
  }, [parts, filters]);

  const activeFilterCount =
    (filters.partName ? 1 : 0) +
    filters.codes.size +
    filters.thicknesses.size +
    filters.materials.size +
    filters.dxfWidths.size +
    filters.dxfLengths.size +
    filters.dxfStatus.size +
    filters.excelDxfDataMatch.size;

  function toggleSetFilter<T extends string>(
    key: keyof Omit<Filters, "partName">,
    value: T,
    checked: boolean
  ) {
    setFilters((prev) => {
      const next = new Set(prev[key] as Set<T>);
      checked ? next.add(value) : next.delete(value);
      return { ...prev, [key]: next };
    });
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
  }

  const EXCEL_MATCH_FILTER_LABELS: Record<"match" | "not_match", string> = {
    match: "Match",
    not_match: "No match",
  };
  const PRESENCE_LABELS: Record<"present" | "missing", string> = {
    present: "Present",
    missing: "Missing",
  };

  function confirmDeletePart() {
    if (!onRemoveParts || !partPendingDelete) return;
    if (previewPart?.id === partPendingDelete.id) setPreviewPart(null);
    onRemoveParts([partPendingDelete]);
    setPartPendingDelete(null);
  }

  return (
    <TooltipProvider delayDuration={200}>
      {previewPart && (
        <PartPreviewModal
          part={previewPart}
          open={true}
          onClose={() => setPreviewPart(null)}
        />
      )}

      <Dialog
        open={partPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPartPendingDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete this plate permanently?</DialogTitle>
            <DialogDescription>
              This removes the plate from the parts table and deletes the linked DXF and/or Excel
              data below. It will not come back after Rebuild Table. This cannot be undone.
            </DialogDescription>
            {partPendingDelete && (
              <ul className="list-disc pl-4 space-y-1.5 text-sm text-foreground pt-2">
                {partPendingDelete.dxfFileId && (
                  <li>
                    <span className="text-muted-foreground">DXF file: </span>
                    {partPendingDelete.dxfFileName?.trim()
                      ? partPendingDelete.dxfFileName
                      : "linked drawing"}
                  </li>
                )}
                {partPendingDelete.excelRowId && (
                  <li>
                    <span className="text-muted-foreground">Excel row: </span>
                    {partPendingDelete.partName?.trim()
                      ? partPendingDelete.partName
                      : "linked list row"}
                  </li>
                )}
                {!partPendingDelete.dxfFileId && !partPendingDelete.excelRowId && (
                  <li className="text-amber-800 list-none -ml-4 pl-0">
                    No DXF or Excel row is linked — only this table row will be removed.
                  </li>
                )}
              </ul>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPartPendingDelete(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDeletePart}>
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
              <Filter className="h-3 w-3" />
              Filtered:
            </span>

            {filters.partName && (
              <FilterChip
                label={`"${filters.partName}"`}
                onRemove={() => setFilters((f) => ({ ...f, partName: "" }))}
              />
            )}
            {[...filters.codes].map((v) => (
              <FilterChip key={`k:${v}`} label={v} mono onRemove={() => toggleSetFilter("codes", v, false)} />
            ))}
            {[...filters.thicknesses].map((v) => (
              <FilterChip
                key={`t:${v}`}
                label={options.thicknessLabels[v] ?? v}
                onRemove={() => toggleSetFilter("thicknesses", v, false)}
              />
            ))}
            {[...filters.materials].map((v) => (
              <FilterChip key={`m:${v}`} label={v} onRemove={() => toggleSetFilter("materials", v, false)} />
            ))}
            {[...filters.dxfWidths].map((v) => (
              <FilterChip
                key={`w:${v}`}
                label={`W: ${options.dxfWidthLabels[v] ?? v}`}
                onRemove={() => toggleSetFilter("dxfWidths", v, false)}
              />
            ))}
            {[...filters.dxfLengths].map((v) => (
              <FilterChip
                key={`l:${v}`}
                label={`L: ${options.dxfLengthLabels[v] ?? v}`}
                onRemove={() => toggleSetFilter("dxfLengths", v, false)}
              />
            ))}
            {[...filters.dxfStatus].map((v) => (
              <FilterChip
                key={`d:${v}`}
                label={`DXF: ${PRESENCE_LABELS[v]}`}
                onRemove={() => toggleSetFilter("dxfStatus", v, false)}
              />
            ))}
            {[...filters.excelDxfDataMatch].map((v) => (
              <FilterChip
                key={`s:${v}`}
                label={EXCEL_MATCH_FILTER_LABELS[v]}
                onRemove={() => toggleSetFilter("excelDxfDataMatch", v, false)}
              />
            ))}

            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={clearAll}
            >
              Clear all
            </Button>
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
              {filtered.length} / {parts.length} parts
            </span>
          </div>
        )}

        <div className="rounded-xl overflow-x-auto">
          <Table className="min-w-[1180px]">
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border">
                <TableHead
                  colSpan={4}
                  className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-2"
                >
                  General
                </TableHead>
                <TableHead
                  colSpan={6}
                  className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-2 border-l border-border"
                >
                  DXF plate parameters
                </TableHead>
                <TableHead
                  colSpan={3}
                  className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-2 border-l border-border"
                >
                  Validations
                </TableHead>
                <TableHead
                  colSpan={2}
                  className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-2 border-l border-border"
                >
                  Actions
                </TableHead>
              </TableRow>

              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-semibold text-foreground w-[84px]">
                  <FilterableHeader
                    label="Client code"
                    options={options.codes}
                    selected={filters.codes}
                    onToggle={(v, c) => toggleSetFilter("codes", v, c)}
                    onClear={() => setFilters((f) => ({ ...f, codes: new Set() }))}
                    mono
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground w-[160px]">
                  <TextSearchHeader
                    label="Part name"
                    value={filters.partName}
                    onChange={(v) => setFilters((f) => ({ ...f, partName: v }))}
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground text-center w-[52px]">Qty</TableHead>
                <TableHead className="font-semibold text-foreground text-center w-[88px]">
                  <FilterableHeader
                    label={tableThicknessHeader(unitSystem)}
                    options={options.thicknesses}
                    selected={filters.thicknesses}
                    onToggle={(v, c) => toggleSetFilter("thicknesses", v, c)}
                    onClear={() => setFilters((f) => ({ ...f, thicknesses: new Set() }))}
                    align="center"
                    labelMap={options.thicknessLabels}
                  />
                </TableHead>

                <TableHead className="font-semibold text-foreground text-center w-[78px] border-l border-border">
                  <FilterableHeader
                    label={tableWidthHeader(unitSystem)}
                    options={options.dxfWidths}
                    selected={filters.dxfWidths}
                    onToggle={(v, c) => toggleSetFilter("dxfWidths", v, c)}
                    onClear={() => setFilters((f) => ({ ...f, dxfWidths: new Set() }))}
                    align="center"
                    labelMap={options.dxfWidthLabels}
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground text-center w-[78px]">
                  <FilterableHeader
                    label={tableLengthHeader(unitSystem)}
                    options={options.dxfLengths}
                    selected={filters.dxfLengths}
                    onToggle={(v, c) => toggleSetFilter("dxfLengths", v, c)}
                    onClear={() => setFilters((f) => ({ ...f, dxfLengths: new Set() }))}
                    align="center"
                    labelMap={options.dxfLengthLabels}
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground text-center w-[88px]">
                  {tableAreaHeader(unitSystem)}
                </TableHead>
                <TableHead className="font-semibold text-foreground text-center min-w-[100px] text-balance leading-tight">
                  {tableWeightHeader(unitSystem)}
                </TableHead>
                <TableHead className="font-semibold text-foreground min-w-[100px]">
                  <FilterableHeader
                    label="Material"
                    options={options.materials}
                    selected={filters.materials}
                    onToggle={(v, c) => toggleSetFilter("materials", v, c)}
                    onClear={() => setFilters((f) => ({ ...f, materials: new Set() }))}
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground text-center w-[88px]">
                  {tablePerimeterHeader(unitSystem)}
                </TableHead>

                <TableHead className="font-semibold text-foreground text-center w-[76px] border-l border-border">
                  Geometry prep
                </TableHead>

                <TableHead className="font-semibold text-foreground text-center w-[88px]">
                  <FilterableHeader
                    label="DXF file"
                    options={["present", "missing"]}
                    selected={filters.dxfStatus}
                    onToggle={(v, c) => toggleSetFilter("dxfStatus", v as "present" | "missing", c)}
                    onClear={() => setFilters((f) => ({ ...f, dxfStatus: new Set() }))}
                    align="center"
                    labelMap={PRESENCE_LABELS}
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground min-w-[120px]">
                  <FilterableHeader
                    label="Excel match"
                    options={["match", "not_match"]}
                    selected={filters.excelDxfDataMatch}
                    onToggle={(v, c) =>
                      toggleSetFilter("excelDxfDataMatch", v as "match" | "not_match", c)
                    }
                    onClear={() => setFilters((f) => ({ ...f, excelDxfDataMatch: new Set() }))}
                    labelMap={EXCEL_MATCH_FILTER_LABELS}
                  />
                </TableHead>

                <TableHead className="font-semibold text-foreground text-center w-[56px] border-l border-border">
                  Preview
                </TableHead>
                <TableHead className="font-semibold text-foreground text-center w-[56px]">Delete</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COL_COUNT} className="text-center py-12 text-muted-foreground text-sm">
                    No parts match the active filters.{" "}
                    <button className="underline hover:text-foreground" onClick={clearAll}>
                      Clear filters
                    </button>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((part) => (
                  <PartsDataRow
                    key={part.id}
                    part={part}
                    unitSystem={unitSystem}
                    formatLengthValue={formatLengthValue}
                    formatAreaValue={formatAreaValue}
                    formatWeightValue={formatWeightValue}
                    onPreview={() => setPreviewPart(part)}
                    canDelete={Boolean(onRemoveParts)}
                    onRequestDelete={() => setPartPendingDelete(part)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

function GeometryPrepCell({ part }: { part: Part }) {
  if (part.dxfStatus !== "present") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const st = part.geometryCleanupStatus;
  if (!st) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const label = st === "ready" ? "Ready" : st === "warning" ? "Warning" : "Error";
  const summary = part.geometryContourSummary;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex w-full justify-center items-center rounded-md p-1 -m-1 border-0 bg-transparent cursor-help"
          aria-label={`Geometry preparation: ${label}`}
        >
          <Badge
            variant="outline"
            className={
              st === "ready"
                ? "text-emerald-800 border-emerald-300 bg-emerald-50 text-[10px] font-semibold px-1.5"
                : st === "warning"
                  ? "text-amber-900 border-amber-300 bg-amber-50 text-[10px] font-semibold px-1.5"
                  : "text-destructive border-destructive/40 bg-destructive/10 text-[10px] font-semibold px-1.5"
            }
          >
            {label}
          </Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-xs space-y-1">
        <p className="font-semibold text-foreground">{label}</p>
        {summary && <p className="text-muted-foreground">{summary}</p>}
        {part.geometryPrepMessages && part.geometryPrepMessages.length > 0 && (
          <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
            {part.geometryPrepMessages.slice(0, 8).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function PartsDataRow({
  part,
  unitSystem,
  formatLengthValue,
  formatAreaValue,
  formatWeightValue,
  onPreview,
  canDelete,
  onRequestDelete,
}: {
  part: Part;
  unitSystem: UnitSystem;
  formatLengthValue: (mm: number) => string;
  formatAreaValue: (m2: number) => string;
  formatWeightValue: (kg: number) => string;
  onPreview: () => void;
  canDelete: boolean;
  onRequestDelete: () => void;
}) {
  const dxfTot = useMemo(() => estimateDxfTotalWeightKg(part), [part]);
  const densityHint =
    unitSystem === "metric"
      ? "Steel 7850 kg/m³ × net DXF area × thickness × qty"
      : "Steel 7850 kg/m³ × net DXF area × thickness × qty (weight shown in lb)";

  return (
    <TableRow className="border-b border-border bg-white hover:bg-white data-[state=selected]:bg-white">
      <TableCell>
        <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-xs font-bold font-mono tracking-wider">
          {part.clientCode?.trim() ? part.clientCode : <span className="text-primary-foreground/80">—</span>}
        </span>
      </TableCell>
      <TableCell className="font-medium text-foreground">
        <div className="inline-flex flex-wrap items-center gap-2">
          <span>
            {part.partName || (
              <span className="text-muted-foreground italic">—</span>
            )}
          </span>
          {part.partSource === "built" && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 font-normal"
            >
              Built
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums">
        {part.quantity ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums">
        {part.thickness != null ? (
          formatLengthValue(part.thickness)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="text-center text-sm border-l border-border tabular-nums">
        {part.dxfWidthMm != null ? (
          formatLengthValue(part.dxfWidthMm)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums">
        {part.dxfLengthMm != null ? (
          formatLengthValue(part.dxfLengthMm)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums">
        {part.dxfArea != null ? (
          formatAreaValue(part.dxfArea / 1_000_000)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell
        className="text-center text-sm tabular-nums text-muted-foreground"
        title={densityHint}
      >
        {dxfTot != null ? formatWeightValue(dxfTot) : "—"}
      </TableCell>
      <TableCell className="text-sm">
        {part.material || <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums">
        {part.dxfPerimeter != null && part.dxfPerimeter > 0 ? (
          formatLengthValue(part.dxfPerimeter)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="text-center border-l border-border px-1">
        <GeometryPrepCell part={part} />
      </TableCell>

      <TableCell className="text-center">
        <StatusDot
          ok={part.dxfStatus === "present"}
          title={part.dxfStatus === "present" ? "DXF file present" : "DXF file missing"}
        />
      </TableCell>
      <TableCell className="text-center">
        <ExcelMatchCell part={part} unitSystem={unitSystem} />
      </TableCell>

      <TableCell className="text-center border-l border-border">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onPreview}
          disabled={!part.dxfFileId}
          aria-label="Preview"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
      <TableCell className="text-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onRequestDelete}
          disabled={!canDelete}
          aria-label="Delete plate"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ExcelMatchCell({
  part,
  unitSystem,
}: {
  part: Part;
  unitSystem: UnitSystem;
}) {
  const validation = useMemo(
    () => validateExcelVsDxf(part, { unitSystem }),
    [part, unitSystem]
  );
  const dataMatch = isExcelDxfFullMatch(part);
  const nameHint = namePairingSummary(part);

  if (dataMatch) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex w-full justify-center items-center rounded-md p-1 -m-1 border-0 bg-transparent cursor-default"
            aria-label="Excel data matches DXF plate parameters"
          >
            <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-emerald-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-sm text-xs">
          <p className="font-semibold text-foreground mb-1">Excel match</p>
          <p className="text-emerald-800 leading-snug">
            Excel list matches DXF dimensions, area, and total weight (same rules as before).
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex w-full justify-center items-center cursor-help rounded-md p-1 -m-1 hover:bg-muted/40 transition-colors border-0 bg-transparent text-orange-500"
          aria-label="Excel does not match DXF — show details"
        >
          <Info className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" align="start" className="max-w-sm p-3 text-xs space-y-2">
        <div>
          <p className="font-semibold text-foreground mb-1">Excel match — issues</p>
          {part.dxfStatus !== "present" || part.geometryStatus === "error" ? (
            <p className="text-orange-800 leading-snug">
              DXF is missing or geometry is invalid — cannot verify Excel against DXF.
            </p>
          ) : (
            <p className="text-orange-800 leading-snug">
              Excel W, L, area, or total weight does not match DXF (see below).
            </p>
          )}
          {!validation.compared && validation.issues[0] && (
            <p className="text-muted-foreground mt-2 leading-snug">{validation.issues[0]}</p>
          )}
          {validation.compared && validation.status === "mismatch" && (
            <ul className="list-disc pl-4 space-y-1 text-orange-950 leading-snug mt-2">
              {validation.issues.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
          {validation.compared && validation.status === "ok" && (
            <p className="text-muted-foreground mt-2 leading-snug">
              Partial agreement only — full match requires Excel W, L, area, and reference total weight vs DXF.
            </p>
          )}
        </div>
        <div className="border-t border-border pt-2">
          <p className="font-semibold text-foreground mb-1">Name / file pairing</p>
          <p className="text-muted-foreground leading-snug">{nameHint}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── TextSearchHeader ─────────────────────────────────────────────────────────

interface TextSearchHeaderProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function TextSearchHeader({ label, value, onChange }: TextSearchHeaderProps) {
  const isActive = value.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 group rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-muted",
            isActive ? "text-primary" : "text-foreground"
          )}
        >
          <span className="font-semibold text-sm">{label}</span>
          {isActive && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full leading-none"
            >
              1
            </Badge>
          )}
          <Search
            className={cn(
              "h-3 w-3 transition-colors shrink-0",
              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56 p-2" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground py-1 px-0">
          Search Part Name
        </DropdownMenuLabel>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-7 h-8 text-sm"
            placeholder="Type to search…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
          />
          {value && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => onChange("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {value && (
          <p className="text-xs text-muted-foreground mt-1.5 px-0.5">
            Searching for <span className="font-medium text-foreground">"{value}"</span>
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── FilterableHeader ─────────────────────────────────────────────────────────

interface FilterableHeaderProps {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string, checked: boolean) => void;
  onClear: () => void;
  mono?: boolean;
  align?: "left" | "center";
  labelMap?: Record<string, string>;
}

function FilterableHeader({
  label,
  options,
  selected,
  onToggle,
  onClear,
  mono = false,
  align = "left",
  labelMap,
}: FilterableHeaderProps) {
  const isActive = selected.size > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 group rounded px-1 -mx-1 py-0.5 transition-colors hover:bg-muted",
            align === "center" && "mx-auto",
            isActive ? "text-primary" : "text-foreground"
          )}
        >
          <span className="font-semibold text-sm">{label}</span>
          {isActive && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full leading-none"
            >
              {selected.size}
            </Badge>
          )}
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-colors shrink-0",
              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[160px]">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground py-1">
          Filter by {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt}
            checked={selected.has(opt)}
            onCheckedChange={(c) => onToggle(opt, c)}
            className={cn("text-sm", mono && "font-mono")}
          >
            {labelMap?.[opt] ?? opt}
          </DropdownMenuCheckboxItem>
        ))}

        {selected.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <button
              className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={onClear}
            >
              Clear filter
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── FilterChip ───────────────────────────────────────────────────────────────

function FilterChip({
  label,
  onRemove,
  mono = false,
}: {
  label: string;
  onRemove: () => void;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-foreground",
        mono && "font-mono"
      )}
    >
      {label}
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}
