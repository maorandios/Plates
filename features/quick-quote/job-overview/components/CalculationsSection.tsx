"use client";

import { useMemo } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4 shrink-0" aria-hidden />
            Calculations
          </h2>
          <p className="text-sm text-muted-foreground">
            Add parts to the quote to list material combinations and estimate material sell price
            per job (priced per kg).
          </p>
        </div>
        <Card className="border-0">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No parts in this quote yet.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4 shrink-0" aria-hidden />
          Calculations
        </h2>
        <p className="text-sm text-muted-foreground">
          Each row is a distinct combination of{" "}
          <span className="text-foreground/90">steel family</span> (from your quote material),{" "}
          <span className="text-foreground/90">thickness</span>,{" "}
          <span className="text-foreground/90">grade</span>, and{" "}
          <span className="text-foreground/90">finish</span> detected on the BOM. Enter your target
          sell price per kg; we multiply by the rolled-up weight for that combination to show a line
          total and a job material total.
        </p>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[120px] whitespace-nowrap">Steel family</TableHead>
                  <TableHead className="text-right tabular-nums w-[100px]">Thick. (mm)</TableHead>
                  <TableHead className="min-w-[100px]">Grade</TableHead>
                  <TableHead className="min-w-[100px]">Finish</TableHead>
                  <TableHead className="text-right tabular-nums min-w-[100px]">
                    Weight (kg)
                  </TableHead>
                  <TableHead className="text-right min-w-[120px] whitespace-nowrap">
                    Price ({currencyCode} / kg)
                  </TableHead>
                  <TableHead className="text-right min-w-[120px] whitespace-nowrap">
                    Line total ({currencySymbol})
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.rowKey}>
                    <TableCell className="font-medium text-foreground">
                      {line.steelFamilyLabel}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatDecimal(line.thicknessMm, 1)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{line.grade}</TableCell>
                    <TableCell className="text-muted-foreground">{line.finish}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatDecimal(line.totalWeightKg, 2)}
                    </TableCell>
                    <TableCell className="text-right p-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="—"
                        autoComplete="off"
                        className="h-9 max-w-[140px] ml-auto tabular-nums text-right"
                        value={pricePerKgByRow[line.rowKey] ?? ""}
                        onChange={(e) =>
                          onPricePerKgByRowChange((prev) => ({
                            ...prev,
                            [line.rowKey]: e.target.value,
                          }))
                        }
                        aria-label={`Price per kg for ${line.steelFamilyLabel} ${line.thicknessMm} mm ${line.grade}`}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-foreground">
                      {formatQuickQuoteCurrency(
                        lineTotals[line.rowKey] ?? 0,
                        currencyCode
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-muted/50">
                  <TableCell colSpan={6} className="text-right font-medium">
                    Material total ({currencyCode})
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatQuickQuoteCurrency(grandTotal, currencyCode)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground px-1">
        Weight is net plate weight from the BOM (per part × qty), summed for each combination. Prices
        you enter here are not saved to the server in this prototype — use them to plan your
        material sell before final quoting.
      </p>
    </section>
  );
}
