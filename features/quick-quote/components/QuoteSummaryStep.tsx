"use client";

import { Separator } from "@/components/ui/separator";
import { t } from "@/lib/i18n";
import { JobOverviewSection } from "../job-overview/components/JobOverviewSection";
import { MaterialBreakdownSection } from "../job-overview/components/MaterialBreakdownSection";
import { NestingPreviewSection } from "../job-overview/components/NestingPreviewSection";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  QuickQuoteJobDetails,
  QuotePartRow,
  ThicknessStockInput,
} from "../types/quickQuote";

const QA = "quote.quantityAnalysis" as const;

interface QuoteSummaryStepProps {
  jobDetails: QuickQuoteJobDetails;
  jobSummary: JobSummaryMetrics;
  parts: QuotePartRow[];
  mfgParams: ManufacturingParameters;
  thicknessStock?: ThicknessStockInput[];
}

export function QuoteSummaryStep({
  jobDetails,
  jobSummary,
  parts,
  mfgParams,
  thicknessStock,
}: QuoteSummaryStepProps) {
  const thicknessStockProvided = Boolean(thicknessStock?.length);

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      <div className="ds-surface overflow-hidden print:shadow-none">
        <div className="ds-surface-header py-5 sm:px-6 border-b border-white/[0.06]">
          <div className="min-w-0 space-y-1.5 text-start">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              {t(`${QA}.pageTitle`)}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
              {t(`${QA}.pageSubtitle`)}
            </p>
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

          <NestingPreviewSection
            parts={parts}
            thicknessStock={thicknessStock}
          />
        </div>
      </div>
    </div>
  );
}
