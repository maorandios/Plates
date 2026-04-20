export const PLATE_THEME_STORAGE_KEY = "plate-theme" as const;

export type PlateTheme = "light" | "dark";

export function readStoredPlateTheme(): PlateTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(PLATE_THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}
