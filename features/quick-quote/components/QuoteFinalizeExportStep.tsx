"use client";

import { useState } from "react";
import { ArrowLeft, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { QuotePdfFullPayload } from "../lib/quotePdfPayload";

interface QuoteFinalizeExportStepProps {
  draft: QuotePdfFullPayload;
  setDraft: React.Dispatch<React.SetStateAction<QuotePdfFullPayload>>;
  onBack: () => void;
}

function num(v: string, fallback = 0): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function int(v: string, fallback = 0): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function QuoteFinalizeExportStep({
  draft,
  setDraft,
  onBack,
}: QuoteFinalizeExportStepProps) {
  const [exporting, setExporting] = useState(false);

  async function handleExportPdf() {
    if (draft.items.length === 0) return;
    setExporting(true);
    try {
      const body: QuotePdfFullPayload = {
        ...draft,
        quote: {
          ...draft.quote,
          notes: draft.quote.notes.map((s) => s.trim()).filter(Boolean),
          terms: draft.quote.terms.map((s) => s.trim()).filter(Boolean),
        },
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
  const termsText = draft.quote.terms.join("\n");

  return (
    <div className="space-y-8 pb-12">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/30 px-4 py-4 sm:px-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
            <Button type="button" variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to quote
            </Button>
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
                <Label htmlFor="q-cur">Currency code</Label>
                <Input
                  id="q-cur"
                  value={draft.quote.currency}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, currency: e.target.value.toUpperCase().slice(0, 8) },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-prep">Prepared by</Label>
                <Input
                  id="q-prep"
                  value={draft.quote.prepared_by ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, prepared_by: e.target.value || null },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="q-ref">Reference number</Label>
                <Input
                  id="q-ref"
                  value={draft.quote.reference_number ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, reference_number: e.target.value || null },
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
              <div className="space-y-2">
                <Label htmlFor="q-comp">Customer company</Label>
                <Input
                  id="q-comp"
                  value={draft.quote.customer_company ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, customer_company: e.target.value || null },
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
              <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                <Label htmlFor="q-scope">Scope of work (optional override)</Label>
                <Textarea
                  id="q-scope"
                  rows={3}
                  value={draft.quote.scope_text ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      quote: { ...d.quote, scope_text: e.target.value || null },
                    }))
                  }
                  placeholder="Leave blank to use default scope text on the PDF."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Job summary (PDF cards)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["total_parts", "Total parts", draft.summary.total_parts, "int"] as const,
                  ["total_quantity", "Total quantity", draft.summary.total_quantity, "int"] as const,
                  ["total_weight_kg", "Total weight (kg)", draft.summary.total_weight_kg, "num"] as const,
                  ["net_plate_area_m2", "Net plate area (m²)", draft.summary.net_plate_area_m2, "num"] as const,
                  [
                    "gross_material_area_m2",
                    "Gross material (m²)",
                    draft.summary.gross_material_area_m2,
                    "num",
                  ] as const,
                  [
                    "estimated_sheet_count",
                    "Est. sheets (optional)",
                    draft.summary.estimated_sheet_count,
                    "int-null",
                  ] as const,
                ] as const
              ).map(([key, label, val, kind]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`sum-${key}`}>{label}</Label>
                  <Input
                    id={`sum-${key}`}
                    type="text"
                    inputMode="decimal"
                    value={
                      kind === "int-null"
                        ? val == null
                          ? ""
                          : String(val)
                        : String(val)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      setDraft((d) => {
                        const next = { ...d.summary };
                        if (kind === "int-null") {
                          if (raw.trim() === "") {
                            (next as typeof next & { estimated_sheet_count: number | null }).estimated_sheet_count =
                              null;
                          } else {
                            next.estimated_sheet_count = int(raw);
                          }
                        } else if (kind === "int") {
                          (next as Record<string, number>)[key] = int(raw);
                        } else {
                          (next as Record<string, number>)[key] = num(raw);
                        }
                        return { ...d, summary: next };
                      });
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Part breakdown</CardTitle>
              <CardDescription>Line totals in {draft.quote.currency}.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Part</TableHead>
                    <TableHead className="w-16">Qty</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead className="w-20">Thk mm</TableHead>
                    <TableHead className="w-20">L mm</TableHead>
                    <TableHead className="w-20">W mm</TableHead>
                    <TableHead className="w-24">Weight kg</TableHead>
                    <TableHead className="w-28 text-right">Line total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.items.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 min-w-[100px]"
                          value={row.part_name}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              items: d.items.map((it, j) =>
                                j === i ? { ...it, part_name: e.target.value } : it
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-14"
                          inputMode="numeric"
                          value={row.qty}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              items: d.items.map((it, j) =>
                                j === i ? { ...it, qty: int(e.target.value, it.qty) } : it
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 min-w-[80px]"
                          value={row.material}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              items: d.items.map((it, j) =>
                                j === i ? { ...it, material: e.target.value } : it
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-16"
                          inputMode="decimal"
                          value={row.thickness_mm}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              items: d.items.map((it, j) =>
                                j === i ? { ...it, thickness_mm: num(e.target.value, it.thickness_mm) } : it
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-16"
                          inputMode="numeric"
                          value={row.length_mm}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              items: d.items.map((it, j) =>
                                j === i ? { ...it, length_mm: num(e.target.value, it.length_mm) } : it
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-16"
                          inputMode="numeric"
                          value={row.width_mm}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              items: d.items.map((it, j) =>
                                j === i ? { ...it, width_mm: num(e.target.value, it.width_mm) } : it
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-20"
                          inputMode="decimal"
                          value={row.weight_kg}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              items: d.items.map((it, j) =>
                                j === i ? { ...it, weight_kg: num(e.target.value, it.weight_kg) } : it
                              ),
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          className="h-8 w-24 text-right"
                          inputMode="decimal"
                          value={row.line_total}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              items: d.items.map((it, j) =>
                                j === i ? { ...it, line_total: num(e.target.value, it.line_total) } : it
                              ),
                            }))
                          }
                        />
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
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl">
              {(
                [
                  ["material_cost", "Material cost"] as const,
                  ["processing_cost", "Processing cost"] as const,
                  ["subtotal", "Subtotal"] as const,
                  ["final_total", "Final total"] as const,
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`pr-${key}`}>{label}</Label>
                  <Input
                    id={`pr-${key}`}
                    inputMode="decimal"
                    value={draft.pricing[key]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        pricing: { ...d.pricing, [key]: num(e.target.value, d.pricing[key]) },
                      }))
                    }
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="pr-disc">Discount (optional)</Label>
                <Input
                  id="pr-disc"
                  inputMode="decimal"
                  placeholder="None"
                  value={draft.pricing.discount ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    setDraft((d) => ({
                      ...d,
                      pricing: {
                        ...d.pricing,
                        discount: raw === "" ? null : num(raw, 0),
                      },
                    }));
                  }}
                />
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Terms</CardTitle>
              <CardDescription>One item per line.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={5}
                value={termsText}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    quote: {
                      ...d.quote,
                      terms: e.target.value.split("\n"),
                    },
                  }))
                }
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onBack}>
          ← Back to quote
        </Button>
        <Button
          type="button"
          disabled={exporting || draft.items.length === 0 || !draft.company.name.trim()}
          onClick={() => void handleExportPdf()}
        >
          <FileDown className="h-4 w-4 mr-1.5" />
          {exporting ? "Exporting…" : "Export PDF"}
        </Button>
      </div>
    </div>
  );
}
