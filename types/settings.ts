/**
 * Global app / company preferences (single-user localStorage today; same shape for future API).
 */

export type UnitSystem = "metric" | "imperial";

export interface AppPreferences {
  unitSystem: UnitSystem;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  unitSystem: "metric",
};
