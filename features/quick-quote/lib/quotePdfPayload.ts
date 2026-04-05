/**
 * Builds the JSON body for POST /api/quotes/export-pdf (merged with company on the server).
 */

import { getAppPreferences } from "@/lib/settings/appPreferences";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/types/materials";
import {
  materialPricingRowKey,
  parseMaterialPricePerKg,
} from "../job-overview/materialCalculations";
import { splitMaterialGradeAndFinish } from "./plateFields";
import type {
  JobSummaryMetrics,
  ManufacturingParameters,
  PricingSummary,
  QuickQuoteJobDetails,
  QuotePartRow,
} from "../types/quickQuote";

function lineMaterialSellFromPart(
  p: QuotePartRow,
  materialType: MaterialType,
  pricePerKgByRow: Record<string, string>
): number {
  const lineWeightKg =
    Math.max(0, p.weightKg) * Math.max(0, Math.floor(p.qty));
  const key = materialPricingRowKey(p, materialType);
  const pricePerKg = parseMaterialPricePerKg(pricePerKgByRow[key] ?? "");
  return lineWeightKg * pricePerKg;
}

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
    part_number: string;
    qty: number;
    thickness_mm: number;
    material_type: string;
    material_grade: string;
    finish: string;
    width_mm: number;
    length_mm: number;
    area_m2: number;
    /** Line weight (unit weight × quantity), kg */
    weight_kg: number;
    /** Line price */
    line_total: number;
    /** `flat` or bend template id (l, u, z, omega, gutter, custom). */
    plate_shape: string;
  }>;
  /** Finalize-step pricing: total before VAT, optional discount, VAT rate, total incl. VAT. */
  pricing: {
    total_price: number;
    discount: number | null;
    vat_rate: number;
    total_incl_vat: number;
  };
}

/** Net after optional discount; never negative. */
export function computeNetBeforeVat(totalPrice: number, discount: number | null): number {
  return Math.max(0, totalPrice - (discount ?? 0));
}

export function computeQuoteTotalInclVat(
  totalPrice: number,
  discount: number | null,
  vatRate: number
): number {
  const net = computeNetBeforeVat(totalPrice, discount);
  return Math.round(net * (1 + vatRate) * 100) / 100;
}

export function computeVatAmount(netBeforeVat: number, vatRate: number): number {
  return Math.round(netBeforeVat * vatRate * 100) / 100;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

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
  materialType: MaterialType,
  materialPricePerKgByRow: Record<string, string>,
  options?: Parameters<typeof buildQuotePdfRequestBody>[7]
): QuotePdfFullPayload {
  return {
    company: getDefaultPdfCompany(),
    ...buildQuotePdfRequestBody(
      jobDetails,
      jobSummary,
      parts,
      mfgParams,
      pricing,
      materialType,
      materialPricePerKgByRow,
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
  materialType: MaterialType,
  materialPricePerKgByRow: Record<string, string>,
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

  const totalPrice = Math.max(0, pricing.finalEstimatedPrice);
  const discountInitial: number | null = null;
  const vatRate = 0.18;
  const totalInclVat = computeQuoteTotalInclVat(totalPrice, discountInitial, vatRate);

  const materialFamilyLabel = MATERIAL_TYPE_LABELS[materialType];

  const items = parts.map((p) => {
    const { grade, finish } = splitMaterialGradeAndFinish(p.material);
    const lineSell = lineMaterialSellFromPart(
      p,
      materialType,
      materialPricePerKgByRow
    );
    return {
      part_number: p.partName,
      qty: p.qty,
      thickness_mm: p.thicknessMm,
      material_type: materialFamilyLabel,
      material_grade: grade === "—" ? "" : grade,
      finish: finish === "—" ? "" : finish,
      width_mm: p.widthMm,
      length_mm: p.lengthMm,
      area_m2: p.areaM2 * p.qty,
      weight_kg: p.weightKg * p.qty,
      line_total: Math.max(0, lineSell),
      plate_shape: p.bendTemplateId ?? "flat",
    };
  });

  const notes =
    options?.notes && options.notes.length > 0 ? options.notes : [...DEFAULT_NOTES];
  const terms = options?.terms && options.terms.length > 0 ? options.terms : [];

  const rawNotes = jobDetails.notes?.trim() ?? "";
  const projectFromGeneral = jobDetails.projectName?.trim() ?? "";
  const projectName =
    projectFromGeneral.length > 0
      ? projectFromGeneral
      : rawNotes.length > 0 && rawNotes.length <= 120
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
      total_price: totalPrice,
      discount: discountInitial,
      vat_rate: vatRate,
      total_incl_vat: totalInclVat,
    },
  };
}
