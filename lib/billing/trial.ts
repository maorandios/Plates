/**
 * Client-side trial window from Supabase user `created_at` until billing is wired to real plans.
 * Shared with the bill-and-usage page and the top bar trial chip.
 */
export const TRIAL_DAYS = 30;

/** When true, hide trial UI; wire when subscriptions exist. */
export const HAS_ACTIVE_SUBSCRIPTION = false;

export function computeTrialDaysLeft(createdAt: string | undefined | null): number | null {
  if (!createdAt) return null;
  const startMs = new Date(createdAt).getTime();
  if (Number.isNaN(startMs)) return null;
  const endMs = startMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000)));
}
