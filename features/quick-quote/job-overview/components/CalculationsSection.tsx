"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDecimal } from "@/lib/formatNumbers";
import { t } from "@/lib/i18n";
import type { MaterialType } from "@/types/materials";
import {
  formatQuickQuoteCurrency,
  quickQuoteCurrencySymbol,
} from "../../lib/quickQuoteCurrencies";
import {
  buildMaterialPricingLines,
  parseMaterialPricePerKg,
} from "../materialCalculations";
import type { QuotePartRow } from "../../types/quickQuote";

const PF = "quote.pricingPhase" as const;

interface CalculationsSectionProps {
  parts: QuotePartRow[];
  materialType: MaterialType;
  currencyCode: string;
  pricePerKgByRow: Record<string, string>;
  onPricePerKgByRowChange: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
}

export function CalculationsSection({
  parts,
  materialType,
  currencyCode,
  pricePerKgByRow,
  onPricePerKgByRowChange,
}: CalculationsSectionProps) {
  const lines = useMemo(
    () => buildMaterialPricingLines(parts, materialType),
    [parts, materialType]
  );

  const currencySymbol = quickQuoteCurrencySymbol(currencyCode);

  const { lineTotals, grandTotal } = useMemo(() => {
    let sum = 0;
    const lineTotals: Record<string, number> = {};
    for (const line of lines) {
      const p = parseMaterialPricePerKg(pricePerKgByRow[line.rowKey] ?? "");
      const t = line.totalWeightKg * p;
      lineTotals[line.rowKey] = t;
      sum += t;
    }
    return { lineTotals, grandTotal: sum };
  }, [lines, pricePerKgByRow]);

  if (parts.length === 0) {
    return (
      <section dir="rtl">
        <div className="rounded-md border border-dashed border-white/15 px-4 py-12 text-center text-sm leading-relaxed text-muted-foreground">
          {t(`${PF}.calculationsEmptyCard`)}
        </div>
      </section>
    );
  }

  return (
    <section dir="rtl">
      <div className="overflow-x-auto rounded-md border border-white/[0.08]">
        <Table
          dir="rtl"
          containerClassName="overflow-visible"
          className="min-w-[48rem] text-start [&_th]:text-start [&_td]:text-start"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[7.5rem] whitespace-nowrap font-medium">
                {t(`${PF}.colMetalType`)}
              </TableHead>
              <TableHead className="min-w-[5rem] tabular-nums font-medium">
                {t(`${PF}.colThicknessMm`)}
              </TableHead>
              <TableHead className="min-w-[6rem] font-medium">{t(`${PF}.colSteelGrade`)}</TableHead>
              <TableHead className="min-w-[5rem] font-medium">{t(`${PF}.colFinish`)}</TableHead>
              <TableHead className="min-w-[6rem] tabular-nums font-medium">
                {t(`${PF}.colWeightKg`)}
              </TableHead>
              <TableHead className="min-w-[8rem] whitespace-nowrap font-medium">
                {t(`${PF}.colPricePerKg`, { symbol: currencySymbol })}
              </TableHead>
              <TableHead className="min-w-[7rem] whitespace-nowrap font-medium">
                {t(`${PF}.colLineTotal`, { symbol: currencySymbol })}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.rowKey}>
                <TableCell className="font-medium text-foreground">{line.steelFamilyLabel}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatDecimal(line.thicknessMm, 1)}
                </TableCell>
                <TableCell className="text-muted-foreground">{line.grade}</TableCell>
                <TableCell className="text-muted-foreground">{line.finish}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {formatDecimal(line.totalWeightKg, 2)}
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    autoComplete="off"
                    dir="rtl"
                    className="h-9 max-w-[140px] tabular-nums text-start"
                    value={pricePerKgByRow[line.rowKey] ?? ""}
                    onChange={(e) =>
                      onPricePerKgByRowChange((prev) => ({
                        ...prev,
                        [line.rowKey]: e.target.value,
                      }))
                    }
                    aria-label={t(`${PF}.priceInputAria`, {
                      family: line.steelFamilyLabel,
                      thickness: formatDecimal(line.thicknessMm, 1),
                      grade: line.grade,
                    })}
                  />
                </TableCell>
                <TableCell className="tabular-nums font-medium text-foreground">
                  {formatQuickQuoteCurrency(lineTotals[line.rowKey] ?? 0, currencyCode)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="border-t border-white/10 bg-muted/35 p-0 [&>tr]:border-b-0">
            <TableRow className="border-0 bg-transparent hover:bg-transparent data-[state=selected]:bg-transparent">
              <TableCell colSpan={5} className="bg-inherit py-3.5" />
              <TableCell className="bg-black/[0.22] py-3.5 text-start align-middle dark:bg-black/35">
                <span className="text-sm font-medium text-muted-foreground">
                  {t(`${PF}.footerTotalForBilling`)}
                </span>
              </TableCell>
              <TableCell className="bg-black/[0.22] py-3.5 text-start align-middle tabular-nums text-base font-semibold text-foreground dark:bg-black/35">
                {formatQuickQuoteCurrency(grandTotal, currencyCode)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </section>
  );
}
