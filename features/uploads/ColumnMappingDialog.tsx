"use client";

import { useState, useMemo } from "react";
import { FileSpreadsheet, ArrowRight, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ColumnMapping } from "@/types";
import type { ExcelHeadersResult } from "@/lib/parsers/excelParser";
import { cn } from "@/lib/utils";

const NONE = "__none__";

interface ColumnMappingDialogProps {
  open: boolean;
  fileName: string;
  headersResult: ExcelHeadersResult;
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

interface MappingField {
  key: keyof Pick<
    ColumnMapping,
    | "partNameCol"
    | "qtyCol"
    | "thkCol"
    | "matCol"
    | "widthCol"
    | "lengthCol"
    | "areaCol"
    | "weightCol"
    | "totalWeightCol"
    | "dxfFileCol"
  >;
  label: string;
  required: boolean;
  description: string;
}

const FIELDS: MappingField[] = [
  { key: "partNameCol",    label: "Part Name",     required: true,  description: "Unique identifier for each part" },
  { key: "dxfFileCol",     label: "DXF file",      required: false, description: "Drawing filename — links this row to the correct DXF when part names repeat across files" },
  { key: "qtyCol",         label: "Quantity",      required: false, description: "Number of pieces — defaults to 1" },
  { key: "thkCol",         label: "Thickness",     required: false, description: "Plate thickness (numeric, mm)" },
  { key: "matCol",         label: "Material",      required: false, description: "Steel grade or material type" },
  { key: "widthCol",       label: "Width",         required: false, description: "Plate width (mm)" },
  { key: "lengthCol",      label: "Length",        required: false, description: "Plate length (mm or m)" },
  { key: "areaCol",        label: "Area",          required: false, description: "Plate area (m²)" },
  { key: "weightCol",      label: "Weight",        required: false, description: "Unit weight per piece (kg)" },
  { key: "totalWeightCol", label: "Total Weight",  required: false, description: "Total weight for all pieces (kg)" },
];

export function ColumnMappingDialog({
  open,
  fileName,
  headersResult,
  onConfirm,
  onCancel,
}: ColumnMappingDialogProps) {
  const { rawHeaders, autoDetected, previewRows } = headersResult;

  // Initialise from auto-detected guesses
  const [mapping, setMapping] = useState<ColumnMapping>(() => ({ ...autoDetected }));

  // Reset whenever the dialog opens with a new file
  const resetToAuto = () => setMapping({ ...autoDetected });

  function setField(
    key: MappingField["key"],
    value: string   // col index as string, or NONE
  ) {
    setMapping((prev) => ({
      ...prev,
      [key]: value === NONE ? null : parseInt(value, 10),
    }));
  }

  // Live preview: only the 4 mapped columns
  const previewCols = useMemo(() => {
    return FIELDS.map((f) => {
      const colIdx =
        f.key === "partNameCol"
          ? mapping.partNameCol
          : mapping[f.key];
      return {
        label: f.label,
        colIdx,
        header: colIdx != null ? rawHeaders[colIdx] ?? "" : null,
      };
    });
  }, [mapping, rawHeaders]);

  const canConfirm = mapping.partNameCol >= 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
            Map Excel Columns
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{fileName}</p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Field selectors ──────────────────────────────────────────── */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Column Mapping
            </p>
            <div className="grid gap-3">
              {FIELDS.map((field) => {
                const currentIdx =
                  field.key === "partNameCol"
                    ? mapping.partNameCol
                    : mapping[field.key];
                const currentVal =
                  currentIdx != null ? String(currentIdx) : NONE;
                const isAutoDetected =
                  currentIdx != null &&
                  autoDetected[field.key] === currentIdx;

                return (
                  <div
                    key={field.key}
                    className={cn(
                      "grid grid-cols-[140px_1fr] items-start gap-4 px-3 py-2.5 rounded-lg border",
                      field.required && currentIdx == null
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border bg-card"
                    )}
                  >
                    <div className="pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">
                          {field.label}
                        </span>
                        {field.required && (
                          <span className="text-xs text-destructive font-medium">*</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
                        {field.description}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Select
                        value={currentVal}
                        onValueChange={(v) => setField(field.key, v)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="— not in file —" />
                        </SelectTrigger>
                        <SelectContent>
                          {!field.required && (
                            <SelectItem value={NONE} className="text-muted-foreground italic">
                              — not in file —
                            </SelectItem>
                          )}
                          {rawHeaders.map((h, idx) =>
                            h ? (
                              <SelectItem key={idx} value={String(idx)} className="text-sm font-mono">
                                <span className="text-muted-foreground mr-1.5 text-xs">col {idx + 1}</span>
                                {h}
                              </SelectItem>
                            ) : null
                          )}
                        </SelectContent>
                      </Select>

                      {isAutoDetected && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                          Auto-detected
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Data preview ─────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Preview (first {previewRows.length} rows)
            </p>
            {previewRows.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No data rows found.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {previewCols.map((col) => (
                        <th
                          key={col.label}
                          className={cn(
                            "px-3 py-2 text-left font-semibold text-xs whitespace-nowrap",
                            col.colIdx == null && "text-muted-foreground"
                          )}
                        >
                          <div>{col.label}</div>
                          {col.header && (
                            <div className="font-normal text-muted-foreground font-mono mt-0.5">
                              {col.header}
                            </div>
                          )}
                          {col.colIdx == null && (
                            <div className="font-normal text-muted-foreground/60 italic mt-0.5">
                              not mapped
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        {previewCols.map((col) => {
                          const val =
                            col.colIdx != null
                              ? String((row as unknown[])[col.colIdx] ?? "")
                              : null;
                          return (
                            <td
                              key={col.label}
                              className={cn(
                                "px-3 py-2 font-mono text-xs",
                                col.colIdx == null && "text-muted-foreground/40",
                                col.label === "Part Name" && "font-semibold font-sans text-foreground"
                              )}
                            >
                              {val ?? <span className="italic text-muted-foreground/40">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Validation warning ────────────────────────────────────────── */}
          {!canConfirm && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Part Name</strong> is required — please select which column contains the part identifier.
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={resetToAuto} className="mr-auto">
            Reset to auto-detect
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(mapping)}
            disabled={!canConfirm}
          >
            Confirm & Import
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
