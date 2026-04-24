/**
 * Next `OM-` + 4 digits (0001–9999), unique across both quick quotes and plate projects
 * (so new projects are not re-using the same number as an unsaved/parallel quote, or other projects).
 */
import { getQuotesList } from "@/lib/quotes/quoteList";
import { getPlateProjectsList } from "@/lib/projects/plateProjectList";

const PREFIX = "OM-";
const OM_RE = /^OM-(\d{1,4})$/;

function maxOmFromRefs(refs: readonly string[]): number {
  let max = 0;
  for (const raw of refs) {
    const ref = raw?.trim() ?? "";
    const m = OM_RE.exec(ref);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }
  return max;
}

function maxOmSequenceFromList(): number {
  if (typeof window === "undefined") return 0;
  const fromQuotes = maxOmFromRefs(getQuotesList().map((q) => q.referenceNumber));
  const fromProjects = maxOmFromRefs(getPlateProjectsList().map((p) => p.referenceNumber));
  return Math.max(fromQuotes, fromProjects);
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
