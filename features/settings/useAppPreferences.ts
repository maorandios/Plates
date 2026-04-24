"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppPreferences, UnitSystem } from "@/types/settings";
import { setStoredUnitSystem } from "@/lib/settings/unitPreferenceStorage";
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
    typeof window !== "undefined" ? getAppPreferences() : {}
  );
  const [unitTick, setUnitTick] = useState(0);

  useEffect(() => {
    const sync = () => {
      setPreferencesState(getAppPreferences());
      setUnitTick((n) => n + 1);
    };
    window.addEventListener(CHANGE, sync);
    return () => window.removeEventListener(CHANGE, sync);
  }, []);

  const setPreferences = useCallback((next: AppPreferences) => {
    saveAppPreferences(next);
    setPreferencesState(next);
  }, []);

  const setUnitSystem = useCallback((next: UnitSystem) => {
    setStoredUnitSystem(next);
  }, []);

  void unitTick;
  const unitSystem = getUnitSystem();

  return {
    preferences,
    /** Device-only. Not in `preferences` (not synced to Supabase). */
    unitSystem,
    setPreferences,
    setUnitSystem,
    /** Shorthand formatters bound to current unit system */
    formatLength: (mm: number) => formatLength(mm, unitSystem),
    formatArea: (m2: number) => formatArea(m2, unitSystem),
    formatWeight: (kg: number) => formatWeight(kg, unitSystem),
    formatLengthValue: (mm: number) => formatLengthValueOnly(mm, unitSystem),
    formatAreaValue: (m2: number) => formatAreaValueOnly(m2, unitSystem),
    formatWeightValue: (kg: number) => formatWeightValueOnly(kg, unitSystem),
    parseLengthInputToMm: (raw: string) => parseLengthInputToMm(raw, unitSystem),
    getUnitSystem: () => getUnitSystem(),
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
