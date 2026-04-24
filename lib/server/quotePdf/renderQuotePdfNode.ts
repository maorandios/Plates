import path from "node:path";
import nunjucks from "nunjucks";
import defaultPuppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import {
  buildQuoteTemplateContext,
  type QuotePdfMergedPayload,
} from "./buildQuoteTemplateContext";
import { QUOTE_PDF_FOOTER_TEMPLATE, QUOTE_PDF_HEADER_TEMPLATE } from "./quoteFooterTemplate";

const puppeteer = defaultPuppeteer;

function configureNunjucksEnv(): nunjucks.Environment {
  const dir = path.join(process.cwd(), "server", "pdf");
  return nunjucks.configure(dir, { autoescape: true, noCache: true });
}

export async function renderQuoteHtmlString(payload: QuotePdfMergedPayload): Promise<string> {
  const ctx = await buildQuoteTemplateContext(payload);
  const env = configureNunjucksEnv();
  return env.render("quote_template.html", ctx);
}

export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const executablePath = await chromium.executablePath();
  const browser: Browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      "--hide-scrollbars",
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
    executablePath,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "load", timeout: 90_000 });
    await new Promise((r) => setTimeout(r, 800));
    const pdf = await page.pdf({
      format: "A4",
      landscape: false,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: QUOTE_PDF_HEADER_TEMPLATE,
      footerTemplate: QUOTE_PDF_FOOTER_TEMPLATE,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function renderQuotePdfToBuffer(payload: QuotePdfMergedPayload): Promise<Buffer> {
  const html = await renderQuoteHtmlString(payload);
  return renderHtmlToPdfBuffer(html);
}

export function shouldUseNodeQuotePdfRenderer(): boolean {
  return process.env.VERCEL === "1" || process.env.QUOTE_PDF_USE_NODE === "1";
}
