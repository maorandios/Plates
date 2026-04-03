import type { MaterialType } from "@/types/materials";

/** Surface / coating finish for plate line items (Quick Quote). */
export type PlateFinish = "carbon" | "galvanized" | "paint";

export const PLATE_FINISH_OPTIONS: { value: PlateFinish; label: string }[] = [
  { value: "carbon", label: "Carbon" },
  { value: "galvanized", label: "Galvanized" },
  { value: "paint", label: "Paint" },
];

export const DEFAULT_PLATE_FINISH: PlateFinish = "carbon";

/** Default material grade label for the selected material family (General step). */
export function defaultMaterialGradeForFamily(materialType: MaterialType): string {
  if (materialType === "carbonSteel") return "S235";
  return "";
}

export function plateFinishLabel(finish: PlateFinish | undefined): string {
  const f = finish ?? DEFAULT_PLATE_FINISH;
  return PLATE_FINISH_OPTIONS.find((o) => o.value === f)?.label ?? f;
}

/** Map a BOM cell value to a plate finish when possible. */
export function parsePlateFinishFromLabelOrValue(
  s: string | undefined
): PlateFinish | undefined {
  if (!s?.trim()) return undefined;
  const t = s.trim().toLowerCase();
  if (t === "carbon" || t === "galvanized" || t === "paint") {
    return t as PlateFinish;
  }
  if (t.includes("galvan")) return "galvanized";
  if (t.includes("paint")) return "paint";
  if (t.includes("carbon") || t.includes("black steel")) return "carbon";
  return undefined;
}

/** Single line for quote tables / BOM-style display. */
export function formatMaterialGradeAndFinish(
  grade: string,
  finish?: PlateFinish
): string {
  const g = grade.trim() || "—";
  const f = finish ?? DEFAULT_PLATE_FINISH;
  return `${g} · ${plateFinishLabel(f)}`;
}

/** Split a {@link formatMaterialGradeAndFinish} string back into grade and finish labels. */
export function splitMaterialGradeAndFinish(material: string): {
  grade: string;
  finish: string;
} {
  const s = (material || "").trim();
  if (!s || s === "—") return { grade: "—", finish: "—" };
  const parts = s.split(/\s*·\s*/);
  if (parts.length >= 2) {
    return {
      grade: parts[0].trim() || "—",
      finish: parts.slice(1).join(" · ").trim() || "—",
    };
  }
  return { grade: s, finish: "—" };
}
