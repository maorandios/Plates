"use client";

import type { MaterialConfig, MaterialType } from "@/types/materials";
import { saveAppPreferences } from "@/lib/settings/appPreferences";
import { saveMaterialConfig } from "@/lib/settings/materialConfig";
import { saveAllCuttingProfileRanges } from "@/lib/settings/cuttingProfiles";
import type { CuttingProfileRange } from "@/types/production";
import type { AppPreferences } from "@/types/settings";
import { DEFAULT_APP_PREFERENCES } from "@/types/settings";
import type { Json } from "@/types/supabase";

export type OrgSettingsHydration = {
  org_id: string;
  app_preferences: Json;
  material_config: Json | null;
  cutting_profiles: Json | null;
  updated_at: string;
};

const MATERIAL_TYPES: MaterialType[] = ["carbonSteel", "stainlessSteel", "aluminum"];

function parseAppPreferences(raw: unknown): AppPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_APP_PREFERENCES;
  const o = raw as Record<string, unknown>;
  const unitSystem =
    o.unitSystem === "imperial" || o.unitSystem === "metric"
      ? o.unitSystem
      : DEFAULT_APP_PREFERENCES.unitSystem;
  return {
    ...DEFAULT_APP_PREFERENCES,
    unitSystem,
    companyName: typeof o.companyName === "string" ? o.companyName : undefined,
    companyRegistration:
      typeof o.companyRegistration === "string" ? o.companyRegistration : undefined,
    companyEmail: typeof o.companyEmail === "string" ? o.companyEmail : undefined,
    companyPhone: typeof o.companyPhone === "string" ? o.companyPhone : undefined,
    companyPhoneSecondary:
      typeof o.companyPhoneSecondary === "string" ? o.companyPhoneSecondary : undefined,
    companyWebsite: typeof o.companyWebsite === "string" ? o.companyWebsite : undefined,
    companyAddress: typeof o.companyAddress === "string" ? o.companyAddress : undefined,
  };
}

/**
 * Apply server org_settings + snapshot rows to localStorage so existing modules keep working.
 */
export function applyRemoteDataToLocalStorage(
  settings: OrgSettingsHydration | null,
  snapshots: { data_key: string; payload: Json }[]
): void {
  if (typeof window === "undefined") return;

  if (settings?.app_preferences != null) {
    const prefs = parseAppPreferences(settings.app_preferences);
    saveAppPreferences(prefs);
  }

  if (settings?.material_config != null && typeof settings.material_config === "object") {
    const mc = settings.material_config as Record<string, unknown>;
    for (const t of MATERIAL_TYPES) {
      const row = mc[t];
      if (row && typeof row === "object") {
        saveMaterialConfig(row as MaterialConfig);
      }
    }
  }

  if (settings?.cutting_profiles != null && typeof settings.cutting_profiles === "object") {
    const cp = settings.cutting_profiles as { version?: number; ranges?: CuttingProfileRange[] };
    if (cp.version === 2 && Array.isArray(cp.ranges) && cp.ranges.length > 0) {
      saveAllCuttingProfileRanges(cp.ranges);
    }
  }

  for (const row of snapshots) {
    try {
      localStorage.setItem(row.data_key, JSON.stringify(row.payload));
    } catch (e) {
      console.warn("[PLATE] Failed to apply snapshot", row.data_key, e);
    }
  }
}
