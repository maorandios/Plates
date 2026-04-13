"""Display formatting for quotation PDF (locale-style, print-safe)."""

from __future__ import annotations

import re
from datetime import date
from decimal import Decimal, ROUND_HALF_UP


def _dec(x: float | int | Decimal) -> Decimal:
    return Decimal(str(x))


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
    s = f"{q.normalize()}"
    if s.endswith(".0"):
        s = s[:-2]
    return f"{s} מ״מ"


def format_size_mm(length_mm: float | int, width_mm: float | int) -> str:
    lq = int(round(float(length_mm)))
    wq = int(round(float(width_mm)))
    return f"{lq:,} × {wq:,} mm".replace(",", " ")


def format_qty(qty: int) -> str:
    return f"{qty:,}".replace(",", " ")


def format_int_space(n: int) -> str:
    return f"{n:,}".replace(",", " ")
