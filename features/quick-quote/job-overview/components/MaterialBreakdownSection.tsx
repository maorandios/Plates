"use client";

import { useMemo } from "react";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { QuotePartRow, ThicknessStockInput } from "../../types/quickQuote";
import {
  aggregateStockSheetBreakdownByThickness,
  buildStockSheetSizeBreakdown,
} from "../jobOverview.utils";
import { MaterialBreakdownBarChart } from "./MaterialBreakdownBarChart";

const QA = "quote.quantityAnalysis" as const;

interface MaterialBreakdownSectionProps {
  parts: QuotePartRow[];
  thicknessStock?: ThicknessStockInput[] | null;
  thicknessStockProvided: boolean;
  currencyCode: string;
}

export function MaterialBreakdownSection({
  parts,
  thicknessStock,
  thicknessStockProvided,
  currencyCode: _currencyCode,
}: MaterialBreakdownSectionProps) {
  const detailStockRows = useMemo(
    () => buildStockSheetSizeBreakdown(parts, thicknessStock),
    [parts, thicknessStock]
  );

  const stockRows = useMemo(
    () => aggregateStockSheetBreakdownByThickness(detailStockRows),
    [detailStockRows]
  );

  return (
    <section className="space-y-6" dir="rtl">
      <div className="space-y-1 text-start">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">
          {t(`${QA}.materialSectionTitle`)}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t(`${QA}.materialSectionIntro`)}
        </p>
      </div>

      {stockRows.length === 0 ? (
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <p className="text-sm text-muted-foreground py-16 text-center border border-dashed border-white/15 rounded-xl leading-relaxed px-2">
              {parts.length === 0
                ? t(`${QA}.noPartRows`)
                : !thicknessStockProvided
                  ? t(`${QA}.emptyNoStock`)
                  : t(`${QA}.emptyNoNesting`)}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <MaterialBreakdownBarChart rows={stockRows} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
