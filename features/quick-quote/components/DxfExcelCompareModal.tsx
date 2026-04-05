"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatInteger } from "@/lib/formatNumbers";
import { ValidationTable } from "./ValidationTable";
import type { ValidationRow, ValidationSummary } from "../types/quickQuote";

function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildValidationReportCsv(rows: ValidationRow[]): string {
  const headers = [
    "Part name",
    "Qty",
    "Thickness (mm)",
    "Status",
    "Excel L (mm)",
    "DXF L (mm)",
    "Excel W (mm)",
    "DXF W (mm)",
    "Excel area (m²)",
    "DXF area (m²)",
    "Excel weight (kg)",
    "DXF weight (kg)",
    "Excel material",
    "DXF material",
    "DXF file",
    "Mismatch fields",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escapeCsvField(r.partName),
        r.qty,
        r.thicknessMm,
        r.status,
        r.excelLengthMm,
        r.dxfLengthMm,
        r.excelWidthMm,
        r.dxfWidthMm,
        r.excelAreaM2,
        r.dxfAreaM2,
        r.excelWeightKg,
        r.dxfWeightKg,
        escapeCsvField(r.excelMaterial),
        escapeCsvField(r.dxfMaterial),
        escapeCsvField(r.dxfFileName),
        escapeCsvField(r.mismatchFields.join("; ") || "—"),
      ].join(",")
    ),
  ];
  return lines.join("\r\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface DxfExcelCompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ValidationSummary;
  rows: ValidationRow[];
}

export function DxfExcelCompareModal({
  open,
  onOpenChange,
  summary,
  rows,
}: DxfExcelCompareModalProps) {
  const handleExportAll = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`excel-dxf-compare-${stamp}.csv`, buildValidationReportCsv(rows));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(100vw-2rem,72rem)] max-h-[min(92vh,900px)] flex flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Excel vs DXF comparison</DialogTitle>
          <DialogDescription>
            Same analysis as the main wizard Analyze step — BOM rows matched to DXF geometry.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3 space-y-4">
          <Card className="border-primary/25 bg-primary/5">
            <CardHeader className="pb-2 pt-4">
              <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Row status
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryTile label="Rows checked" value={summary.totalRows} />
                <SummaryTile label="Matched" value={summary.matched} variant="ok" />
                <SummaryTile label="Warning" value={summary.warnings} variant="warn" />
                <SummaryTile label="Critical" value={summary.critical} variant="bad" />
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border overflow-x-auto">
            <ValidationTable rows={rows} />
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" className="gap-2" onClick={handleExportAll}>
            <FileDown className="h-4 w-4" />
            Export CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "ok" | "warn" | "bad";
}) {
  return (
    <Card
      className={
        variant === "ok"
          ? "border-emerald-600/20 bg-emerald-600/[0.04]"
          : variant === "warn"
            ? "border-amber-500/25 bg-amber-500/[0.04]"
            : variant === "bad"
              ? "border-destructive/25 bg-destructive/[0.04]"
              : "bg-card"
      }
    >
      <CardHeader className="pb-1 pt-3 px-3">
        <CardDescription className="text-[10px] font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-xl tabular-nums">{formatInteger(value)}</CardTitle>
      </CardHeader>
    </Card>
  );
}
