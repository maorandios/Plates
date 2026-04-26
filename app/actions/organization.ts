"use server";

import { createClient } from "@/lib/supabase/server";
import type { AppPreferences } from "@/types/settings";
import { DEFAULT_APP_PREFERENCES } from "@/types/settings";
import type { Json } from "@/types/supabase";

export type BootstrapSessionResult =
  | { ok: false; reason: "no_session" | "supabase_misconfigured" }
  | {
      ok: true;
      /** @deprecated use accountUserId — kept for app compatibility: equals auth user id. */
      orgId: string;
      /** The signed-in user id; one workspace per user. */
      accountUserId: string;
      orgName: string | null;
      onboardingCompleted: boolean;
      onboardingPending: boolean;
    };

function parseAppPreferences(raw: unknown): AppPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_APP_PREFERENCES;
  const o = raw as Record<string, unknown>;
  return {
    ...DEFAULT_APP_PREFERENCES,
    companyName: typeof o.companyName === "string" ? o.companyName : undefined,
    companyRegistration:
      typeof o.companyRegistration === "string" ? o.companyRegistration : undefined,
    companyEmail: typeof o.companyEmail === "string" ? o.companyEmail : undefined,
    companyPhone: typeof o.companyPhone === "string" ? o.companyPhone : undefined,
    companyWebsite: typeof o.companyWebsite === "string" ? o.companyWebsite : undefined,
    companyAddress: typeof o.companyAddress === "string" ? o.companyAddress : undefined,
  };
}

/**
 * Load session, ensure a default account row in public.users, return flags for the UI.
 * One account per auth user; orgId in the result is a legacy name for the same id.
 */
export async function bootstrapSession(): Promise<BootstrapSessionResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { ok: false, reason: "supabase_misconfigured" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, reason: "no_session" };
  }

  const { data: acct, error: selErr } = await supabase
    .from("users")
    .select("name, onboarding_completed, onboarding_pending")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) {
    return { ok: false, reason: "no_session" };
  }

  if (acct) {
    return {
      ok: true,
      orgId: user.id,
      accountUserId: user.id,
      orgName: acct.name,
      onboardingCompleted: acct.onboarding_completed,
      onboardingPending: acct.onboarding_pending,
    };
  }

  const { error: insErr } = await supabase.from("users").insert({
    user_id: user.id,
    email: user.email ?? null,
    name: "Workspace",
    onboarding_pending: true,
    onboarding_completed: false,
    app_preferences: DEFAULT_APP_PREFERENCES as unknown as Json,
  });
  if (insErr) {
    return { ok: false, reason: "no_session" };
  }

  return {
    ok: true,
    orgId: user.id,
    accountUserId: user.id,
    orgName: "Workspace",
    onboardingCompleted: false,
    onboardingPending: true,
  };
}

export type CompleteOnboardingInput = {
  companyName: string;
  registration: string;
  phone1: string;
  /** Single full address line (street, city, etc.). */
  address: string;
};

/**
 * Mark onboarding done and save company + preferences to public.users.
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "not_authenticated" };
  }

  const name = input.companyName.trim() || "Workspace";
  const addr = input.address.trim() || undefined;

  const { data: existingSet } = await supabase
    .from("users")
    .select("app_preferences")
    .eq("user_id", user.id)
    .maybeSingle();
  const base = parseAppPreferences(existingSet?.app_preferences);
  const merged: AppPreferences = {
    ...base,
    companyName: name,
    companyRegistration: input.registration.trim() || undefined,
    companyPhone: input.phone1.trim() || undefined,
    companyAddress: addr || undefined,
  };
  const { error: sErr } = await supabase
    .from("users")
    .upsert(
      {
        user_id: user.id,
        name,
        onboarding_completed: true,
        onboarding_pending: false,
        email: user.email ?? null,
        app_preferences: merged as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (sErr) {
    return { ok: false, error: sErr.message };
  }
  return { ok: true };
}
