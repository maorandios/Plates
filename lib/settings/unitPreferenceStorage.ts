import type { UnitSystem } from "@/types/settings";

const KEY = "plate_unit_system";
const PREF_BLOB = "plate_app_preferences";

const CHANGE = "plate-app-preferences-changed";

function readFromLegacyBlob(): UnitSystem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREF_BLOB);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (p.unitSystem === "imperial" || p.unitSystem === "metric") {
      const u = p.unitSystem as UnitSystem;
      if (!localStorage.getItem(KEY)) {
        localStorage.setItem(KEY, u);
      }
      delete p.unitSystem;
      localStorage.setItem(PREF_BLOB, JSON.stringify(p));
      return u;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Unit system is device-only (not synced to public.users or Supabase).
 */
export function getStoredUnitSystem(): UnitSystem {
  if (typeof window === "undefined") {
    return "metric";
  }
  try {
    const direct = localStorage.getItem(KEY);
    if (direct === "imperial" || direct === "metric") {
      return direct;
    }
    const migrated = readFromLegacyBlob();
    if (migrated) return migrated;
  } catch {
    // ignore
  }
  return "metric";
}

export function setStoredUnitSystem(next: UnitSystem): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, next);
    window.dispatchEvent(new CustomEvent(CHANGE));
  } catch (e) {
    console.warn("[PLATE] Failed to save unit system", e);
  }
}
