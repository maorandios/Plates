import type { AppPreferences } from "@/types/settings";
import { DEFAULT_APP_PREFERENCES } from "@/types/settings";

const STORAGE_KEY = "plate_app_preferences";

function loadRaw(): AppPreferences {
  if (typeof window === "undefined") return DEFAULT_APP_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_PREFERENCES;
    const rawParsed = JSON.parse(raw) as Record<string, unknown> & Partial<AppPreferences>;
    const cleaned = { ...rawParsed };
    delete cleaned.unitSystem;
    delete cleaned.companyPhoneSecondary;
    if ("unitSystem" in rawParsed || "companyPhoneSecondary" in rawParsed) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
      } catch {
        // ignore
      }
    }
    const parsed = cleaned;
    return {
      ...DEFAULT_APP_PREFERENCES,
      companyName:
        typeof parsed.companyName === "string" ? parsed.companyName : undefined,
      companyRegistration:
        typeof parsed.companyRegistration === "string"
          ? parsed.companyRegistration
          : undefined,
      companyEmail:
        typeof parsed.companyEmail === "string" ? parsed.companyEmail : undefined,
      companyPhone:
        typeof parsed.companyPhone === "string" ? parsed.companyPhone : undefined,
      companyWebsite:
        typeof parsed.companyWebsite === "string"
          ? parsed.companyWebsite
          : undefined,
      companyAddress:
        typeof parsed.companyAddress === "string"
          ? parsed.companyAddress
          : undefined,
    };
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
}

export function getAppPreferences(): AppPreferences {
  return loadRaw();
}

export function saveAppPreferences(next: AppPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn("[PLATE] Failed to save app preferences", e);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("plate-app-preferences-changed"));
  }
}
