/**
 * Global app / company preferences (single-user localStorage today; same shape for future API).
 */

export type UnitSystem = "metric" | "imperial";

/**
 * Company + letterhead fields synced in `public.users` (and localStorage).
 * Unit system is stored separately (device-only, see `unitPreferenceStorage`).
 */
export interface AppPreferences {
  /** Letterhead defaults for quotations (overrides env when set in Settings). */
  companyName?: string;
  /** Company registration number (ח.פ) — shown on PDF letterhead when set. */
  companyRegistration?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  /** Multi-line allowed; shown on PDF letterhead when set. */
  companyAddress?: string;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {};

/**
 * Purchased sheet inventory template (global). Used when configuring stock per batch
 * to pick width × length for a given plate thickness without retyping.
 */
export interface PurchasedSheetSize {
  id: string;
  /** Optional name, e.g. “Full sheet — supplier A” */
  label: string;
  widthMm: number;
  lengthMm: number;
  /** Plate thickness this stock is bought for (mm). */
  thicknessMm: number;
  updatedAt: string;
}
