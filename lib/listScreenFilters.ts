/**
 * Client-side filters for list screens (quotes / projects).
 */

export type ListStatusFilter = "all" | "in_progress" | "complete";

export function sameLocalDateAsYmd(iso: string, ymd: string): boolean {
  const t = ymd.trim();
  if (!t) return true;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const pad = (n: number) => String(n).padStart(2, "0");
  const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return key === t;
}

export function textMatchesListQuery(
  parts: (string | undefined | null)[],
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = parts
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function statusMatches(
  rowStatus: "in_progress" | "complete",
  filter: ListStatusFilter
): boolean {
  if (filter === "all") return true;
  return rowStatus === filter;
}
