import type { MaterialType } from "@/types/materials";
import { t } from "@/lib/i18n";

/** Surface / coating finish for plate line items (Quick Quote). */
export type PlateFinish = "carbon" | "galvanized" | "paint";

export const PLATE_FINISH_OPTIONS: { value: PlateFinish; label: string }[] = [
  { value: "carbon", label: "Carbon" },
  { value: "galvanized", label: "Galvanized" },
  { value: "paint", label: "Paint" },
];

export const DEFAULT_PLATE_FINISH: PlateFinish = "carbon";

/** Legacy quick-quote finish codes → Settings גימור labels (carbon default is now \"ללא\"). */
export const LEGACY_PLATE_FINISH_TO_SETTINGS_FINISH: Record<PlateFinish, string> = {
  carbon: "ללא",
  galvanized: "גלוון חם",
  paint: "צבוע",
};

function finishLabelKey(f: PlateFinish): string {
  return `quote.finishLabels.${f}`;
}

/** Default material grade label for the selected material family (General step). */
export function defaultMaterialGradeForFamily(materialType: MaterialType): string {
  if (materialType === "carbonSteel") return "S235";
  if (materialType === "aluminum") return "1015";
  if (materialType === "stainlessSteel") return "304";
  return "S235";
}

export function plateFinishLabel(finish: PlateFinish | undefined): string {
  const f = finish ?? DEFAULT_PLATE_FINISH;
  return t(finishLabelKey(f));
}

/** Map a BOM cell value to a plate finish when possible. */
export function parsePlateFinishFromLabelOrValue(
  s: string | undefined
): PlateFinish | undefined {
  if (!s?.trim()) return undefined;
  const low = s.trim().toLowerCase();
  if (low === "carbon" || low === "galvanized" || low === "paint") {
    return low as PlateFinish;
  }
  if (low.includes("galvan")) return "galvanized";
  if (low.includes("paint")) return "paint";
  if (low.includes("carbon") || low.includes("black steel")) return "carbon";
  const raw = s.trim();
  if (raw.includes("פח מגולוון") || raw.includes("מגולוון")) return "galvanized";
  if (raw.includes("פח צבוע") || raw.includes("צבוע")) return "paint";
  if (raw.includes("פח שחור") || raw.includes("שחור")) return "carbon";
  return undefined;
}

/** Single line for quote tables / BOM-style display (finish = settings label or legacy code). */
export function formatMaterialGradeAndFinish(
  grade: string,
  finish?: string | PlateFinish
): string {
  const g = grade.trim() || "—";
  let f: string;
  if (finish == null || finish === "") {
    f = "ללא";
  } else if (finish === "carbon" || finish === "galvanized" || finish === "paint") {
    f = LEGACY_PLATE_FINISH_TO_SETTINGS_FINISH[finish];
  } else if (typeof finish === "string") {
    f = finish.trim() || "ללא";
  } else {
    f = LEGACY_PLATE_FINISH_TO_SETTINGS_FINISH[finish];
  }
  return `${g} · ${f}`;
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
