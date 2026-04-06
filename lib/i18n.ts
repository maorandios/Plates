import he from "@/messages/he.json";

export type MessageKey = string;

function getNested(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur !== null && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

/**
 * Hebrew UI copy. Keys use dot notation, e.g. `nav.dashboard`, `quote.steps.general`.
 * Use `{{name}}` placeholders in JSON and pass `vars: { name: "…" }`.
 */
export function t(
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  let v = getNested(he, key);
  if (v === undefined) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[i18n] Missing translation: ${key}`);
    }
    return key;
  }
  if (vars) {
    for (const [k, val] of Object.entries(vars)) {
      v = v.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(val));
    }
  }
  return v;
}

export const messages = he as typeof he;
