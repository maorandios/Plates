"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { PlateScopePickerDialog } from "./PlateScopePickerDialog";
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

interface ValidationStepProps {
  summary: ValidationSummary;
  rows: ValidationRow[];
  onBack: () => void;
  onContinue: (selectedRows: ValidationRow[]) => void;
  /** When `dxfUpload`, CTA copy targets the DXF review step instead of stock/pricing. */
  embedMode?: "dxfUpload";
}

export function ValidationStep({
  summary,
  rows,
  onBack,
  onContinue,
  embedMode,
}: ValidationStepProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const hasCritical = summary.critical > 0;

  const analyzeMetrics = useMemo(() => {
    let totalQty = 0;
    let totalAreaM2 = 0;
    let totalWeightKg = 0;
    let totalPerimeterMm = 0;
    let totalPiercing = 0;
    const gradeSet = new Set<string>();

    for (const r of rows) {
      totalQty += r.qty;
      totalAreaM2 += r.dxfAreaM2 * r.qty;
      totalWeightKg += r.excelWeightKg * r.qty;
      totalPerimeterMm += r.dxfPerimeterMm * r.qty;
      totalPiercing += r.dxfPiercingCount * r.qty;
      const g = r.dxfMaterial?.trim();
      if (g && g !== "-") gradeSet.add(g);
      const eg = r.excelMaterial?.trim();
      if (eg && eg !== "-") gradeSet.add(eg);
    }

    const materialGrades =
      gradeSet.size === 0
        ? "—"
        : [...gradeSet].sort().join(", ");

    return {
      plates: rows.length,
      quantity: totalQty,
      areaM2: totalAreaM2,
      weightKg: totalWeightKg,
      perimeterMm: totalPerimeterMm,
      piercing: totalPiercing,
      materialGrades,
    };
  }, [rows]);

  const handleReportConfirm = (selected: ValidationRow[]) => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `analyze-report-${stamp}.csv`,
      buildValidationReportCsv(selected)
    );
  };

  return (
    <div className="space-y-8">
      <div className="w-full">
        <h1 className="text-2xl font-semibold tracking-tight">Analyze results</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Comparing Excel BOM data against DXF geometry to identify any discrepancies.
        </p>
      </div>

      {hasCritical && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex gap-3 items-start">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">
              Critical mismatches present
            </p>
            <p className="text-sm text-muted-foreground">
              In production, quoting would typically pause until material and dimension conflicts
              are resolved. For this UI preview you can still continue to see the rest of the
              flow.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <MetricCard label="Plates" value={analyzeMetrics.plates} />
        <MetricCard label="Quantity" value={analyzeMetrics.quantity} />
        <MetricCard
          label="Area (m²)"
          value={analyzeMetrics.areaM2}
          decimals={2}
        />
        <MetricCard
          label="Weight (kg)"
          value={analyzeMetrics.weightKg}
          decimals={1}
        />
        <MetricCard
          label="Perimeter (mm)"
          value={analyzeMetrics.perimeterMm}
          decimals={0}
        />
        <MetricCard label="Piercing" value={analyzeMetrics.piercing} />
        <Card className="border-border/80 xl:col-span-1 min-h-[88px]">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardDescription className="text-[10px] font-medium uppercase tracking-wide leading-tight">
              Material grade
            </CardDescription>
            <CardTitle className="text-sm font-medium leading-snug line-clamp-3 break-words">
              {analyzeMetrics.materialGrades}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-primary/25 bg-primary/5">
        <CardHeader className="pb-2 pt-4">
          <CardDescription className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Row status
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryTile label="Rows checked" value={summary.totalRows} />
            <SummaryTile
              label="Row matched"
              value={summary.matched}
              variant="ok"
            />
            <SummaryTile
              label="Warning"
              value={summary.warnings}
              variant="warn"
            />
            <SummaryTile
              label="Critical"
              value={summary.critical}
              variant="bad"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => setReportOpen(true)}>
          <FileDown className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <ValidationTable rows={rows} />

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
        <div className="flex flex-wrap gap-2 justify-end w-full sm:w-auto">
          <Button type="button" variant="outline" onClick={onBack}>
            Back to upload
          </Button>
          <Button type="button" onClick={() => setCalcOpen(true)}>
            {embedMode === "dxfUpload"
              ? "Continue to DXF review"
              : "Continue to stock & pricing"}
          </Button>
        </div>
      </div>

      <PlateScopePickerDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        rows={rows}
        title="Export CSV"
        description="Choose which rows to include in the downloaded CSV file."
        countMessage={(n) =>
          n === 1
            ? "1 row will be exported."
            : `${n} rows will be exported.`
        }
        confirmLabel="Download CSV"
        confirmStartIcon={<FileDown className="h-4 w-4 mr-2" />}
        onConfirm={handleReportConfirm}
      />

      <PlateScopePickerDialog
        open={calcOpen}
        onOpenChange={setCalcOpen}
        rows={rows}
        title={embedMode === "dxfUpload" ? "Plates for review" : "Plates for calculation"}
        description={
          embedMode === "dxfUpload"
            ? "Choose which BOM lines to carry into the DXF part review. You can exclude errors or warnings, or pick specific parts only."
            : "Choose which plates to include in this quote run. You can skip errors or warnings, or pick specific parts only. Next you will enter stock sheet sizes and purchase price per kg before calculation."
        }
        countMessage={(n) =>
          embedMode === "dxfUpload"
            ? n === 1
              ? "1 plate will continue to DXF review."
              : `${n} plates will continue to DXF review.`
            : n === 1
              ? "1 plate will be included in this calculation."
              : `${n} plates will be included in this calculation.`
        }
        confirmLabel={embedMode === "dxfUpload" ? "Continue" : "Start calculation"}
        onConfirm={onContinue}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  decimals = 0,
}: {
  label: string;
  value: number;
  decimals?: number;
}) {
  const display =
    decimals === 0 ? formatInteger(value) : formatDecimal(value, decimals);
  return (
    <Card className="border-border/80 min-h-[88px]">
      <CardHeader className="pb-1 pt-3 px-3">
        <CardDescription className="text-[10px] font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-xl tabular-nums">{display}</CardTitle>
      </CardHeader>
    </Card>
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
