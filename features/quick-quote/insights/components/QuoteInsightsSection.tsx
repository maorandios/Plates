"use client";

import { useMemo, useState } from "react";
import { formatQuickQuoteCurrency } from "../../lib/quickQuoteCurrencies";
import type { QuoteInsightsProps } from "../quoteInsights.types";
import {
  buildCostBreakdownData,
  buildShareBreakdown,
  defaultMarginPercentFromMfg,
  deriveInsights,
  extractQuoteCostInputs,
  findLargestCostComponent,
  formatKgDisplay,
} from "../quoteInsights.utils";
import { CostBreakdownChart } from "./CostBreakdownChart";
import { InsightsSummaryList } from "./InsightsSummaryList";
import { MarginImpactPanel } from "./MarginImpactPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function QuoteInsightsSection({
  pricing,
  mfgParams,
  jobSummary,
  currencyCode,
}: QuoteInsightsProps) {
  const defaultMargin = useMemo(() => defaultMarginPercentFromMfg(mfgParams), [mfgParams]);
  const [marginPercent, setMarginPercent] = useState(defaultMargin);

  const costInputs = useMemo(() => extractQuoteCostInputs(pricing), [pricing]);

  const derived = useMemo(
    () => deriveInsights(costInputs, marginPercent, jobSummary),
    [costInputs, marginPercent, jobSummary]
  );

  const breakdownRows = useMemo(
    () => buildCostBreakdownData(costInputs, derived.profitAmount),
    [costInputs, derived.profitAmount]
  );

  const shares = useMemo(
    () =>
      buildShareBreakdown(
        costInputs,
        derived.profitAmount,
        derived.finalQuotePrice
      ),
    [costInputs, derived.profitAmount, derived.finalQuotePrice]
  );

  const largest = useMemo(
    () => findLargestCostComponent(breakdownRows),
    [breakdownRows]
  );

  const formatCurrency = useMemo(
    () => (n: number) => formatQuickQuoteCurrency(n, currencyCode),
    [currencyCode]
  );

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Quote insights
        </h2>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Explore how margin moves the selling price and how costs stack up. Figures follow
          the same base as the summary above; this view is for decisions, not accounting.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <MarginImpactPanel
          marginPercent={marginPercent}
          onMarginChange={setMarginPercent}
          baseCost={derived.baseCost}
          defaultMarginPercent={defaultMargin}
          finalQuotePrice={derived.finalQuotePrice}
          profitAmount={derived.profitAmount}
          pricePerKg={derived.pricePerKg}
          pricePerKgUnavailable={derived.pricePerKgUnavailable}
          formatCurrency={formatCurrency}
          formatKg={formatKgDisplay}
          totalWeightKg={jobSummary.totalEstWeightKg}
        />

        <Card className="border-border shadow-sm h-full flex flex-col">
          <CardHeader className="border-b border-border bg-muted/20 pb-4">
            <CardTitle className="text-base">Cost breakdown</CardTitle>
            <CardDescription>
              Share of final quote by category. Profit / margin grows with the slider.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col flex-1 gap-6">
            <CostBreakdownChart
              rows={breakdownRows}
              finalQuotePrice={derived.finalQuotePrice}
              formatCurrency={formatCurrency}
            />
            <InsightsSummaryList
              shares={shares}
              largest={largest}
              formatCurrency={formatCurrency}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
