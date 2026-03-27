#!/usr/bin/env python3
"""
Render customer quotation PDF from JSON payload using Jinja2 + Playwright (Chromium).

Usage:
  python render_quote_pdf.py --input payload.json --output quote.pdf
  python render_quote_pdf.py --sample [--output quote-sample.pdf]
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import mimetypes
import sys
from datetime import date, timedelta
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from quote_pdf_formatters import (
    format_currency,
    format_date_display,
    format_int_space,
    format_kg,
    format_m2,
    format_qty,
    format_size_mm,
    format_thickness_mm,
)
from quote_pdf_types import QuotePdfPayload

DIR = Path(__file__).resolve().parent

DEFAULT_NOTES = [
    "Based on uploaded DXF files and provided quote information.",
    "Final production nesting is not included at this quotation stage.",
    "Surface treatment is excluded unless explicitly stated.",
    "Delivery is excluded unless explicitly stated.",
]

DEFAULT_TERMS = [
    "This quotation is valid for the period stated on the cover.",
    "Prices exclude VAT unless stated otherwise.",
    "Lead time is subject to final confirmation upon order.",
]


def _logo_data_uri(logo_path: str | None) -> str | None:
    if not logo_path:
        return None
    p = Path(logo_path).expanduser().resolve()
    if not p.is_file():
        return None
    mime, _ = mimetypes.guess_type(str(p))
    if mime not in ("image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"):
        mime = "image/png"
    data = base64.standard_b64encode(p.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def build_template_context(payload: QuotePdfPayload) -> dict:
    q = payload.quote
    cur = q.currency.strip()
    cc = payload.company

    summary_cards = [
        {"label": "Total parts", "value": format_int_space(payload.summary.total_parts), "hint": None},
        {"label": "Total quantity", "value": format_qty(payload.summary.total_quantity), "hint": None},
        {"label": "Total weight", "value": format_kg(payload.summary.total_weight_kg), "hint": None},
        {"label": "Net plate area", "value": format_m2(payload.summary.net_plate_area_m2), "hint": None},
        {
            "label": "Est. material required",
            "value": format_m2(payload.summary.gross_material_area_m2),
            "hint": None,
        },
    ]
    if payload.summary.estimated_sheet_count is not None:
        summary_cards.append(
            {
                "label": "Estimated sheets",
                "value": format_int_space(int(payload.summary.estimated_sheet_count)),
                "hint": None,
            }
        )

    scope_primary = (q.scope_text or "").strip() or (
        "Supply and cutting of steel plates based on the provided drawings and quote data."
    )
    scope_secondary = "Material grades and thicknesses are as listed in the part breakdown below."

    item_rows = []
    for it in payload.items:
        item_rows.append(
            {
                "part_name": it.part_name,
                "qty": format_qty(it.qty),
                "material": it.material or "—",
                "thickness": format_thickness_mm(it.thickness_mm) if it.thickness_mm else "—",
                "size": format_size_mm(it.length_mm, it.width_mm)
                if (it.length_mm and it.width_mm)
                else "—",
                "weight": format_kg(it.weight_kg),
                "line_total": format_currency(it.line_total, cur),
            }
        )

    pr = payload.pricing
    discount_fmt = format_currency(pr.discount, cur) if pr.discount else None

    raw_notes = list(q.notes) if q.notes else []
    notes_lines = [str(x).strip() for x in raw_notes if str(x).strip()]
    if not notes_lines:
        notes_lines = list(DEFAULT_NOTES)
    raw_terms = list(q.terms) if q.terms else []
    terms_lines = [str(x).strip() for x in raw_terms if str(x).strip()]
    if not terms_lines:
        terms_lines = list(DEFAULT_TERMS)

    css_text = (DIR / "quote_template.css").read_text(encoding="utf-8")

    return {
        "css_text": css_text,
        "logo_data_uri": _logo_data_uri(cc.logo_path),
        "company_name": cc.name,
        "company_email": cc.email or "",
        "company_phone": cc.phone or "",
        "company_website": cc.website or "",
        "quote_number": q.quote_number,
        "quote_date": format_date_display(q.quote_date),
        "valid_until": format_date_display(q.valid_until),
        "customer_name": q.customer_name or "",
        "customer_company": q.customer_company or "",
        "project_name": q.project_name or "",
        "reference_number": q.reference_number or "",
        "currency": cur,
        "prepared_by": q.prepared_by or "",
        "summary_cards": summary_cards,
        "scope_primary": scope_primary,
        "scope_secondary": scope_secondary,
        "item_rows": item_rows,
        "pricing_material": format_currency(pr.material_cost, cur),
        "pricing_processing": format_currency(pr.processing_cost, cur),
        "pricing_subtotal": format_currency(pr.subtotal, cur),
        "pricing_discount": discount_fmt,
        "pricing_final": format_currency(pr.final_total, cur),
        "notes_lines": notes_lines,
        "terms_lines": terms_lines,
        "footer_generated": "Quotation document — generated electronically.",
    }


def render_html(payload: QuotePdfPayload) -> str:
    env = Environment(
        loader=FileSystemLoader(str(DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    tpl = env.get_template("quote_template.html")
    ctx = build_template_context(payload)
    return tpl.render(**ctx)


async def html_to_pdf_bytes(html: str) -> bytes:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            page = await browser.new_page()
            await page.set_content(html, wait_until="networkidle", timeout=60_000)
            pdf = await page.pdf(
                format="A4",
                print_background=True,
                prefer_css_page_size=True,
                margin={
                    "top": "16mm",
                    "right": "14mm",
                    "bottom": "16mm",
                    "left": "14mm",
                },
            )
            return pdf
        finally:
            await browser.close()


def render_pdf_bytes(payload: QuotePdfPayload) -> bytes:
    html = render_html(payload)
    return asyncio.run(html_to_pdf_bytes(html))


def sample_payload() -> QuotePdfPayload:
    today = date.today()
    valid = today + timedelta(days=14)
    return QuotePdfPayload(
        company={
            "name": "Acme Fabrication Ltd.",
            "logo_path": str(DIR / "assets" / "logo.png") if (DIR / "assets" / "logo.png").is_file() else None,
            "email": "quotes@acmefab.example",
            "phone": "+1 (555) 010-0200",
            "website": "www.acmefab.example",
        },
        quote={
            "quote_number": "QQ-20260327-SAMPLE",
            "quote_date": today.isoformat(),
            "valid_until": valid.isoformat(),
            "currency": "EUR",
            "prepared_by": "Sales Desk",
            "customer_name": "Jane Smith",
            "customer_company": "Northwind Structures",
            "project_name": "Platform deck plates",
            "reference_number": "REF-NW-1042",
            "scope_text": "",
            "notes": [],
            "terms": [],
        },
        summary={
            "total_parts": 3,
            "total_quantity": 24,
            "total_weight_kg": 1443.8,
            "net_plate_area_m2": 18.44,
            "gross_material_area_m2": 31.79,
            "estimated_sheet_count": 8,
        },
        items=[
            {
                "part_name": "PL-001-A",
                "qty": 6,
                "material": "S355JR",
                "thickness_mm": 12,
                "length_mm": 1200,
                "width_mm": 800,
                "weight_kg": 543.6,
                "line_total": 4200.0,
            },
            {
                "part_name": "PL-002-B",
                "qty": 10,
                "material": "S355JR",
                "thickness_mm": 10,
                "length_mm": 980,
                "width_mm": 640,
                "weight_kg": 490.2,
                "line_total": 3100.0,
            },
            {
                "part_name": "PL-003-C",
                "qty": 8,
                "material": "S235JR",
                "thickness_mm": 8,
                "length_mm": 600,
                "width_mm": 400,
                "weight_kg": 120.0,
                "line_total": 980.5,
            },
        ],
        pricing={
            "material_cost": 5200.0,
            "processing_cost": 2100.0,
            "subtotal": 7300.0,
            "discount": None,
            "final_total": 8280.5,
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Render quotation PDF via Playwright")
    parser.add_argument("--input", "-i", help="Path to JSON payload file")
    parser.add_argument("--output", "-o", help="Output PDF path")
    parser.add_argument("--sample", action="store_true", help="Use built-in sample data")
    args = parser.parse_args()

    if args.sample:
        payload = sample_payload()
        out = Path(args.output or "quote-sample.pdf")
    elif args.input:
        raw = Path(args.input).read_text(encoding="utf-8")
        payload = QuotePdfPayload.model_validate(json.loads(raw))
        out = Path(args.output or "quote.pdf")
    else:
        parser.print_help()
        return 2

    pdf = render_pdf_bytes(payload)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(pdf)
    print(str(out.resolve()), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
