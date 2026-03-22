"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppPreferences, UnitSystem } from "@/types/settings";
import {
  getAppPreferences,
  saveAppPreferences,
} from "@/lib/settings/appPreferences";
import {
  formatArea,
  formatAreaValueOnly,
  formatLength,
  formatLengthValueOnly,
  formatWeight,
  formatWeightValueOnly,
  getUnitSystem,
  parseLengthInputToMm,
} from "@/lib/settings/unitSystem";

const CHANGE = "plate-app-preferences-changed";

export function useAppPreferences() {
  const [preferences, setPreferencesState] = useState<AppPreferences>(() =>
    typeof window !== "undefined" ? getAppPreferences() : { unitSystem: "metric" }
  );

  useEffect(() => {
    const sync = () => setPreferencesState(getAppPreferences());
    window.addEventListener(CHANGE, sync);
    return () => window.removeEventListener(CHANGE, sync);
  }, []);

  const setPreferences = useCallback((next: AppPreferences) => {
    saveAppPreferences(next);
    setPreferencesState(next);
  }, []);

  const setUnitSystem = useCallback((unitSystem: UnitSystem) => {
    setPreferencesState((prev) => {
      const next = { ...prev, unitSystem };
      saveAppPreferences(next);
      return next;
    });
  }, []);

  const system = preferences.unitSystem;

  return {
    preferences,
    setPreferences,
    setUnitSystem,
    /** Shorthand formatters bound to current preference */
    formatLength: (mm: number) => formatLength(mm, system),
    formatArea: (m2: number) => formatArea(m2, system),
    formatWeight: (kg: number) => formatWeight(kg, system),
    formatLengthValue: (mm: number) => formatLengthValueOnly(mm, system),
    formatAreaValue: (m2: number) => formatAreaValueOnly(m2, system),
    formatWeightValue: (kg: number) => formatWeightValueOnly(kg, system),
    parseLengthInputToMm: (raw: string) => parseLengthInputToMm(raw, system),
    getUnitSystem: () => system,
  };
}

export {
  formatArea,
  formatAreaValueOnly,
  formatLength,
  formatLengthValueOnly,
  formatWeight,
  formatWeightValueOnly,
  getUnitSystem,
  parseLengthInputToMm,
} from "@/lib/settings/unitSystem";
