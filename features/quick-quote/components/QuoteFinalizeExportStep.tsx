"use client";

import { useCallback, useMemo, useState } from "react";
import { FileDown, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { MaterialType } from "@/types/materials";
import {
  recalcFinalizeLineMetrics,
  type FinalizeDraftLineItem,
} from "../lib/finalizeLineRecalc";
import { formatDecimal } from "@/lib/formatNumbers";
import {
  computeNetBeforeVat,
  computeQuoteTotalInclVat,
  computeVatAmount,
  type QuotePdfFullPayload,
} from "../lib/quotePdfPayload";

interface QuoteFinalizeExportStepProps {
  draft: QuotePdfFullPayload;
  setDraft: React.Dispatch<React.SetStateAction<QuotePdfFullPayload>>;
  /** Material family from General (Carbon / Stainless / Aluminum) — not editable in the table. */
  materialFamilyLabel: string;
  materialType: MaterialType;
  /** Same $/kg map as Pricing step — used for line price and recalculation. */
  materialPricePerKgByRow: Record<string, string>;
}

function PlateShapeIcon({ shape }: { shape: string }) {
  const s = (shape || "flat").toLowerCase();
  if (s === "flat") {
    return (
      <Square
        className="h-4 w-4 text-muted-foreground shrink-0"
        strokeWidth={2}
        aria-hidden
      />
    );
  }
  const labels: Record<string, string> = {
    l: "L",
    z: "Z",
    u: "U",
    omega: "Ω",
    gutter: "Gutter",
    custom: "Custom",
  };
  const label = labels[s] ?? shape;
  return (
    <span
      className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded border border-white/10 bg-white/[0.04] px-1 text-[10px] font-semibold leading-tight text-center"
      title={label}
    >
      {label}
    </span>
  );
}

function num(v: string, fallback = 0): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function int(v: string, fallback = 0): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function roundToMaxDecimals(n: number, maxDp: number): number {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** maxDp;
  return Math.round(n * p) / p;
}

/** Display up to 3 fraction digits (no thousands separators). */
function formatUpTo3Decimals(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
    useGrouping: false,
  }).format(n);
}

/** Part line price: exactly one digit after the decimal. */
function formatLinePrice(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: false,
  }).format(n);
}

/** Sum of line prices from the part breakdown (subtotal before discount / VAT). */
function totalLineSellFromItems(items: FinalizeDraftLineItem[]): number {
  const raw = items.reduce((s, it) => s + Math.max(0, it.line_total), 0);
  return roundToMaxDecimals(raw, 2);
}

/** Job summary totals derived from part lines (PDF cards + export payload). */
function summarizeJobFromItems(items: FinalizeDraftLineItem[]) {
  const total_quantity = items.reduce(
    (s, it) => s + Math.max(0, Math.floor(it.qty)),
    0
  );
  const rawWeight = items.reduce((s, it) => s + Math.max(0, it.weight_kg), 0);
  return {
    total_parts: items.length,
    total_quantity,
    total_weight_kg: roundToMaxDecimals(rawWeight, 3),
  };
}

export function QuoteFinalizeExportStep({
  draft,
  setDraft,
  materialFamilyLabel,
  materialType,
  materialPricePerKgByRow,
}: QuoteFinalizeExportStepProps) {
  const [exporting, setExporting] = useState(false);

  const totalFromLineItems = useMemo(
    () => totalLineSellFromItems(draft.items),
    [draft.items]
  );

  const applyPartRowPatch = useCallback(
    (index: number, patch: Partial<FinalizeDraftLineItem>, recalc: boolean) => {
      setDraft((d) => {
        const items = d.items.map((it, j) => {
          if (j !== index) return it;
          const next: FinalizeDraftLineItem = {
            ...it,
            ...patch,
            material_type: materialFamilyLabel,
            plate_shape: it.plate_shape ?? "flat",
          };
          if (!recalc) return next;
          const { area_m2, weight_kg, line_total } = recalcFinalizeLineMetrics(
            next,
            materialType,
            materialPricePerKgByRow
          );
          return {
            ...next,
            area_m2,
            weight_kg,
            line_total,
          };
        });
        const jobTotals = summarizeJobFromItems(items);
        const lineTotalSum = totalLineSellFromItems(items);
        return {
          ...d,
          items,
          summary: { ...d.summary, ...jobTotals },
          pricing: {
            ...d.pricing,
            total_price: lineTotalSum,
            total_incl_vat: computeQuoteTotalInclVat(
              lineTotalSum,
              d.pricing.discount,
              d.pricing.vat_rate
            ),
          },
        };
      });
    },
    [materialFamilyLabel, materialPricePerKgByRow, materialType, setDraft]
  );

  async function handleExportPdf() {
    if (draft.items.length === 0) return;
    setExporting(true);
    try {
      const totalFromItems = totalLineSellFromItems(draft.items);
      const totalInclVat = computeQuoteTotalInclVat(
        totalFromItems,
        draft.pricing.discount,
        draft.pricing.vat_rate
      );
      const jobTotals = summarizeJobFromItems(draft.items);
      const body: QuotePdfFullPayload = {
        ...draft,
        quote: {
          ...draft.quote,
          notes: draft.quote.notes.map((s) => s.trim()).filter(Boolean),
          terms: [],
        },
        summary: { ...draft.summary, ...jobTotals },
        pricing: {
          ...draft.pricing,
          total_price: totalFromItems,
          total_incl_vat: totalInclVat,
        },
        items: draft.items.map((it) => ({
          ...it,
          material_type: materialFamilyLabel,
          plate_shape: it.plate_shape ?? "flat",
          thickness_mm: roundToMaxDecimals(it.thickness_mm, 3),
          width_mm: roundToMaxDecimals(it.width_mm, 3),
          length_mm: roundToMaxDecimals(it.length_mm, 3),
          area_m2: roundToMaxDecimals(it.area_m2, 3),
          weight_kg: roundToMaxDecimals(it.weight_kg, 3),
          line_total: roundToMaxDecimals(it.line_total, 3),
        })),
      };
      const res = await fetch("/api/quotes/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = (await res.json()) as { error?: string; hint?: string };
          if (j.error) msg = j.error;
          if (j.hint) msg = `${msg}\n${j.hint}`;
        } catch {
          try {
            msg = await res.text();
          } catch {
            /* keep */
          }
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotation-${draft.quote.quote_number.replace(/[^a-zA-Z0-9-_]+/g, "_")}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "PDF export failed.");
    } finally {
      setExporting(false);
    }
  }

  const notesText = draft.quote.notes.join("\n");

  return (
    <div className="space-y-8 pb-12">
      <div className="ds-surface overflow-hidden">
        <div className="ds-surface-header py-4 sm:px-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                Finalize quotation
              </h1>
              <Badge variant="secondary" className="shrink-0 font-normal">
                Review &amp; export
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Edit any field below to match what appears on the customer PDF, then export.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              disabled={exporting || draft.items.length === 0 || !draft.company.name.trim()}
              onClick={() => void handleExportPdf()}
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              {exporting ? "Exporting…" : "Export PDF"}
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Company (letterhead)</CardTitle>
              <CardDescription>Shown at the top and footer of the PDF.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="co-name">Company name</Label>
                <Input
                  id="co-name"
                  value={draft.company.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, company: { ...d.company, name: e.target.value } }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-email">Email</Label>
                <Input
                  id="co-email"
                  type="email"
                  value={draft.company.email}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, company: { ...d.company, email: e.target.value } }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="co-phone">Phone</Label>
                <Input
                  id="co-phone"
                  value={draft.company.phone}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, company: { ...d.company, phone: e.target.value } }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="co-web">Website</Label>
                <Input
                  id="co-web"
                  value={draft.company.website}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, company: { ...d.company, website: e.target.value } }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="co-address">Company address</Label>
                <Textarea
                  id="co-address"
                  value={draft.company.address}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      company: { ...d.company, address: e.target.value },
                    }))
                  }
                  rows={3}
                  className="min-h-[72px] resize-y"
                  placeholder="Street, city, postal code"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quote details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="q-num">Quote number</Label>
                <Input
                  id="q-num"
                  value={draft.quote.quote_number}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, quote_number: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-date">Quote date (YYYY-MM-DD)</Label>
                <Input
                  id="q-date"
                  value={draft.quote.quote_date}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, quote_date: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-valid">Valid until (YYYY-MM-DD)</Label>
                <Input
                  id="q-valid"
                  value={draft.quote.valid_until}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, valid_until: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-cust">Customer name</Label>
                <Input
                  id="q-cust"
                  value={draft.quote.customer_name ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, customer_name: e.target.value || null },
                    }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="q-proj">Project / job name</Label>
                <Input
                  id="q-proj"
                  value={draft.quote.project_name ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, project_name: e.target.value || null },
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Job summary (PDF cards)</CardTitle>
              <CardDescription>
                Totals below are read-only and follow the part breakdown (quantity and weight update
                when you edit lines).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(() => {
                const job = summarizeJobFromItems(draft.items);
                const rows: { key: string; label: string; value: string }[] = [
                  { key: "total_parts", label: "Total parts", value: String(job.total_parts) },
                  { key: "total_quantity", label: "Total quantity", value: String(job.total_quantity) },
                  {
                    key: "total_weight_kg",
                    label: "Total weight (kg)",
                    value: formatUpTo3Decimals(job.total_weight_kg),
                  },
                ];
                return rows.map(({ key, label, value }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-muted-foreground">{label}</Label>
                    <div
                      className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-foreground"
                      aria-readonly
                    >
                      {value}
                    </div>
                  </div>
                ));
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Part breakdown</CardTitle>
              <CardDescription>
                Plate type is from each line (flat vs bend template). Material family matches
                General. Area, weight, and price update when you change quantity, thickness, width,
                or length (same $/kg as Pricing). Currency: {draft.quote.currency}.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs whitespace-nowrap">
                    <TableHead className="w-14 text-center">Plate</TableHead>
                    <TableHead className="min-w-[7rem]">Part number</TableHead>
                    <TableHead className="w-16">Quantity</TableHead>
                    <TableHead className="w-20">Thickness</TableHead>
                    <TableHead className="min-w-[8rem]">Material type</TableHead>
                    <TableHead className="min-w-[6rem]">Material grade</TableHead>
                    <TableHead className="min-w-[5rem]">Finish</TableHead>
                    <TableHead className="w-20">Width (mm)</TableHead>
                    <TableHead className="w-20">Length (mm)</TableHead>
                    <TableHead className="w-24">Area (m²)</TableHead>
                    <TableHead className="w-24">Weight (kg)</TableHead>
                    <TableHead className="w-24 text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.items.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="p-1 text-center align-middle">
                        <div className="flex justify-center">
                          <PlateShapeIcon shape={row.plate_shape ?? "flat"} />
                        </div>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 min-w-[100px]"
                          value={row.part_number}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              items: d.items.map((it, j) =>
                                j === i ? { ...it, part_number: e.target.value } : it
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-14"
                          inputMode="numeric"
                          type="number"
                          step={1}
                          min={0}
                          value={row.qty}
                          onChange={(e) => {
                            const v = Math.max(0, int(e.target.value, row.qty));
                            applyPartRowPatch(i, { qty: v }, true);
                          }}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-20 tabular-nums"
                          inputMode="decimal"
                          type="number"
                          step="0.001"
                          value={roundToMaxDecimals(row.thickness_mm, 3)}
                          onChange={(e) => {
                            const v =
                              e.target.value === ""
                                ? 0
                                : num(e.target.value, row.thickness_mm);
                            applyPartRowPatch(
                              i,
                              { thickness_mm: roundToMaxDecimals(v, 3) },
                              true
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell className="p-1 text-sm text-foreground min-w-[7rem]">
                        {materialFamilyLabel}
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 min-w-[88px]"
                          value={row.material_grade}
                          onChange={(e) =>
                            applyPartRowPatch(i, { material_grade: e.target.value }, true)
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 min-w-[88px]"
                          value={row.finish}
                          onChange={(e) =>
                            applyPartRowPatch(i, { finish: e.target.value }, true)
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-16 tabular-nums"
                          inputMode="decimal"
                          type="number"
                          step="0.001"
                          value={roundToMaxDecimals(row.width_mm, 3)}
                          onChange={(e) => {
                            const v =
                              e.target.value === "" ? 0 : num(e.target.value, row.width_mm);
                            applyPartRowPatch(i, { width_mm: roundToMaxDecimals(v, 3) }, true);
                          }}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-16 tabular-nums"
                          inputMode="decimal"
                          type="number"
                          step="0.001"
                          value={roundToMaxDecimals(row.length_mm, 3)}
                          onChange={(e) => {
                            const v =
                              e.target.value === "" ? 0 : num(e.target.value, row.length_mm);
                            applyPartRowPatch(i, { length_mm: roundToMaxDecimals(v, 3) }, true);
                          }}
                        />
                      </TableCell>
                      <TableCell className="p-1 text-sm tabular-nums text-muted-foreground">
                        {formatUpTo3Decimals(row.area_m2)}
                      </TableCell>
                      <TableCell className="p-1 text-sm tabular-nums text-muted-foreground">
                        {formatUpTo3Decimals(row.weight_kg)}
                      </TableCell>
                      <TableCell className="p-1 text-right text-sm tabular-nums text-foreground">
                        {formatLinePrice(row.line_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pricing summary</CardTitle>
              <CardDescription>
                Total price is the sum of line prices in the part breakdown; it updates when you edit
                lines. Use discount to adjust the net before VAT.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid max-w-xl gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pr-total">Total price ({draft.quote.currency})</Label>
                  <div
                    id="pr-total"
                    className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-foreground"
                    aria-readonly
                  >
                    {formatDecimal(totalFromLineItems, 2)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pr-disc">Discount (optional)</Label>
                  <Input
                    id="pr-disc"
                    inputMode="decimal"
                    placeholder="—"
                    className="tabular-nums"
                    value={draft.pricing.discount ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      setDraft((d) => {
                        const discount = raw === "" ? null : Math.max(0, num(raw, 0));
                        const subtotal = totalLineSellFromItems(d.items);
                        return {
                          ...d,
                          pricing: {
                            ...d.pricing,
                            discount,
                            total_price: subtotal,
                            total_incl_vat: computeQuoteTotalInclVat(
                              subtotal,
                              discount,
                              d.pricing.vat_rate
                            ),
                          },
                        };
                      });
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-vat" className="text-muted-foreground">
                  VAT ({Math.round(draft.pricing.vat_rate * 100)}%)
                </Label>
                <div
                  id="pr-vat"
                  className="flex h-9 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground"
                  aria-readonly
                >
                  {formatDecimal(
                    computeVatAmount(
                      computeNetBeforeVat(totalFromLineItems, draft.pricing.discount),
                      draft.pricing.vat_rate
                    ),
                    2
                  )}{" "}
                  {draft.quote.currency}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pr-incl">Total incl. VAT ({draft.quote.currency})</Label>
                <div
                  id="pr-incl"
                  className="flex h-10 w-full items-center rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-base font-semibold tabular-nums text-foreground"
                  aria-readonly
                >
                  {formatDecimal(
                    computeQuoteTotalInclVat(
                      totalFromLineItems,
                      draft.pricing.discount,
                      draft.pricing.vat_rate
                    ),
                    2
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes &amp; assumptions</CardTitle>
              <CardDescription>One bullet per line.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={6}
                value={notesText}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    quote: {
                      ...d.quote,
                      notes: e.target.value.split("\n"),
                    },
                  }))
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
