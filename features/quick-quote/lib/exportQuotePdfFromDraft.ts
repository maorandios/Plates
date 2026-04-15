/**
 * POST /api/quotes/export-pdf — same payload shape as {@link QuoteFinalizeExportStep} export.
 */

import {
  computeQuoteTotalInclVat,
  type QuotePdfFullPayload,
} from "./quotePdfPayload";
import { finalizePlateTypeLabel } from "./finalizePlateTypeLabel";

function roundToMaxDecimals(n: number, maxDp: number): number {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** maxDp;
  return Math.round(n * p) / p;
}

function summarizeJobFromItems(items: QuotePdfFullPayload["items"]) {
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

export async function exportQuotePdfFromDraft(
  draft: QuotePdfFullPayload,
  materialFamilyLabel: string
): Promise<void> {
  if (draft.items.length === 0) return;
  if (!draft.company.name.trim()) return;

  const quoteDateIso = draft.quote.quote_date;
  const validUntilIso = draft.quote.valid_until;

  const subtotal = draft.pricing.total_price;
  const totalInclVat = computeQuoteTotalInclVat(
    subtotal,
    draft.pricing.discount,
    draft.pricing.vat_rate
  );
  const jobTotals = summarizeJobFromItems(draft.items);

  const body: QuotePdfFullPayload = {
    ...draft,
    quote: {
      ...draft.quote,
      quote_date: quoteDateIso,
      valid_until: validUntilIso,
      notes: draft.quote.notes.map((s) => s.trim()).filter(Boolean),
      terms: [],
    },
    summary: { ...draft.summary, ...jobTotals },
    pricing: {
      ...draft.pricing,
      total_price: subtotal,
      total_incl_vat: totalInclVat,
    },
    items: draft.items.map((it) => ({
      ...it,
      material_type: materialFamilyLabel,
      plate_shape: it.plate_shape ?? "flat",
      description: finalizePlateTypeLabel(it.plate_shape),
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
}
