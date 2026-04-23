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
from io import BytesIO
from datetime import date, timedelta
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from quote_pdf_formatters import (
    format_currency,
    format_currency_amount_ceil_int,
    format_currency_amount_only,
    format_date_il,
    format_int_comma,
    format_kg,
    format_kg_table_cell,
    format_metric_kg_one_decimal,
    format_metric_m2_two_decimals,
    format_m2,
    format_mm_one_he,
    format_qty,
    format_thickness_mm_he,
    format_thickness_mm_table_cell,
)
from quote_pdf_types import QuotePdfPayload

DIR = Path(__file__).resolve().parent

# Legacy UI default — never show on PDF letterhead
_PLACEHOLDER_COMPANY = "fabrication partner"

# Playwright print footer (Hebrew + LTR page numbers). Uses Chromium classes pageNumber / totalPages.
# Match table L/R: @page 17.78mm (quote_template.css) + .page side padding 2.8mm (same as table area).
# Playwright’s footer is full paper width, so we inset by the full 20.58mm. If a build only uses
# the content box width, set this to 2.8.
_FOOTER_INSET_H_MM = 17.78 + 2.8
# Was 8.5pt; ÷1.25 per layout request
_FOOTER_FONT_PT = round(8.5 / 1.25, 2)  # 6.8 (was 8.5pt)
# quote_template.css --muted / --muted-deep; footer uses softer body text
_FOOTER_MUTED = "#6b6b6b"
_PDF_FOOTER_TEMPLATE = (
    "<div style=\"box-sizing:border-box;width:100%;margin:0;padding:0;\">"
    f"<div style=\"margin:0;padding:0 {_FOOTER_INSET_H_MM}mm;box-sizing:border-box;\">"
    "<div style=\""
    "box-sizing:border-box;width:100%;margin:0;padding:0;border-top:1.5px solid #c9c9c9;"
    f"padding-top:2.5mm;font:500 {_FOOTER_FONT_PT}pt/1.3 'Segoe UI','Noto Sans Hebrew',"
    "'Noto Sans',Tahoma,Arial,sans-serif;"
    f"color:{_FOOTER_MUTED};"
    "display:flex;flex-direction:row;justify-content:space-between;align-items:center;"
    "\">"
    "<div style=\"flex:0 0 auto;direction:ltr;text-align:left;white-space:nowrap;"
    "unicode-bidi:isolate;\">"
    "עמוד <span class=\"pageNumber\"></span> מתוך <span class=\"totalPages\"></span>"
    "</div>"
    "<div style=\"flex:0 1 auto;text-align:right;direction:rtl;min-width:0;"
    "padding-inline-start:2mm;\">"
    "הצעת המחיר הזו הופקה באמצעות מערכת אומגות · "
    "<span style=\"unicode-bidi:isolate\" dir=\"ltr\">www.Omegot.com</span>"
    "</div>"
    "</div></div></div>"
)


def _sanitize_letterhead_company_name(name: str | None) -> str:
    t = (name or "").strip()
    if not t:
        return ""
    if t.lower() == _PLACEHOLDER_COMPANY:
        return ""
    return t


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
    pr = payload.pricing

    area_sum_lines = sum(float(it.area_m2) for it in payload.items)

    kpi_cards = [
        {"label": "סוגי פלטות", "value": format_int_comma(payload.summary.total_parts)},
        {"label": "כמות פלטות", "value": format_qty(payload.summary.total_quantity)},
        {"label": "שטח (מ״ר)", "value": format_m2(area_sum_lines)},
        {"label": "משקל (ק״ג)", "value": format_kg(payload.summary.total_weight_kg)},
        {"label": "הצעת מחיר", "value": format_currency(pr.total_price, cur)},
    ]

    technical_rows = [
        {"label": "שטח נטו (לפי מערכת)", "value": format_m2(payload.summary.net_plate_area_m2)},
        {
            "label": "שטח חומר גלם משוער",
            "value": format_m2(payload.summary.gross_material_area_m2),
        },
    ]
    if payload.summary.estimated_sheet_count is not None:
        technical_rows.append(
            {
                "label": "מספר לוחות משוער",
                "value": format_int_comma(int(payload.summary.estimated_sheet_count)),
            }
        )

    scope_text = (q.scope_text or "").strip()
    scope_has = bool(scope_text)

    item_rows = []
    unified_plate_rows = []
    for idx, it in enumerate(payload.items, start=1):
        desc = (it.description or "").strip() or "—"
        mtype = (it.material_type or "").strip() or "—"
        mgrade = (it.material_grade or "").strip() or "—"
        fin = (it.finish or "").strip() or "—"
        w_kg = float(it.weight_kg)
        if w_kg > 0:
            price_per_kg = format_currency_amount_only(
                float(it.line_total) / w_kg, cur
            )
        else:
            price_per_kg = "—"
        item_rows.append(
            {
                "description": desc,
                "part_number": it.part_number,
                "qty": format_qty(it.qty),
                "thickness": format_thickness_mm_he(it.thickness_mm) if it.thickness_mm else "—",
                "material_type": mtype,
                "material_grade": mgrade,
                "finish": fin,
                "width_mm": format_mm_one_he(it.width_mm) if it.width_mm else "—",
                "length_mm": format_mm_one_he(it.length_mm) if it.length_mm else "—",
                "area_m2": format_m2(it.area_m2) if it.area_m2 else "—",
                "weight": format_kg(it.weight_kg),
                "line_total": format_currency(it.line_total, cur),
            }
        )
        unified_plate_rows.append(
            {
                "index": str(idx),
                "material": mtype,
                "description": desc,
                "part_number": it.part_number,
                "qty": format_qty(it.qty),
                "thickness": format_thickness_mm_table_cell(it.thickness_mm),
                "weight": format_kg_table_cell(it.weight_kg),
                "material_grade": mgrade,
                "finish": fin,
                "corrugated": "כן" if it.corrugated else "לא",
                "price_per_kg": price_per_kg,
                "line_total": format_currency_amount_only(it.line_total, cur),
            }
        )

    discount_fmt = format_currency(pr.discount, cur) if pr.discount else None
    net = max(0.0, float(pr.total_price) - (float(pr.discount) if pr.discount else 0.0))
    vat_rate = float(pr.vat_rate)
    vat_amount = round(net * vat_rate, 2)
    vat_pct = int(round(vat_rate * 100))
    pricing_vat_label = f"מע״מ ({vat_pct}%)"

    raw_notes = list(q.notes) if q.notes else []
    notes_lines = [str(x).strip() for x in raw_notes if str(x).strip()]
    # PDF always shows the היערות block; if the user left none, show a single bullet "ללא".
    notes_for_pdf = notes_lines if notes_lines else ["ללא"]
    raw_terms = list(q.terms) if q.terms else []
    terms_lines = [str(x).strip() for x in raw_terms if str(x).strip()]

    css_text = (DIR / "quote_template.css").read_text(encoding="utf-8")

    addr_raw = (cc.address or "").strip()
    company_address_lines = [x.strip() for x in addr_raw.splitlines() if x.strip()]

    sm = payload.summary
    prc = pr.total_price
    return {
        "css_text": css_text,
        "logo_data_uri": _logo_data_uri(cc.logo_path),
        "company_name": _sanitize_letterhead_company_name(cc.name),
        "company_registration": (cc.registration or "").strip(),
        "company_email": cc.email or "",
        "company_phone": cc.phone or "",
        "company_website": cc.website or "",
        "company_address_lines": company_address_lines,
        "quote_number": q.quote_number,
        "quote_date": format_date_il(q.quote_date),
        "valid_until": format_date_il(q.valid_until),
        "customer_name": q.customer_name or "",
        "customer_company": q.customer_company or "",
        "project_name": q.project_name or "",
        "reference_number": q.reference_number or "",
        "currency": cur,
        "prepared_by": q.prepared_by or "",
        "kpi_cards": kpi_cards,
        "technical_rows": technical_rows,
        "scope_has": scope_has,
        "scope_text": scope_text,
        "item_rows": item_rows,
        "unified_plate_rows": unified_plate_rows,
        "pricing_subtotal": format_currency(pr.total_price, cur),
        "pricing_discount": discount_fmt,
        "pricing_net_after_discount": format_currency(net, cur),
        "pricing_vat_label": pricing_vat_label,
        "pricing_vat_amount": format_currency(vat_amount, cur),
        "pricing_total_incl_vat": format_currency(pr.total_incl_vat, cur),
        "has_discount": pr.discount is not None and float(pr.discount) > 0,
        "notes_lines": notes_for_pdf,
        "terms_lines": terms_lines,
        "footer_generated": "מסמך הופק אלקטרונית · ללא חתימה ידנית.",
        # Summary metrics strip (matches finalize / PartBreakdown styling)
        "metric_plate_types": format_int_comma(int(sm.total_parts)),
        "metric_plate_qty": format_int_comma(int(sm.total_quantity)),
        "metric_area": format_metric_m2_two_decimals(sm.net_plate_area_m2),
        "metric_weight": format_metric_kg_one_decimal(sm.total_weight_kg),
        "metric_price_num": format_currency_amount_ceil_int(prc),
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
            # Apply before set_content so % min-heights resolve against print, not screen
            # (avoids an extra blank last page with only the PDF footer in some Chromium builds).
            await page.emulate_media(media="print")
            await page.set_content(html, wait_until="networkidle", timeout=60_000)
            # prefer_css_page_size True → use @page in quote_template.css for content box; do not pass margin here.
            pdf = await page.pdf(
                format="A4",
                landscape=False,
                print_background=True,
                display_header_footer=True,
                header_template=(
                    "<div style=\"height:0;max-height:0;margin:0;padding:0;overflow:hidden;"
                    "line-height:0;font-size:0\"></div>"
                ),
                footer_template=_PDF_FOOTER_TEMPLATE,
                prefer_css_page_size=True,
            )
            return _postprocess_pdf_remove_trailing_blank_page(pdf)
        finally:
            await browser.close()


def _text_suggests_plate_table_present(t: str) -> bool:
    """Hebrew plate list has this column header; real data pages include it (repeating thead)."""
    return "חומר" in (t or "") or (
        "רשימת" in (t or "") and "פלטות" in (t or "")
    )


# Section <h2> in quote_template.html — must not be treated as a blank trailing page.
_QUOTE_NOTES_SECTION_TITLE = "היערות"


def _text_suggests_quote_notes_section_present(t: str) -> bool:
    """Notes block after the plate table; short page can look 'blank' to old heuristics."""
    return _QUOTE_NOTES_SECTION_TITLE in (t or "")


def _should_drop_trailing_page_by_text(t: str) -> bool:
    """
    Last page is a Chromium artifact: no table body, only the synthetic print footer in the margin.
    pypdf usually still extracts the footer strings when they are part of the content stream.

    Important: a real last page that only contains the post-table היערות block and print footer
    used to be dropped (short text + עמוד/מתוך), which removed the notes and left a wrong page count
    on the previous page. Never drop if the notes section title appears in the extracted text.
    """
    t = (t or "").strip()
    if not t:
        return True
    if _text_suggests_plate_table_present(t):
        return False
    if _text_suggests_quote_notes_section_present(t):
        return False
    if "עמוד" in t and "מתוך" in t and len(t) < 2500:
        return True
    return False


def _postprocess_pdf_remove_trailing_blank_page(pdf_bytes: bytes) -> bytes:
    """Drop a final empty page (footer-only) when Chromium + min-height bugs add one."""
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        return pdf_bytes
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except Exception:
        return pdf_bytes
    if len(reader.pages) < 2:
        return pdf_bytes
    last_text = ""
    try:
        last_text = reader.pages[-1].extract_text() or ""
    except Exception:
        return pdf_bytes
    if not _should_drop_trailing_page_by_text(last_text):
        return pdf_bytes
    writer = PdfWriter()
    for p in reader.pages[:-1]:
        writer.add_page(p)
    out = BytesIO()
    writer.write(out)
    return out.getvalue()


def render_pdf_bytes(payload: QuotePdfPayload) -> bytes:
    html = render_html(payload)
    return asyncio.run(html_to_pdf_bytes(html))


def sample_payload() -> QuotePdfPayload:
    today = date.today()
    valid = today + timedelta(days=14)
    return QuotePdfPayload(
        company={
            "name": "Acme Fabrication Ltd.",
            "registration": "514123456",
            "logo_path": str(DIR / "assets" / "logo.png") if (DIR / "assets" / "logo.png").is_file() else None,
            "email": "quotes@acmefab.example",
            "phone": "+1 (555) 010-0200",
            "website": "www.acmefab.example",
            "address": "100 Industrial Way\nSheffield, S1 2AB\nUnited Kingdom",
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
            "notes": [
                "מסירה עד 14 ימי עבודה ממועד אישור.",
                "המחירים כוללים חיתוך בלבד, ללא התקנה.",
            ],
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
                "part_number": "PL-001-A",
                "qty": 6,
                "thickness_mm": 12,
                "material_type": "Structural steel plate (EN 10025)",
                "material_grade": "S355JR",
                "finish": "Carbon",
                "width_mm": 800,
                "length_mm": 1200,
                "area_m2": 5.76,
                "weight_kg": 543.6,
                "line_total": 4200.0,
                "plate_shape": "flat",
                "description": "לוח סטנדרטי",
                "corrugated": True,
            },
            {
                "part_number": "PL-002-B",
                "qty": 10,
                "thickness_mm": 10,
                "material_type": "Structural steel plate (EN 10025)",
                "material_grade": "S355JR",
                "finish": "Carbon",
                "width_mm": 640,
                "length_mm": 980,
                "area_m2": 6.27,
                "weight_kg": 490.2,
                "line_total": 3100.0,
                "plate_shape": "flat",
                "description": "",
                "corrugated": False,
            },
            {
                "part_number": "PL-003-C",
                "qty": 8,
                "thickness_mm": 8,
                "material_type": "Structural steel plate (EN 10025)",
                "material_grade": "S235JR",
                "finish": "Carbon",
                "width_mm": 400,
                "length_mm": 600,
                "area_m2": 1.92,
                "weight_kg": 120.0,
                "line_total": 980.5,
                "plate_shape": "flat",
                "description": "מנתח משני",
                "corrugated": False,
            },
        ],
        pricing={
            "total_price": 8280.5,
            "discount": None,
            "vat_rate": 0.18,
            "total_incl_vat": round(8280.5 * 1.18 * 100) / 100,
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
