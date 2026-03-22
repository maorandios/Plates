import type { UnitSystem } from "@/types/settings";
import { getAppPreferences } from "@/lib/settings/appPreferences";

const MM_PER_IN = 25.4;
const MM_PER_FT = 304.8;

/** Current global unit system (read synchronously from persisted preferences). */
export function getUnitSystem(): UnitSystem {
  return getAppPreferences().unitSystem;
}

/** Linear value in mm → display string with unit (tooltips, modals, validation text). */
export function formatLength(mm: number, system: UnitSystem = getUnitSystem()): string {
  if (!Number.isFinite(mm)) return "—";
  if (system === "metric") {
    return `${mm.toFixed(2)} mm`;
  }
  const inches = mm / MM_PER_IN;
  if (Math.abs(inches) >= 12) {
    const ft = mm / MM_PER_FT;
    return `${ft.toFixed(3)} ft`;
  }
  return `${inches.toFixed(3)} in`;
}

/** Numeric part only — use with column headers that already state the unit (e.g. tables). */
export function formatLengthValueOnly(
  mm: number,
  system: UnitSystem = getUnitSystem()
): string {
  if (!Number.isFinite(mm)) return "—";
  if (system === "metric") {
    return mm.toFixed(2);
  }
  return (mm / MM_PER_IN).toFixed(3);
}

/** Area m² → number string only (headers carry m² / ft²). */
export function formatAreaValueOnly(
  areaM2: number,
  system: UnitSystem = getUnitSystem()
): string {
  if (!Number.isFinite(areaM2)) return "—";
  if (system === "metric") {
    return areaM2.toFixed(4);
  }
  return (areaM2 * 10.76391041671).toFixed(3);
}

/** Mass kg → number string only (headers carry kg / lb). */
export function formatWeightValueOnly(
  kg: number,
  system: UnitSystem = getUnitSystem()
): string {
  if (!Number.isFinite(kg)) return "—";
  if (system === "metric") {
    return kg.toFixed(2);
  }
  return (kg * 2.2046226218).toFixed(2);
}

/** Area: internal m² (not mm²) — matches existing Excel `area` field semantics in app copy. */
export function formatArea(
  areaM2: number,
  system: UnitSystem = getUnitSystem()
): string {
  if (!Number.isFinite(areaM2)) return "—";
  if (system === "metric") {
    return `${areaM2.toFixed(4)} m²`;
  }
  const ft2 = areaM2 * 10.76391041671;
  return `${ft2.toFixed(3)} ft²`;
}

/** Mass in kg. */
export function formatWeight(
  kg: number,
  system: UnitSystem = getUnitSystem()
): string {
  if (!Number.isFinite(kg)) return "—";
  if (system === "metric") {
    return `${kg.toFixed(2)} kg`;
  }
  const lb = kg * 2.2046226218;
  return `${lb.toFixed(2)} lb`;
}

/**
 * Parse user input into mm. Accepts plain numbers as mm (metric) or inches (imperial).
 * For a richer keypad later, extend here — foundation only.
 */
export function parseLengthInputToMm(
  raw: string,
  system: UnitSystem = getUnitSystem()
): number | null {
  const s = raw.trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (system === "metric") {
    return n;
  }
  return n * MM_PER_IN;
}

/** Hole / diameter in mm → “Ø …” using current length units */
export function formatHoleDiameter(
  diameterMm: number,
  system: UnitSystem = getUnitSystem()
): string {
  if (!Number.isFinite(diameterMm) || diameterMm <= 0) return "—";
  return `Ø ${formatLength(diameterMm, system)}`;
}

/** Table column titles — data stays metric internally; labels follow preference */
export function tableThicknessHeader(system: UnitSystem): string {
  return system === "metric" ? "Thickness (mm)" : "Thickness (in)";
}

export function tableWidthHeader(system: UnitSystem): string {
  return system === "metric" ? "Width (mm)" : "Width (in)";
}

export function tableLengthHeader(system: UnitSystem): string {
  return system === "metric" ? "Length (mm)" : "Length (in)";
}

export function tableAreaHeader(system: UnitSystem): string {
  return system === "metric" ? "Area (m²)" : "Area (ft²)";
}

export function tableWeightHeader(system: UnitSystem): string {
  return system === "metric" ? "Total weight (kg)" : "Total weight (lb)";
}

export function tablePerimeterHeader(system: UnitSystem): string {
  return system === "metric" ? "Perimeter (mm)" : "Perimeter (in)";
}

/** Summary chip label for total plate area */
export function summaryTotalAreaLabel(system: UnitSystem): string {
  return system === "metric" ? "plates area (m²)" : "plates area (ft²)";
}

export function summaryTotalWeightLabel(system: UnitSystem): string {
  return system === "metric" ? "total weight (kg)" : "total weight (lb)";
}
