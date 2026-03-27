/**
 * ISO 4217 codes for Intl + display labels. ILS = Israeli new shekel (NIS).
 */
export const QUICK_QUOTE_CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: "EUR", label: "EUR — Euro" },
  { code: "USD", label: "USD — US dollar" },
  { code: "GBP", label: "GBP — Pound sterling" },
  { code: "ILS", label: "ILS — Israeli new shekel (NIS)" },
  { code: "CHF", label: "CHF — Swiss franc" },
  { code: "SEK", label: "SEK — Swedish krona" },
  { code: "NOK", label: "NOK — Norwegian krone" },
  { code: "DKK", label: "DKK — Danish krone" },
  { code: "PLN", label: "PLN — Polish złoty" },
  { code: "CZK", label: "CZK — Czech koruna" },
  { code: "HUF", label: "HUF — Hungarian forint" },
  { code: "RON", label: "RON — Romanian leu" },
  { code: "TRY", label: "TRY — Turkish lira" },
  { code: "JPY", label: "JPY — Japanese yen" },
  { code: "CNY", label: "CNY — Chinese yuan" },
  { code: "INR", label: "INR — Indian rupee" },
  { code: "AUD", label: "AUD — Australian dollar" },
  { code: "NZD", label: "NZD — New Zealand dollar" },
  { code: "CAD", label: "CAD — Canadian dollar" },
  { code: "MXN", label: "MXN — Mexican peso" },
  { code: "BRL", label: "BRL — Brazilian real" },
  { code: "ZAR", label: "ZAR — South African rand" },
  { code: "AED", label: "AED — UAE dirham" },
  { code: "SAR", label: "SAR — Saudi riyal" },
];

function resolveQuickQuoteCurrencyCode(currencyCode: string): string {
  return QUICK_QUOTE_CURRENCY_OPTIONS.some((c) => c.code === currencyCode)
    ? currencyCode
    : "EUR";
}

/** Symbol (or fallback code) for column headers and labels. */
export function quickQuoteCurrencySymbol(currencyCode: string): string {
  const code = resolveQuickQuoteCurrencyCode(currencyCode);
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

/** Amount only — no currency symbol (for tables that show symbol in header). */
export function formatQuickQuoteCurrencyAmount(
  amount: number,
  currencyCode: string
): string {
  const code = resolveQuickQuoteCurrencyCode(currencyCode);
  try {
    const ref = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    });
    const opts = ref.resolvedOptions();
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: opts.minimumFractionDigits,
      maximumFractionDigits: opts.maximumFractionDigits,
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

export function formatQuickQuoteCurrency(
  amount: number,
  currencyCode: string
): string {
  const code = resolveQuickQuoteCurrencyCode(currencyCode);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}
