/**
 * Mirrors server/pdf/quote_pdf_formatters.py (Hebrew quotation PDF, print-safe).
 */
function dec(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x;
}

function decimalToPlainStr(n: number): string {
  let t = n.toFixed(10).replace(/\.?0+$/, "");
  if (t === "" || t === "-0") return "0";
  return t;
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const code = (currencyCode || "EUR").trim().toUpperCase();
  const q = Math.round(Math.abs(dec(amount)) * 100) / 100;
  const neg = dec(amount) < 0;
  const s = q.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbols: Record<string, string> = {
    EUR: "€",
    USD: "$",
    GBP: "£",
    ILS: "₪",
  };
  const sym = symbols[code] ?? `${code} `;
  if (code in symbols && code !== "USD") {
    return neg ? `-${sym}${s}` : `${sym}${s}`;
  }
  if (code === "USD") {
    return neg ? `-${sym}${s}` : `${sym}${s}`;
  }
  return neg ? `-${sym}${s}` : `${sym}${s}`;
}

export function formatDateIl(value: string): string {
  const v = (value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map((x) => parseInt(x, 10));
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
    }
  }
  return v;
}

export function formatKg(kg: number): string {
  const q = Math.round(dec(kg) * 100) / 100;
  return `${q.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} kg`;
}

export function formatKgTableCell(kg: number): string {
  const q = Math.round(dec(kg) * 100) / 100;
  return q.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatM2(m2: number): string {
  const q = Math.round(dec(m2) * 100) / 100;
  return `${q.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} m²`;
}

export function formatMmOneHe(mm: number): string {
  const q = Math.round(dec(mm));
  return `${q.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} מ״מ`;
}

export function formatThicknessMmHe(mm: number): string {
  const q = Math.round(dec(mm) * 10) / 10;
  const s = decimalToPlainStr(q);
  return `${s} מ״מ`;
}

export function formatThicknessMmTableCell(mm: number): string {
  const q = Math.round(dec(mm) * 10) / 10;
  return decimalToPlainStr(q);
}

export function formatQty(qty: number): string {
  return String(Math.floor(qty)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatIntComma(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatCurrencyAmountOnly(amount: number, currencyCode: string): string {
  void currencyCode;
  const q = Math.round(Math.abs(dec(amount)) * 100) / 100;
  const neg = dec(amount) < 0;
  const s = q.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg ? `-${s}` : s;
}

export function formatCurrencyAmountCeilInt(amount: number): string {
  const n = Math.ceil(Math.abs(dec(amount))) * (dec(amount) < 0 ? -1 : 1);
  return formatIntComma(n);
}

export function formatMetricKgOneDecimal(kg: number): string {
  const q = Math.round(dec(kg) * 10) / 10;
  return q.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatMetricM2TwoDecimals(m2: number): string {
  const q = Math.round(dec(m2) * 100) / 100;
  return q.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
