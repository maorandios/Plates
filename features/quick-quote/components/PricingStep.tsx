"use client";

import type { Dispatch, SetStateAction } from "react";
import { Separator } from "@/components/ui/separator";
import type { DxfPartGeometry } from "@/types";
import type { MaterialType } from "@/types/materials";
import { CalculationsSection } from "../job-overview/components/CalculationsSection";
import type { QuotePartRow } from "../types/quickQuote";
import { PartBreakdownTable } from "./PartBreakdownTable";

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
  currencyCode,
  pricePerKgByRow,
  onPricePerKgByRowChange,
  dxfPartGeometries,
}: PricingStepProps) {
  return (
    <div className="space-y-8 pb-12">
      <div className="ds-surface overflow-hidden">
        <div className="border-b border-white/[0.08] bg-card/40 px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Material pricing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set sell price per kg by material combination, then review each line’s material total in
            the parts table.
          </p>
        </div>

        <div className="p-4 sm:p-6 space-y-8">
          <CalculationsSection
            parts={parts}
            materialType={materialType}
            currencyCode={currencyCode}
            pricePerKgByRow={pricePerKgByRow}
            onPricePerKgByRowChange={onPricePerKgByRowChange}
          />

          <Separator />

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Parts
            </h2>
            <PartBreakdownTable
              parts={parts}
              currency={currencyCode}
              materialType={materialType}
              materialPricePerKgByRow={pricePerKgByRow}
              dxfPartGeometries={dxfPartGeometries}
            />
          </section>
        </div>
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Material line totals use the price per kg from the table above for each part’s grade,
        thickness, and finish. Continue when you are ready to finalize.
      </p>
    </div>
  );
}
