import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeLetterheadCompanyName } from "@/features/quick-quote/lib/quotePdfPayload";
import type { QuotePdfMergedPayload } from "@/lib/server/quotePdf/buildQuoteTemplateContext";
import {
  renderQuotePdfToBuffer,
  shouldUseNodeQuotePdfRenderer,
} from "@/lib/server/quotePdf/renderQuotePdfNode";

export const runtime = "nodejs";
export const maxDuration = 60;

const execFileAsync = promisify(execFile);

const quoteBlockSchema = z.object({
  quote_number: z.string().min(1),
  quote_date: z.string().min(1),
  valid_until: z.string().min(1),
  currency: z.string().min(1),
  prepared_by: z.string().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  customer_company: z.string().nullable().optional(),
  project_name: z.string().nullable().optional(),
  reference_number: z.string().nullable().optional(),
  scope_text: z.string().nullable().optional(),
  notes: z.array(z.string()).optional().default([]),
  terms: z.array(z.string()).optional().default([]),
});

const summarySchema = z.object({
  total_parts: z.number().int().nonnegative(),
  total_quantity: z.number().int().nonnegative(),
  total_weight_kg: z.number().nonnegative(),
  net_plate_area_m2: z.number().nonnegative(),
  gross_material_area_m2: z.number().nonnegative(),
  estimated_sheet_count: z.number().int().nonnegative().nullable().optional(),
});

const itemSchema = z.object({
  part_number: z.string().min(1),
  qty: z.number().int().nonnegative(),
  thickness_mm: z.number().nonnegative(),
  material_type: z.string(),
  material_grade: z.string(),
  finish: z.string(),
  width_mm: z.number().nonnegative(),
  length_mm: z.number().nonnegative(),
  area_m2: z.number().nonnegative(),
  weight_kg: z.number().nonnegative(),
  line_total: z.number().nonnegative(),
  plate_shape: z.string().optional(),
  description: z.string().optional(),
  source_row_id: z.string().optional(),
  corrugated: z.boolean().optional(),
});

const pricingSchema = z.object({
  total_price: z.number().nonnegative(),
  discount: z.number().nonnegative().nullable().optional(),
  vat_rate: z.number().nonnegative(),
  total_incl_vat: z.number().nonnegative(),
});

const companySchema = z.object({
  name: z.string(),
  registration: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

const clientBodySchema = z.object({
  company: companySchema.optional(),
  quote: quoteBlockSchema,
  summary: summarySchema,
  items: z.array(itemSchema).min(1),
  pricing: pricingSchema,
});

function companyFromEnv() {
  return {
    name: sanitizeLetterheadCompanyName(process.env.QUOTE_PDF_COMPANY_NAME?.trim() || ""),
    registration: process.env.QUOTE_PDF_COMPANY_REGISTRATION?.trim() || null,
    logo_path: process.env.QUOTE_PDF_LOGO_PATH?.trim() || null,
    email: process.env.QUOTE_PDF_COMPANY_EMAIL?.trim() || null,
    phone: process.env.QUOTE_PDF_COMPANY_PHONE?.trim() || null,
    website: process.env.QUOTE_PDF_COMPANY_WEBSITE?.trim() || null,
    address: process.env.QUOTE_PDF_COMPANY_ADDRESS?.trim() || null,
  };
}

function mergeCompany(
  fromClient: z.infer<typeof companySchema> | undefined,
  fromEnv: ReturnType<typeof companyFromEnv>
) {
  if (!fromClient) return fromEnv;
  const empty = (s: string | null | undefined) => {
    const t = typeof s === "string" ? s.trim() : "";
    return t === "" ? null : t;
  };
  return {
    name: sanitizeLetterheadCompanyName(fromClient.name.trim()),
    registration: empty(fromClient.registration) ?? fromEnv.registration,
    logo_path: fromEnv.logo_path,
    email: empty(fromClient.email),
    phone: empty(fromClient.phone),
    website: empty(fromClient.website),
    address: empty(fromClient.address) ?? fromEnv.address,
  };
}

function pythonExecutable(): string {
  return (
    process.env.QUOTE_PDF_PYTHON?.trim() ||
    (process.platform === "win32" ? "python" : "python3")
  );
}

function buildPythonArgs(scriptPath: string, inputPath: string, outputPath: string): string[] {
  return [scriptPath, "--input", inputPath, "--output", outputPath];
}

function safeFilename(ref: string): string {
  const s = ref.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 80);
  return s || "quotation";
}

/**
 * POST /api/quotes/export-pdf
 * Body: quote payload; optional `company` from the finalize step overrides letterhead text.
 * Logo path always comes from env (QUOTE_PDF_LOGO_PATH) when set.
 * Production (Vercel): Nunjucks + Puppeteer + @sparticuz/chromium (no Python).
 * Local: `server/pdf/render_quote_pdf.py` (Playwright + Chromium) when Python is available.
 */
export async function POST(req: Request) {
  let parsed: z.infer<typeof clientBodySchema>;
  try {
    const json = await req.json();
    parsed = clientBodySchema.parse(json);
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.message : "Invalid JSON body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { company: clientCompany, ...rest } = parsed;
  const payload = {
    company: mergeCompany(clientCompany, companyFromEnv()),
    ...rest,
  } satisfies QuotePdfMergedPayload;

  const name = safeFilename(parsed.quote.quote_number);

  if (shouldUseNodeQuotePdfRenderer()) {
    try {
      const pdf = await renderQuotePdfToBuffer(payload);
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="quotation-${name}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "PDF rendering failed (Node/Chromium).";
      console.error("[export-pdf] node", err);
      return NextResponse.json(
        {
          error: message,
          hint: "Serverless PDF uses @sparticuz/chromium; check Vercel function logs and bundle size.",
        },
        { status: 503 }
      );
    }
  }

  const pdfDir = path.join(process.cwd(), "server", "pdf");
  const scriptPath = path.resolve(pdfDir, "render_quote_pdf.py");

  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "plate-quote-pdf-"));
  const inputPath = path.join(tmpRoot, "payload.json");
  const outputPath = path.join(tmpRoot, "out.pdf");

  try {
    await writeFile(inputPath, JSON.stringify(payload), "utf8");

    const exe = pythonExecutable();
    const args = buildPythonArgs(scriptPath, inputPath, outputPath);

    await execFileAsync(exe, args, {
      cwd: pdfDir,
      env: { ...process.env, PYTHONUTF8: "1" },
      maxBuffer: 32 * 1024 * 1024,
    });

    const pdf = await readFile(outputPath);

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quotation-${name}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "PDF rendering failed. Is Python Playwright installed?";
    console.error("[export-pdf]", err);
    return NextResponse.json(
      {
        error: message,
        hint: "Install: pip install -r server/requirements-pdf.txt && playwright install chromium",
      },
      { status: 503 }
    );
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}
