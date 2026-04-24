import { readFile } from "fs/promises";
import path from "node:path";
import { sanitizeLetterheadCompanyName } from "@/features/quick-quote/lib/quotePdfPayload";
import {
  formatCurrency,
  formatCurrencyAmountCeilInt,
  formatCurrencyAmountOnly,
  formatDateIl,
  formatIntComma,
  formatKg,
  formatKgTableCell,
  formatMetricKgOneDecimal,
  formatMetricM2TwoDecimals,
  formatM2,
  formatMmOneHe,
  formatQty,
  formatThicknessMmHe,
  formatThicknessMmTableCell,
} from "./quotePdfFormatters";

const PLACEHOLDER_COMPANY = "fabrication partner";

function sanitizeLetterheadDisplayName(name: string | null | undefined): string {
  const t = (name ?? "").trim();
  if (!t) return "";
  if (t.toLowerCase() === PLACEHOLDER_COMPANY) return "";
  return sanitizeLetterheadCompanyName(t);
}

async function logoDataUri(logoPath: string | null | undefined): Promise<string | null> {
  if (!logoPath?.trim()) return null;
  const p = path.resolve(logoPath.trim());
  try {
    const buf = await readFile(p);
    const ext = path.extname(p).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export type QuotePdfMergedPayload = {
  company: {
    name: string;
    registration?: string | null;
    logo_path?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
  };
  quote: {
    quote_number: string;
    quote_date: string;
    valid_until: string;
    currency: string;
    prepared_by?: string | null;
    customer_name?: string | null;
    customer_company?: string | null;
    project_name?: string | null;
    reference_number?: string | null;
    scope_text?: string | null;
    notes?: string[];
    terms?: string[];
  };
  summary: {
    total_parts: number;
    total_quantity: number;
    total_weight_kg: number;
    net_plate_area_m2: number;
    gross_material_area_m2: number;
    estimated_sheet_count?: number | null;
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
    weight_kg: number;
    line_total: number;
    plate_shape?: string;
    description?: string;
    source_row_id?: string;
    corrugated?: boolean;
  }>;
  pricing: {
    total_price: number;
    discount?: number | null;
    vat_rate: number;
    total_incl_vat: number;
  };
};

export async function buildQuoteTemplateContext(
  payload: QuotePdfMergedPayload
): Promise<Record<string, unknown>> {
  const q = payload.quote;
  const cur = q.currency.trim();
  const cc = payload.company;
  const pr = payload.pricing;

  const areaSumLines = payload.items.reduce((s, it) => s + Number(it.area_m2), 0);

  const kpiCards = [
    { label: "סוגי פלטות", value: formatIntComma(payload.summary.total_parts) },
    { label: "כמות פלטות", value: formatQty(payload.summary.total_quantity) },
    { label: "שטח (מ״ר)", value: formatM2(areaSumLines) },
    { label: "משקל (ק״ג)", value: formatKg(payload.summary.total_weight_kg) },
    { label: "הצעת מחיר", value: formatCurrency(pr.total_price, cur) },
  ];

  const technicalRows: { label: string; value: string }[] = [
    { label: "שטח נטו (לפי מערכת)", value: formatM2(payload.summary.net_plate_area_m2) },
    {
      label: "שטח חומר גלם משוער",
      value: formatM2(payload.summary.gross_material_area_m2),
    },
  ];
  if (payload.summary.estimated_sheet_count != null) {
    technicalRows.push({
      label: "מספר לוחות משוער",
      value: formatIntComma(Math.trunc(payload.summary.estimated_sheet_count)),
    });
  }

  const scopeText = (q.scope_text ?? "").trim();
  const scopeHas = Boolean(scopeText);

  const itemRows: Array<Record<string, string>> = [];
  const unifiedPlateRows: Array<Record<string, string>> = [];
  for (let idx = 0; idx < payload.items.length; idx++) {
    const it = payload.items[idx]!;
    const i = idx + 1;
    const desc = (it.description ?? "").trim() || "—";
    const mtype = (it.material_type ?? "").trim() || "—";
    const mgrade = (it.material_grade ?? "").trim() || "—";
    const fin = (it.finish ?? "").trim() || "—";
    const wKg = Number(it.weight_kg);
    const pricePerKg =
      wKg > 0 ? formatCurrencyAmountOnly(Number(it.line_total) / wKg, cur) : "—";
    itemRows.push({
      description: desc,
      part_number: it.part_number,
      qty: formatQty(it.qty),
      thickness: it.thickness_mm ? formatThicknessMmHe(it.thickness_mm) : "—",
      material_type: mtype,
      material_grade: mgrade,
      finish: fin,
      width_mm: it.width_mm ? formatMmOneHe(it.width_mm) : "—",
      length_mm: it.length_mm ? formatMmOneHe(it.length_mm) : "—",
      area_m2: it.area_m2 ? formatM2(it.area_m2) : "—",
      weight: formatKg(it.weight_kg),
      line_total: formatCurrency(it.line_total, cur),
    });
    unifiedPlateRows.push({
      index: String(i),
      material: mtype,
      description: desc,
      part_number: it.part_number,
      qty: formatQty(it.qty),
      thickness: formatThicknessMmTableCell(it.thickness_mm),
      weight: formatKgTableCell(it.weight_kg),
      material_grade: mgrade,
      finish: fin,
      corrugated: it.corrugated ? "כן" : "לא",
      price_per_kg: pricePerKg,
      line_total: formatCurrencyAmountOnly(it.line_total, cur),
    });
  }

  const discountFmt =
    pr.discount != null && pr.discount > 0
      ? formatCurrency(pr.discount, cur)
      : null;
  const net = Math.max(0, Number(pr.total_price) - (pr.discount != null ? Number(pr.discount) : 0));
  const vatRate = Number(pr.vat_rate);
  const vatAmount = Math.round(net * vatRate * 100) / 100;
  const vatPct = Math.round(vatRate * 100);
  const pricingVatLabel = `מע״מ (${vatPct}%)`;

  const rawNotes = q.notes ?? [];
  const notesLines = rawNotes.map((x) => String(x).trim()).filter(Boolean);
  const notesForPdf = notesLines.length > 0 ? notesLines : ["ללא"];
  const rawTerms = q.terms ?? [];
  const termsLines = rawTerms.map((x) => String(x).trim()).filter(Boolean);

  const pdfDir = path.join(process.cwd(), "server", "pdf");
  const cssText = await readFile(path.join(pdfDir, "quote_template.css"), "utf8");

  const addrRaw = (cc.address ?? "").trim();
  const companyAddressLines = addrRaw
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const sm = payload.summary;
  const prc = pr.total_price;

  return {
    css_text: cssText,
    logo_data_uri: await logoDataUri(cc.logo_path),
    company_name: sanitizeLetterheadDisplayName(cc.name),
    company_registration: (cc.registration ?? "").trim(),
    company_email: cc.email ?? "",
    company_phone: cc.phone ?? "",
    company_website: cc.website ?? "",
    company_address_lines: companyAddressLines,
    quote_number: q.quote_number,
    quote_date: formatDateIl(q.quote_date),
    valid_until: formatDateIl(q.valid_until),
    customer_name: q.customer_name ?? "",
    customer_company: q.customer_company ?? "",
    project_name: q.project_name ?? "",
    reference_number: q.reference_number ?? "",
    currency: cur,
    prepared_by: q.prepared_by ?? "",
    kpi_cards: kpiCards,
    technical_rows: technicalRows,
    scope_has: scopeHas,
    scope_text: scopeText,
    item_rows: itemRows,
    unified_plate_rows: unifiedPlateRows,
    pricing_subtotal: formatCurrency(pr.total_price, cur),
    pricing_discount: discountFmt,
    pricing_net_after_discount: formatCurrency(net, cur),
    pricing_vat_label: pricingVatLabel,
    pricing_vat_amount: formatCurrency(vatAmount, cur),
    pricing_total_incl_vat: formatCurrency(pr.total_incl_vat, cur),
    has_discount: pr.discount != null && Number(pr.discount) > 0,
    notes_lines: notesForPdf,
    terms_lines: termsLines,
    footer_generated: "מסמך הופק אלקטרונית · ללא חתימה ידנית.",
    metric_plate_types: formatIntComma(Math.trunc(sm.total_parts)),
    metric_plate_qty: formatIntComma(Math.trunc(sm.total_quantity)),
    metric_area: formatMetricM2TwoDecimals(sm.net_plate_area_m2),
    metric_weight: formatMetricKgOneDecimal(sm.total_weight_kg),
    metric_price_num: formatCurrencyAmountCeilInt(prc),
  };
}
