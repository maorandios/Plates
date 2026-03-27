"use client";

import { useMemo } from "react";
import {
  ArrowLeft,
  FileDown,
  FileSpreadsheet,
  Save,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PartBreakdownTable } from "./PartBreakdownTable";
import { JobOverviewSection } from "../job-overview/components/JobOverviewSection";
import { MaterialBreakdownSection } from "../job-overview/components/MaterialBreakdownSection";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  PricingSummary,
  QuickQuoteJobDetails,
  QuotePartRow,
  ThicknessStockInput,
} from "../types/quickQuote";
import { QuoteInsightsSection } from "../insights/components/QuoteInsightsSection";

interface QuoteSummaryStepProps {
  jobDetails: QuickQuoteJobDetails;
  jobSummary: JobSummaryMetrics;
  parts: QuotePartRow[];
  mfgParams: ManufacturingParameters;
  pricing: PricingSummary;
  thicknessStock?: ThicknessStockInput[];
  onBack: () => void;
  onBackToValidation: () => void;
}

export function QuoteSummaryStep({
  jobDetails,
  jobSummary,
  parts,
  mfgParams,
  pricing,
  thicknessStock,
  onBack,
  onBackToValidation,
}: QuoteSummaryStepProps) {
  const thicknessStockProvided = Boolean(thicknessStock?.length);

  const quoteDate = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
      }).format(new Date()),
    []
  );

  return (
    <div className="space-y-8 pb-12">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden print:shadow-none">
        <div className="border-b border-border bg-muted/30 px-4 py-4 sm:px-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight font-mono truncate">
                {jobDetails.referenceNumber || "Quote"}
              </h1>
              <Badge variant="secondary" className="shrink-0 font-normal">
                Draft quote
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {jobDetails.customerName || "Customer —"}
            </p>
            <p className="text-xs text-muted-foreground">{quoteDate}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back
            </Button>
            <Button type="button" variant="outline" size="sm" disabled>
              <FileDown className="h-4 w-4 mr-1.5" />
              Export PDF
            </Button>
            <Button type="button" variant="outline" size="sm" disabled>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              Export Excel
            </Button>
            <Button type="button" variant="outline" size="sm" disabled>
              <Save className="h-4 w-4 mr-1.5" />
              Save quote
            </Button>
            <Button type="button" size="sm" disabled>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Generate final price
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-8">
          <JobOverviewSection
            jobSummary={jobSummary}
            mfgParams={mfgParams}
            parts={parts}
            thicknessStock={thicknessStock}
          />

          <Separator />

          <MaterialBreakdownSection
            parts={parts}
            thicknessStock={thicknessStock}
            thicknessStockProvided={thicknessStockProvided}
            currencyCode={jobDetails.currency}
          />

          <Separator />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Parts
            </h2>
            <PartBreakdownTable parts={parts} currency={jobDetails.currency} />
          </section>

          <Separator />

          <QuoteInsightsSection
            key={`${jobDetails.referenceNumber}-${pricing.finalEstimatedPrice}`}
            pricing={pricing}
            mfgParams={mfgParams}
            jobSummary={jobSummary}
            currencyCode={jobDetails.currency}
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onBackToValidation}>
          ← Back to validation
        </Button>
        <p className="text-xs text-muted-foreground">
          This quote workspace is a UI prototype. Actions and figures are not persisted or sent
          to a server.
        </p>
      </div>
    </div>
  );
}
