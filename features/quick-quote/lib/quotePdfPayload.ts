/**
 * Builds the JSON body for POST /api/quotes/export-pdf (merged with company on the server).
 */

import { getAppPreferences } from "@/lib/settings/appPreferences";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  PricingSummary,
  QuickQuoteJobDetails,
  QuotePartRow,
} from "../types/quickQuote";

/** Sender / letterhead block (editable before PDF export). */
export interface QuotePdfCompanyBlock {
  name: string;
  email: string;
  phone: string;
  website: string;
  /** Letterhead address (multi-line supported). */
  address: string;
}

/** Full POST body including company (finalize step). */
export type QuotePdfFullPayload = { company: QuotePdfCompanyBlock } & QuotePdfRequestBody;

export interface QuotePdfRequestBody {
  quote: {
    quote_number: string;
    quote_date: string;
    valid_until: string;
    currency: string;
    prepared_by: string | null;
    customer_name: string | null;
    customer_company: string | null;
    project_name: string | null;
    reference_number: string | null;
    scope_text: string | null;
    notes: string[];
    terms: string[];
  };
  summary: {
    total_parts: number;
    total_quantity: number;
    total_weight_kg: number;
    net_plate_area_m2: number;
    gross_material_area_m2: number;
    estimated_sheet_count: number | null;
  };
  items: Array<{
    part_name: string;
    qty: number;
    material: string;
    thickness_mm: number;
    length_mm: number;
    width_mm: number;
    weight_kg: number;
    line_total: number;
  }>;
  pricing: {
    material_cost: number;
    processing_cost: number;
    subtotal: number;
    discount: number | null;
    final_total: number;
  };
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEFAULT_TERMS = [
  "This quotation is valid for the period stated on the cover.",
  "Prices exclude VAT unless stated otherwise.",
  "Lead time is subject to final confirmation upon order.",
];

const DEFAULT_NOTES = [
  "Based on uploaded DXF files and provided quote information.",
  "Final production nesting is not included at this quotation stage.",
  "Surface treatment is excluded unless explicitly stated.",
  "Delivery is excluded unless explicitly stated.",
];

function envCompanyDefaults(): QuotePdfCompanyBlock {
  return {
    name: process.env.NEXT_PUBLIC_QUOTE_COMPANY_NAME?.trim() || "Fabrication partner",
    email: process.env.NEXT_PUBLIC_QUOTE_COMPANY_EMAIL?.trim() || "",
    phone: process.env.NEXT_PUBLIC_QUOTE_COMPANY_PHONE?.trim() || "",
    website: process.env.NEXT_PUBLIC_QUOTE_COMPANY_WEBSITE?.trim() || "",
    address: process.env.NEXT_PUBLIC_QUOTE_COMPANY_ADDRESS?.trim() || "",
  };
}

/** Company block for PDF and finalize step: Settings overrides, then env, then fallbacks. */
export function getDefaultPdfCompany(): QuotePdfCompanyBlock {
  const base = envCompanyDefaults();
  if (typeof window === "undefined") return base;
  const p = getAppPreferences();
  return {
    name: (p.companyName?.trim() || base.name) || "Fabrication partner",
    email: (p.companyEmail?.trim() ?? base.email) || "",
    phone: (p.companyPhone?.trim() ?? base.phone) || "",
    website: (p.companyWebsite?.trim() ?? base.website) || "",
    address: (p.companyAddress?.trim() ?? base.address) || "",
  };
}

export function buildQuotePdfFullPayload(
  jobDetails: QuickQuoteJobDetails,
  jobSummary: JobSummaryMetrics,
  parts: QuotePartRow[],
  mfgParams: ManufacturingParameters,
  pricing: PricingSummary,
  options?: Parameters<typeof buildQuotePdfRequestBody>[5]
): QuotePdfFullPayload {
  return {
    company: getDefaultPdfCompany(),
    ...buildQuotePdfRequestBody(
      jobDetails,
      jobSummary,
      parts,
      mfgParams,
      pricing,
      options
    ),
  };
}

export function buildQuotePdfRequestBody(
  jobDetails: QuickQuoteJobDetails,
  jobSummary: JobSummaryMetrics,
  parts: QuotePartRow[],
  mfgParams: ManufacturingParameters,
  pricing: PricingSummary,
  options?: {
    quoteDateIso?: string;
    validDays?: number;
    preparedBy?: string | null;
    scopeText?: string | null;
    notes?: string[];
    terms?: string[];
  }
): QuotePdfRequestBody {
  const quoteDate = options?.quoteDateIso ?? new Date().toISOString().slice(0, 10);
  const validDays = options?.validDays ?? 14;
  const validUntil = addDaysIso(quoteDate, validDays);

  const processingCost =
    pricing.cuttingCost +
    pricing.piercingCost +
    pricing.setupCost +
    pricing.overhead;
  const subtotal = pricing.materialCost + processingCost;

  const items = parts.map((p) => ({
    part_name: p.partName,
    qty: p.qty,
    material: p.material,
    thickness_mm: p.thicknessMm,
    length_mm: p.lengthMm,
    width_mm: p.widthMm,
    weight_kg: p.weightKg * p.qty,
    line_total: Math.max(0, p.estimatedLineCost),
  }));

  const notes =
    options?.notes && options.notes.length > 0 ? options.notes : [...DEFAULT_NOTES];
  const terms =
    options?.terms && options.terms.length > 0 ? options.terms : [...DEFAULT_TERMS];

  const rawNotes = jobDetails.notes?.trim() ?? "";
  const projectName =
    rawNotes.length > 0 && rawNotes.length <= 120
      ? rawNotes
      : jobDetails.referenceNumber || null;

  return {
    quote: {
      quote_number: jobDetails.referenceNumber,
      quote_date: quoteDate,
      valid_until: validUntil,
      currency: jobDetails.currency,
      prepared_by: options?.preparedBy ?? null,
      customer_name: jobDetails.customerName || null,
      customer_company: null,
      project_name: projectName,
      reference_number: jobDetails.referenceNumber,
      scope_text: options?.scopeText ?? null,
      notes,
      terms,
    },
    summary: {
      total_parts: jobSummary.uniqueParts,
      total_quantity: jobSummary.totalQty,
      total_weight_kg: jobSummary.totalEstWeightKg,
      net_plate_area_m2: mfgParams.totalNetPlateAreaM2,
      gross_material_area_m2: mfgParams.totalSheetAreaM2,
      estimated_sheet_count: mfgParams.estimatedSheetCount,
    },
    items,
    pricing: {
      material_cost: pricing.materialCost,
      processing_cost: processingCost,
      subtotal,
      discount: null,
      final_total: pricing.finalEstimatedPrice,
    },
  };
}
