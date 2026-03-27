"use client";

import { useState } from "react";
import { AlertTriangle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
}

export function ValidationStep({
  summary,
  rows,
  onBack,
  onContinue,
}: ValidationStepProps) {
  const [detailRow, setDetailRow] = useState<ValidationRow | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const hasCritical = summary.critical > 0;

  const handleReportConfirm = (selected: ValidationRow[]) => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `validation-report-${stamp}.csv`,
      buildValidationReportCsv(selected)
    );
  };

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Validation results</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          We checked the uploaded Excel against the detected DXF part data (mocked extraction).
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Rows checked" value={summary.totalRows} />
        <SummaryTile
          label="Matched"
          value={summary.matched}
          variant="ok"
        />
        <SummaryTile
          label="Warnings"
          value={summary.warnings}
          variant="warn"
        />
        <SummaryTile
          label="Critical"
          value={summary.critical}
          variant="bad"
        />
      </div>

      <ValidationTable rows={rows} onRowOpen={setDetailRow} />

      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={() => setReportOpen(true)}>
          <FileDown className="h-4 w-4 mr-2" />
          Open validation report
        </Button>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="outline" onClick={onBack}>
            Back to upload
          </Button>
          <Button type="button" onClick={() => setCalcOpen(true)}>
            Continue to stock & pricing
          </Button>
        </div>
      </div>

      <PlateScopePickerDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        rows={rows}
        title="Validation report"
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
        title="Plates for calculation"
        description="Choose which plates to include in this quote run. You can skip errors or warnings, or pick specific parts only. Next you will enter stock sheet sizes and purchase price per kg before calculation."
        countMessage={(n) =>
          n === 1
            ? "1 plate will be included in this calculation."
            : `${n} plates will be included in this calculation.`
        }
        confirmLabel="Start calculation"
        onConfirm={onContinue}
      />

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-w-lg sm:max-w-xl">
          {detailRow && (
            <>
              <DialogHeader>
                <DialogTitle>{detailRow.partName}</DialogTitle>
                <DialogDescription>
                  DXF file: <span className="font-mono text-xs">{detailRow.dxfFileName}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Mismatch fields
                  </p>
                  <p className="mt-1">
                    {detailRow.mismatchFields.length
                      ? detailRow.mismatchFields.join(", ")
                      : "—"}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Likely cause
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {detailRow.suggestedReason || "No discrepancy for this row."}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Recommended action
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {detailRow.actionRecommendation || "None."}
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
              : ""
      }
    >
      <CardHeader className="pb-1 pt-4">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
