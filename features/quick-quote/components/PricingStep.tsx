"use client";

import type { Dispatch, SetStateAction } from "react";
import { Separator } from "@/components/ui/separator";
import { t } from "@/lib/i18n";
import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import { CalculationsSection } from "../job-overview/components/CalculationsSection";
import type { QuotePartRow } from "../types/quickQuote";
import { PartBreakdownTable } from "./PartBreakdownTable";

const PF = "quote.pricingPhase" as const;

/** Phase 6 displays material pricing in Israeli new shekel (₪). */
const PRICING_STEP_CURRENCY = "ILS";

interface PricingStepProps {
  parts: QuotePartRow[];
  materialType: MaterialType;
  currencyCode: string;
  pricePerKgByRow: Record<string, string>;
  onPricePerKgByRowChange: Dispatch<SetStateAction<Record<string, string>>>;
  dxfPartGeometries: DxfPartGeometry[];
}

export function PricingStep({
  parts,
  materialType,
  currencyCode: _jobCurrency,
  pricePerKgByRow,
  onPricePerKgByRowChange,
  dxfPartGeometries,
}: PricingStepProps) {
  return (
    <div className="space-y-8 pb-12" dir="rtl">
      <div className="ds-surface overflow-hidden">
        <div className="border-b border-white/[0.08] bg-card/40 px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight text-foreground text-start">
            {t(`${PF}.pageTitle`)}
          </h1>
          <p className="mt-1 text-start text-sm text-muted-foreground leading-relaxed">
            {t(`${PF}.pageSubtitle`)}
          </p>
        </div>

        <div className="space-y-8 p-4 sm:p-6">
          <CalculationsSection
            parts={parts}
            materialType={materialType}
            currencyCode={PRICING_STEP_CURRENCY}
            pricePerKgByRow={pricePerKgByRow}
            onPricePerKgByRowChange={onPricePerKgByRowChange}
          />

          <Separator />

          <section className="space-y-3">
            <h2 className="text-start text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`${PF}.partsSectionTitle`)}
            </h2>
            <PartBreakdownTable
              parts={parts}
              currency={PRICING_STEP_CURRENCY}
              materialType={materialType}
              materialPricePerKgByRow={pricePerKgByRow}
              dxfPartGeometries={dxfPartGeometries}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
