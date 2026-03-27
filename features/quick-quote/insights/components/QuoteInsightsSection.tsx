"use client";

import { useMemo, useState } from "react";
import { formatQuickQuoteCurrency } from "../../lib/quickQuoteCurrencies";
import type { QuoteInsightsProps } from "../quoteInsights.types";
import {
  defaultMarginPercentFromMfg,
  deriveInsights,
  extractQuoteCostInputs,
} from "../quoteInsights.utils";
import { MarginImpactPanel } from "./MarginImpactPanel";

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

  const formatCurrency = useMemo(
    () => (n: number) => formatQuickQuoteCurrency(n, currencyCode),
    [currencyCode]
  );

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Margin & price impact
        </h2>
        <p className="text-sm text-muted-foreground">
          Margin is applied to base cost (material + cutting + piercing + setup + overhead).
          Figures follow the same base as the quote summary; this view is for decisions, not
          accounting. Charts and KPIs update as you move the slider.
        </p>
      </div>
      <MarginImpactPanel
        marginPercent={marginPercent}
        onMarginChange={setMarginPercent}
        baseCost={derived.baseCost}
        finalQuotePrice={derived.finalQuotePrice}
        profitAmount={derived.profitAmount}
        pricePerKg={derived.pricePerKg}
        pricePerKgUnavailable={derived.pricePerKgUnavailable}
        formatCurrency={formatCurrency}
        mfgParams={mfgParams}
      />
    </section>
  );
}
