/**
 * App-wide number display: US-style grouping (1,234.56).
 * Use for all user-visible numeric output.
 */

const LOCALE = "en-US";

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE, options).format(value);
}

/** Integers with grouping (e.g. 12,450). */
export function formatInteger(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

/** Fixed decimal places with grouping. */
export function formatDecimal(value: number, fractionDigits: number): string {
  return formatNumber(value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
