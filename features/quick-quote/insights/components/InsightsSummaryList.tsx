"use client";

import type { LargestCostInfo, ShareBreakdown } from "../quoteInsights.types";
import { formatPercentDisplay } from "../quoteInsights.utils";

interface InsightsSummaryListProps {
  shares: ShareBreakdown;
  largest: LargestCostInfo;
  formatCurrency: (n: number) => string;
}

export function InsightsSummaryList({
  shares,
  largest,
  formatCurrency,
}: InsightsSummaryListProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Composition
      </p>
      <ul className="space-y-2.5 text-sm text-muted-foreground leading-snug">
        <li>
          <span className="text-foreground font-medium">Material</span> accounts for{" "}
          <span className="tabular-nums text-foreground">
            {formatPercentDisplay(shares.materialShare, 0)}
          </span>{" "}
          of the quote.
        </li>
        <li>
          <span className="text-foreground font-medium">Processing</span> (cutting, piercing,
          setup) accounts for{" "}
          <span className="tabular-nums text-foreground">
            {formatPercentDisplay(shares.processingShare, 0)}
          </span>
          .
        </li>
        <li>
          <span className="text-foreground font-medium">Margin</span> represents{" "}
          <span className="tabular-nums text-foreground">
            {formatPercentDisplay(shares.marginShare, 0)}
          </span>{" "}
          of the final selling price.
        </li>
        <li className="pt-1 border-t border-border/80">
          <span className="text-foreground font-medium">Largest cost line:</span>{" "}
          {largest.label} ({formatCurrency(largest.value)}).
        </li>
      </ul>
    </div>
  );
}
