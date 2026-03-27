"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  FileDown,
  FileSpreadsheet,
  Save,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { PartBreakdownTable } from "./PartBreakdownTable";
import { PricingSummaryCard } from "./PricingSummaryCard";
import { JobOverviewSection } from "../job-overview/components/JobOverviewSection";
import { QuoteSummaryCards } from "./QuoteSummaryCards";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  PricingSummary,
  QuickQuoteJobDetails,
  QuotePartRow,
  ThicknessStockInput,
  ValidationRecap,
} from "../types/quickQuote";
import { MOCK_QUOTE_ASSUMPTIONS } from "../mock/quickQuoteMockData";
import { QuoteInsightsSection } from "../insights/components/QuoteInsightsSection";

interface QuoteSummaryStepProps {
  jobDetails: QuickQuoteJobDetails;
  jobSummary: JobSummaryMetrics;
  parts: QuotePartRow[];
  validationRecap: ValidationRecap;
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
  validationRecap,
  mfgParams,
  pricing,
  thicknessStock,
  onBack,
  onBackToValidation,
}: QuoteSummaryStepProps) {
  const [assumptions, setAssumptions] = useState(
    () => MOCK_QUOTE_ASSUMPTIONS.join("\n")
  );

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
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Job summary
            </h2>
            <QuoteSummaryCards metrics={jobSummary} />
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Parts
            </h2>
            <PartBreakdownTable parts={parts} currency={jobDetails.currency} />
          </section>

          <Separator />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Validation recap
            </h2>
            <Card>
              <CardContent className="pt-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Fully matched</p>
                  <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {validationRecap.fullyMatched}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                  <p className="text-2xl font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                    {validationRecap.warningItems}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Errors</p>
                  <p className="text-2xl font-semibold tabular-nums text-destructive">
                    {validationRecap.errorItems}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground sm:col-span-3 leading-relaxed">
                  {validationRecap.confidenceNote}
                </p>
              </CardContent>
            </Card>
          </section>

          <Separator />

          <JobOverviewSection
            jobSummary={jobSummary}
            mfgParams={mfgParams}
            parts={parts}
            thicknessStock={thicknessStock}
            currencyCode={jobDetails.currency}
          />

          <Separator />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pricing
            </h2>
            <PricingSummaryCard pricing={pricing} currency={jobDetails.currency} />
          </section>

          <Separator />

          <QuoteInsightsSection
            key={`${jobDetails.referenceNumber}-${pricing.finalEstimatedPrice}`}
            pricing={pricing}
            mfgParams={mfgParams}
            jobSummary={jobSummary}
            currencyCode={jobDetails.currency}
          />

          <Separator />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Notes & assumptions
            </h2>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Editable notes (preview)</CardTitle>
                <CardDescription>
                  Shown on printouts; mock field for UI flow only.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={assumptions}
                  onChange={(e) => setAssumptions(e.target.value)}
                  rows={6}
                  className="resize-y min-h-[140px] text-sm leading-relaxed"
                />
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onBackToValidation}>
          ← Back to validation
        </Button>
        <p className="text-xs text-muted-foreground max-w-md">
          This quote workspace is a UI prototype. Actions and figures are not persisted or sent
          to a server.
        </p>
      </div>
    </div>
  );
}
