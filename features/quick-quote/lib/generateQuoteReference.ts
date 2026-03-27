/**
 * Unique quote reference / id for Quick Quote (client-generated until a backend exists).
 */
export function generateQuoteReference(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `QQ-${y}${m}${day}-${rand}`;
}
