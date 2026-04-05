"use client";

import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatInteger } from "@/lib/formatNumbers";
import { FileUploadCard } from "./FileUploadCard";
import { JobDetailsForm } from "./JobDetailsForm";
import type { QuickQuoteJobDetails, UploadedFileMeta } from "../types/quickQuote";
import { MOCK_DETECTED_ROW_COUNT } from "../mock/quickQuoteMockData";

interface UploadStepProps {
  dxfFiles: UploadedFileMeta[];
  excelFile: UploadedFileMeta | null;
  jobDetails: QuickQuoteJobDetails;
  onDxfChange: (files: UploadedFileMeta[]) => void;
  onExcelChange: (file: UploadedFileMeta | null) => void;
  onJobDetailsChange: (v: QuickQuoteJobDetails) => void;
  onContinue: () => void;
}

let mockDxfCounter = 0;

export function UploadStep({
  dxfFiles,
  excelFile,
  jobDetails,
  onDxfChange,
  onExcelChange,
  onJobDetailsChange,
  onContinue,
}: UploadStepProps) {
  const addMockDxf = () => {
    mockDxfCounter += 1;
    const samples = [
      "BP-001_revC.dxf",
      "BasePlate-A.dxf",
      "Gusset-12.dxf",
      "CoverPlate-3.dxf",
    ];
    const name = samples[(mockDxfCounter - 1) % samples.length];
    onDxfChange([
      ...dxfFiles,
      {
        id: `dxf-${Date.now()}`,
        name,
        sizeLabel: `${formatInteger(180 + mockDxfCounter * 40)} KB`,
      },
    ]);
  };

  const addMockExcel = () => {
    onExcelChange({
      id: `xls-${Date.now()}`,
      name: "BOM_Quote_Job_2847.xlsx",
      sizeLabel: "42 KB",
    });
  };

  const canContinue = dxfFiles.length >= 1 && excelFile !== null;

  return (
    <div className="space-y-8">
      <div className="w-full">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Quick Quote
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Upload customer files and prepare a plate job quote
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px] xl:items-start">
        <div className="space-y-6 min-w-0">
          <div className="grid gap-6 lg:grid-cols-2">
            <FileUploadCard
              title="DXF upload"
              description="Part geometry — one file per part or assembly layer export"
              acceptNote="Accepted: .dxf — multiple files supported (demo: use sample button)."
              multiple
              files={dxfFiles}
              onFilesChange={onDxfChange}
              onAddMockFiles={addMockDxf}
              emptyHint="Drag and drop DXF files here, or add sample files for preview."
            />
            <FileUploadCard
              title="Excel upload"
              description="Bill of materials or line-item list for this job"
              acceptNote="Accepted: .xlsx, .xls — single workbook (demo: use sample button)."
              multiple={false}
              files={excelFile ? [excelFile] : []}
              onFilesChange={(fs) => onExcelChange(fs[0] ?? null)}
              onAddMockFiles={addMockExcel}
              emptyHint="Drag and drop one Excel file here, or load a sample BOM."
            />
          </div>

          <JobDetailsForm value={jobDetails} onChange={onJobDetailsChange} />
        </div>

        <Card className="xl:sticky xl:top-4 border-white/[0.06] shadow-sm">
          <CardHeader className="pb-3 border-b border-white/[0.08] bg-card/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              Intake summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">DXF files</span>
              <span className="font-medium tabular-nums">{dxfFiles.length}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Excel</span>
              <span className="font-medium">
                {excelFile ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Uploaded
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">
                    Missing
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Detected rows (mock)</span>
              <span className="font-medium tabular-nums">
                {dxfFiles.length >= 1 && excelFile ? MOCK_DETECTED_ROW_COUNT : "—"}
              </span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between gap-2 items-start">
              <span className="text-muted-foreground">Ready to validate</span>
              <span
                className={
                  canContinue
                    ? "font-medium text-emerald-700 dark:text-emerald-400 text-right"
                    : "font-medium text-muted-foreground text-right"
                }
              >
                {canContinue ? "Yes — requirements met" : "Add DXF + Excel to continue"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
        <p className="text-xs text-muted-foreground">
          Continue runs a mocked validation pass. No files leave your browser in this preview.
        </p>
        <Button type="button" size="lg" disabled={!canContinue} onClick={onContinue}>
          Continue to validation
        </Button>
      </div>
    </div>
  );
}
