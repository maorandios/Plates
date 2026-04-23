"""Display formatting for quotation PDF (locale-style, print-safe)."""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP


def _dec(x: float | int | Decimal) -> Decimal:
    return Decimal(str(x))


def _decimal_to_plain_str(q: Decimal) -> str:
    """Fixed-point string without scientific notation (avoids 1E+1 from normalize())."""
    t = format(q, "f")
    if "." in t:
        t = t.rstrip("0").rstrip(".")
    return t if t else "0"


def format_currency(amount: float | int | Decimal, currency_code: str) -> str:
    code = (currency_code or "EUR").strip().upper()
    q = _dec(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    neg = q < 0
    q = abs(q)
    s = f"{q:,.2f}"
    # Thin space after thousands is common in EU; keep comma for readability in PDF
    symbols = {
        "EUR": "€",
        "USD": "$",
        "GBP": "£",
        "ILS": "₪",
    }
    sym = symbols.get(code, f"{code} ")
    if code in symbols and code != "USD":
        return f"-{sym}{s}" if neg else f"{sym}{s}"
    if code == "USD":
        return f"-{sym}{s}" if neg else f"{sym}{s}"
    return f"-{sym}{s}" if neg else f"{sym}{s}"


def format_date_display(value: str) -> str:
    """Accept YYYY-MM-DD or pass through already formatted strings."""
    v = (value or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        try:
            d = date.fromisoformat(v)
            return d.strftime("%d %b %Y")
        except ValueError:
            pass
    return v


def format_date_il(value: str) -> str:
    """DD/MM/YYYY for Hebrew quotation PDFs."""
    v = (value or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        try:
            d = date.fromisoformat(v)
            return d.strftime("%d/%m/%Y")
        except ValueError:
            pass
    return v


def format_kg(kg: float | int) -> str:
    q = _dec(kg).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{q:,.2f} kg"


def format_kg_table_cell(kg: float | int) -> str:
    """Line weight for plate table body: number only, unit in column header."""
    q = _dec(kg).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{q:,.2f}"


def format_m2(m2: float | int) -> str:
    q = _dec(m2).quantize(Decimal("0.02"), rounding=ROUND_HALF_UP)
    return f"{q:,.2f} m²"


def format_thickness_mm(mm: float | int) -> str:
    q = _dec(mm).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return f"{q.normalize()} mm".replace(".0 mm", " mm")


def format_mm_one(mm: float | int) -> str:
    """Single dimension in millimetres (for part breakdown columns)."""
    q = int(round(float(mm)))
    return f"{q:,} mm".replace(",", " ")


def format_mm_one_he(mm: float | int) -> str:
    """Millimetres with Hebrew unit label (for RTL PDF)."""
    q = int(round(float(mm)))
    return f"{q:,} מ״מ".replace(",", " ")


def format_thickness_mm_he(mm: float | int) -> str:
    q = _dec(mm).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    s = _decimal_to_plain_str(q)
    return f"{s} מ״מ"


def format_thickness_mm_table_cell(mm: float | int) -> str:
    """Thickness in mm for plate table body: number only, unit in column header."""
    q = _dec(mm).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return _decimal_to_plain_str(q)


def format_size_mm(length_mm: float | int, width_mm: float | int) -> str:
    lq = int(round(float(length_mm)))
    wq = int(round(float(width_mm)))
    return f"{lq:,} × {wq:,} mm".replace(",", " ")


def format_qty(qty: int) -> str:
    return f"{qty:,}"


def format_int_comma(n: int) -> str:
    """Integer with thousands comma separators (e.g. 22,499)."""
    return f"{n:,}"


def format_currency_amount_only(amount: float | int | Decimal, currency_code: str) -> str:
    """Numeric part only (no symbol), 2 decimals, thousands commas — for PDF metrics row."""
    q = _dec(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    neg = q < 0
    q = abs(q)
    s = f"{q:,.2f}"
    return f"-{s}" if neg else s


def format_currency_amount_ceil_int(amount: float | int | Decimal) -> str:
    """Integer amount (round toward +∞), thousands commas — for PDF price metric, no decimals."""
    q = _dec(amount)
    n = int(q.to_integral_value(rounding=ROUND_CEILING))
    return format_int_comma(n)


def currency_symbol(currency_code: str) -> str:
    code = (currency_code or "EUR").strip().upper()
    return {
        "EUR": "€",
        "USD": "$",
        "GBP": "£",
        "ILS": "₪",
    }.get(code, f"{code} ")


def format_metric_kg_one_decimal(kg: float | int) -> str:
    """like finalize strip: one decimal, comma thousands."""
    q = _dec(kg).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return f"{q:,.1f}"


def format_metric_m2_two_decimals(m2: float | int) -> str:
    q = _dec(m2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return f"{q:,.2f}"
