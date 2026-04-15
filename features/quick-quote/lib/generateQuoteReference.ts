/**
 * Short client-side quote reference: `OM-` + 4 digits (0001–9999), unique vs existing list.
 */
import { getQuotesList } from "@/lib/quotes/quoteList";

const PREFIX = "OM-";

function maxOmSequenceFromList(): number {
  if (typeof window === "undefined") return 0;
  let max = 0;
  for (const q of getQuotesList()) {
    const ref = q.referenceNumber?.trim() ?? "";
    const m = /^OM-(\d{1,4})$/.exec(ref);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }
  return max;
}

export function generateQuoteReference(): string {
  if (typeof window === "undefined") {
    return `${PREFIX}0001`;
  }
  let next = maxOmSequenceFromList() + 1;
  if (next < 1) next = 1;
  if (next > 9999) next = 1;
  return `${PREFIX}${String(next).padStart(4, "0")}`;
}
