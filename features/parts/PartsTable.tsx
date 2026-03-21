"use client";

import { useMemo, useState } from "react";
import { ChevronDown, X, Filter, Search, Eye } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PartPreviewModal } from "@/components/parts/PartPreviewModal";
import type { MatchStatus, Part } from "@/types";
import { cn } from "@/lib/utils";
import {
  estimateDxfTotalWeightKg,
  excelReferenceTotalKg,
  getExcelFieldMismatchFlags,
  namePairingSummary,
  validateExcelVsDxf,
} from "@/lib/parts/excelDxfValidation";

interface PartsTableProps {
  parts: Part[];
}

interface Filters {
  partName: string;
  clients: Set<string>;
  codes: Set<string>;
  thicknesses: Set<string>;
  materials: Set<string>;
  widths: Set<string>;
  lengths: Set<string>;
  dxfStatus: Set<"present" | "missing">;
  matchStatus: Set<MatchStatus>;
}

const EMPTY_FILTERS: Filters = {
  partName: "",
  clients: new Set(),
  codes: new Set(),
  thicknesses: new Set(),
  materials: new Set(),
  widths: new Set(),
  lengths: new Set(),
  dxfStatus: new Set(),
  matchStatus: new Set(),
};

function toThicknessLabel(t: number | undefined) {
  return t != null ? `${t} mm` : "—";
}
function toDimLabel(v: number | undefined) {
  return v != null ? `${v}` : "—";
}
function fmt(v: number | undefined, unit = "") {
  return v != null ? `${v}${unit}` : null;
}

const EXCEL_MISMATCH_BG = "bg-red-50 dark:bg-red-950/25";

/** Green = OK, red = problem (only two states). */
function StatusDot({
  ok,
  title,
  showNativeTitle = true,
}: {
  ok: boolean;
  /** Native browser tooltip (disabled when using Radix Tooltip on parent). */
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

export function PartsTable({ parts }: PartsTableProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [previewPart, setPreviewPart] = useState<Part | null>(null);

  // ── Option lists ──────────────────────────────────────────────────────────
  const options = useMemo(() => {
    const clients = [...new Set(parts.map((p) => p.clientName))].sort();
    const codes = [...new Set(parts.map((p) => p.clientCode))].sort();
    const thicknesses = [...new Set(parts.map((p) => toThicknessLabel(p.thickness)))].sort(
      (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)
    );
    const materials = [...new Set(parts.map((p) => p.material ?? "—"))].sort();
    const widths = [...new Set(parts.map((p) => toDimLabel(p.width)))].sort(
      (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)
    );
    const lengths = [...new Set(parts.map((p) => toDimLabel(p.length)))].sort(
      (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0)
    );
    return { clients, codes, thicknesses, materials, widths, lengths };
  }, [parts]);

  // ── Apply all filters ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return parts.filter((p) => {
      if (
        filters.partName &&
        !p.partName.toLowerCase().includes(filters.partName.toLowerCase())
      )
        return false;
      if (filters.clients.size > 0 && !filters.clients.has(p.clientName))
        return false;
      if (filters.codes.size > 0 && !filters.codes.has(p.clientCode))
        return false;
      if (
        filters.thicknesses.size > 0 &&
        !filters.thicknesses.has(toThicknessLabel(p.thickness))
      )
        return false;
      if (
        filters.materials.size > 0 &&
        !filters.materials.has(p.material ?? "—")
      )
        return false;
      if (filters.widths.size > 0 && !filters.widths.has(toDimLabel(p.width)))
        return false;
      if (filters.lengths.size > 0 && !filters.lengths.has(toDimLabel(p.length)))
        return false;
      if (filters.dxfStatus.size > 0 && !filters.dxfStatus.has(p.dxfStatus))
        return false;
      if (
        filters.matchStatus.size > 0 &&
        !filters.matchStatus.has(p.matchStatus)
      )
        return false;
      return true;
    });
  }, [parts, filters]);

  const activeFilterCount =
    (filters.partName ? 1 : 0) +
    filters.clients.size +
    filters.codes.size +
    filters.thicknesses.size +
    filters.materials.size +
    filters.widths.size +
    filters.lengths.size +
    filters.dxfStatus.size +
    filters.matchStatus.size;

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

  // ── Match status label helpers ────────────────────────────────────────────
  const MATCH_LABELS: Record<MatchStatus, string> = {
    matched: "Matched",
    needs_review: "Needs Review",
    unmatched: "Unmatched",
  };
  const PRESENCE_LABELS: Record<"present" | "missing", string> = {
    present: "Present",
    missing: "Missing",
  };

  return (
    <TooltipProvider delayDuration={200}>
      {previewPart && (
        <PartPreviewModal
          part={previewPart}
          open={true}
          onClose={() => setPreviewPart(null)}
        />
      )}

      <div className="space-y-3">
      {/* ── Active filter chips ──────────────────────────────────────────── */}
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
          {[...filters.clients].map((v) => (
            <FilterChip key={`c:${v}`} label={v} onRemove={() => toggleSetFilter("clients", v, false)} />
          ))}
          {[...filters.codes].map((v) => (
            <FilterChip key={`k:${v}`} label={v} mono onRemove={() => toggleSetFilter("codes", v, false)} />
          ))}
          {[...filters.thicknesses].map((v) => (
            <FilterChip key={`t:${v}`} label={v} onRemove={() => toggleSetFilter("thicknesses", v, false)} />
          ))}
          {[...filters.materials].map((v) => (
            <FilterChip key={`m:${v}`} label={v} onRemove={() => toggleSetFilter("materials", v, false)} />
          ))}
          {[...filters.widths].map((v) => (
            <FilterChip key={`w:${v}`} label={`W: ${v}`} onRemove={() => toggleSetFilter("widths", v, false)} />
          ))}
          {[...filters.lengths].map((v) => (
            <FilterChip key={`l:${v}`} label={`L: ${v}`} onRemove={() => toggleSetFilter("lengths", v, false)} />
          ))}
          {[...filters.dxfStatus].map((v) => (
            <FilterChip key={`d:${v}`} label={`DXF: ${PRESENCE_LABELS[v]}`} onRemove={() => toggleSetFilter("dxfStatus", v, false)} />
          ))}
          {[...filters.matchStatus].map((v) => (
            <FilterChip key={`s:${v}`} label={MATCH_LABELS[v]} onRemove={() => toggleSetFilter("matchStatus", v, false)} />
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

      {/* ── Table (grouped headers: General | Excel | DXF | Validation) ───── */}
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            {/* Section labels */}
            <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border">
              <TableHead
                colSpan={6}
                className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-2"
              >
                General
              </TableHead>
              <TableHead
                colSpan={4}
                className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-2 border-l border-border"
              >
                Excel list
              </TableHead>
              <TableHead
                colSpan={4}
                className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-2 border-l border-border"
              >
                DXF
              </TableHead>
              <TableHead
                colSpan={3}
                className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-2 border-l border-border"
              >
                Validation
              </TableHead>
            </TableRow>

            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="font-semibold text-foreground w-[170px]">
                <TextSearchHeader
                  label="Part name"
                  value={filters.partName}
                  onChange={(v) => setFilters((f) => ({ ...f, partName: v }))}
                />
              </TableHead>
              <TableHead className="font-semibold text-foreground min-w-[100px]">
                <FilterableHeader
                  label="Client"
                  options={options.clients}
                  selected={filters.clients}
                  onToggle={(v, c) => toggleSetFilter("clients", v, c)}
                  onClear={() => setFilters((f) => ({ ...f, clients: new Set() }))}
                />
              </TableHead>
              <TableHead className="font-semibold text-foreground w-[84px]">
                <FilterableHeader
                  label="Code"
                  options={options.codes}
                  selected={filters.codes}
                  onToggle={(v, c) => toggleSetFilter("codes", v, c)}
                  onClear={() => setFilters((f) => ({ ...f, codes: new Set() }))}
                  mono
                />
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center w-[56px]">
                Qty
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center w-[100px]">
                <FilterableHeader
                  label="Thk"
                  options={options.thicknesses}
                  selected={filters.thicknesses}
                  onToggle={(v, c) => toggleSetFilter("thicknesses", v, c)}
                  onClear={() => setFilters((f) => ({ ...f, thicknesses: new Set() }))}
                  align="center"
                />
              </TableHead>
              <TableHead className="font-semibold text-foreground w-[100px]">
                <FilterableHeader
                  label="Material"
                  options={options.materials}
                  selected={filters.materials}
                  onToggle={(v, c) => toggleSetFilter("materials", v, c)}
                  onClear={() => setFilters((f) => ({ ...f, materials: new Set() }))}
                />
              </TableHead>

              <TableHead className="font-semibold text-foreground text-center w-[78px] border-l border-border">
                <FilterableHeader
                  label="W mm"
                  options={options.widths}
                  selected={filters.widths}
                  onToggle={(v, c) => toggleSetFilter("widths", v, c)}
                  onClear={() => setFilters((f) => ({ ...f, widths: new Set() }))}
                  align="center"
                />
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center w-[78px]">
                <FilterableHeader
                  label="L mm"
                  options={options.lengths}
                  selected={filters.lengths}
                  onToggle={(v, c) => toggleSetFilter("lengths", v, c)}
                  onClear={() => setFilters((f) => ({ ...f, lengths: new Set() }))}
                  align="center"
                />
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center w-[88px]">
                Area m²
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center w-[88px]">
                Wt total kg
              </TableHead>

              <TableHead className="font-semibold text-foreground text-center w-[78px] border-l border-border">
                W mm
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center w-[78px]">
                L mm
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center w-[88px]">
                Area m²
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center w-[100px] text-balance leading-tight">
                Est. wt total kg
              </TableHead>

              <TableHead className="font-semibold text-foreground text-center w-[88px] border-l border-border">
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
                  label="Match status"
                  options={["matched", "needs_review", "unmatched"]}
                  selected={filters.matchStatus}
                  onToggle={(v, c) => toggleSetFilter("matchStatus", v as MatchStatus, c)}
                  onClear={() => setFilters((f) => ({ ...f, matchStatus: new Set() }))}
                  labelMap={MATCH_LABELS}
                />
              </TableHead>
              <TableHead className="font-semibold text-foreground text-center w-[72px]">
                Preview
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center py-12 text-muted-foreground text-sm">
                  No parts match the active filters.{" "}
                  <button className="underline hover:text-foreground" onClick={clearAll}>
                    Clear filters
                  </button>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((part) => (
                <PartsDataRow key={part.id} part={part} onPreview={() => setPreviewPart(part)} />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    </TooltipProvider>
  );
}

// ─── Row with Excel↔DXF validation + match tooltip ───────────────────────────

function PartsDataRow({ part, onPreview }: { part: Part; onPreview: () => void }) {
  const validation = useMemo(() => validateExcelVsDxf(part), [part]);
  const excelMismatch = useMemo(() => getExcelFieldMismatchFlags(part), [part]);
  const dxfTot = useMemo(() => estimateDxfTotalWeightKg(part), [part]);
  const excelTot = useMemo(() => excelReferenceTotalKg(part), [part]);

  return (
    <TableRow className="border-b border-border bg-white hover:bg-white data-[state=selected]:bg-white">
      <TableCell className="font-medium text-foreground">
        {part.partName || <span className="text-muted-foreground italic">—</span>}
      </TableCell>
      <TableCell className="text-sm text-foreground">{part.clientName}</TableCell>
      <TableCell>
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-xs font-bold font-mono tracking-wider">
          {part.clientCode}
        </span>
      </TableCell>
      <TableCell className="text-center text-sm">
        {part.quantity ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="text-center text-sm">
        {part.thickness != null ? (
          `${part.thickness} mm`
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {part.material || <span className="text-muted-foreground">—</span>}
      </TableCell>

      <TableCell
        className={cn(
          "text-center text-sm border-l border-border",
          excelMismatch.width && EXCEL_MISMATCH_BG
        )}
      >
        {fmt(part.width, " mm") ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell
        className={cn("text-center text-sm", excelMismatch.length && EXCEL_MISMATCH_BG)}
      >
        {fmt(part.length, " mm") ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell
        className={cn(
          "text-center text-sm tabular-nums",
          excelMismatch.area && EXCEL_MISMATCH_BG
        )}
      >
        {part.area != null ? part.area.toFixed(4) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell
        className={cn(
          "text-center text-sm font-medium tabular-nums",
          excelMismatch.weight && EXCEL_MISMATCH_BG
        )}
      >
        {excelTot != null ? (
          `${excelTot.toFixed(2)} kg`
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="text-center text-sm border-l border-border tabular-nums">
        {part.dxfWidthMm != null ? (
          `${part.dxfWidthMm.toFixed(1)} mm`
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums">
        {part.dxfLengthMm != null ? (
          `${part.dxfLengthMm.toFixed(1)} mm`
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums">
        {part.dxfArea != null ? (
          (part.dxfArea / 1_000_000).toFixed(4)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center text-sm tabular-nums text-muted-foreground" title="Steel 7850 kg/m³ × net area × thickness × qty">
        {dxfTot != null ? `${dxfTot.toFixed(2)} kg` : "—"}
      </TableCell>

      <TableCell className="text-center border-l border-border">
        <StatusDot
          ok={part.dxfStatus === "present"}
          title={part.dxfStatus === "present" ? "DXF file present" : "DXF file missing"}
        />
      </TableCell>
      <TableCell>
        <MatchStatusWithValidationTooltip part={part} validation={validation} />
      </TableCell>
      <TableCell className="text-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onPreview}
          disabled={!part.dxfFileId}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function MatchStatusWithValidationTooltip({
  part,
  validation,
}: {
  part: Part;
  validation: ReturnType<typeof validateExcelVsDxf>;
}) {
  const nameHint = namePairingSummary(part);
  const matchOk = part.matchStatus === "matched";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex w-full justify-center items-center cursor-help rounded-md p-1 -m-1 hover:bg-muted/40 transition-colors border-0 bg-transparent"
          aria-label={
            matchOk
              ? "Name pairing: matched"
              : part.matchStatus === "needs_review"
                ? "Name pairing: needs review"
                : "Name pairing: unmatched"
          }
        >
          <StatusDot ok={matchOk} showNativeTitle={false} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" align="start" className="max-w-sm p-3 text-xs space-y-2">
        <div>
          <p className="font-semibold text-foreground mb-1">Name / file pairing</p>
          <p className="text-muted-foreground leading-snug">{nameHint}</p>
        </div>
        {part.excelStatus === "present" &&
          part.dxfStatus === "present" &&
          part.dxfArea != null &&
          part.geometryStatus !== "error" && (
            <div className="border-t border-border pt-2">
              <p className="font-semibold text-foreground mb-1">Excel list vs DXF geometry</p>
              {!validation.compared && (
                <p className="text-muted-foreground leading-snug">
                  {validation.issues[0] ?? "—"}
                </p>
              )}
              {validation.compared && validation.status === "ok" && (
                <p className="text-emerald-700 leading-snug">
                  Width, length, area, and estimated total weight agree within tolerance (W/L
                  compared as sorted spans; weight uses 7850 kg/m³ steel).
                </p>
              )}
              {validation.compared && validation.status === "mismatch" && (
                <ul className="list-disc pl-4 space-y-1 text-amber-950 leading-snug">
                  {validation.issues.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-muted text-xs text-foreground",
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
