"use server";

import { createClient } from "@/lib/supabase/server";
import type { AppPreferences } from "@/types/settings";
import { DEFAULT_APP_PREFERENCES } from "@/types/settings";
import type { Json } from "@/types/supabase";

export type BootstrapSessionResult =
  | { ok: false; reason: "no_session" | "supabase_misconfigured" }
  | {
      ok: true;
      orgId: string;
      orgName: string | null;
      onboardingCompleted: boolean;
      onboardingPending: boolean;
    };

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
 * Load session, ensure a default org for new users, return flags for the UI.
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

  const { data: mrows } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1);

  const existingOrgId = mrows?.[0]?.org_id ?? null;

  if (existingOrgId) {
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id, name, onboarding_completed, onboarding_pending")
      .eq("id", existingOrgId)
      .single();
    if (orgErr || !org) {
      return { ok: false, reason: "no_session" };
    }
    return {
      ok: true,
      orgId: org.id,
      orgName: org.name,
      onboardingCompleted: org.onboarding_completed,
      onboardingPending: org.onboarding_pending,
    };
  }

  const { data: org, error: insErr } = await supabase
    .from("organizations")
    .insert({
      name: "Workspace",
      onboarding_pending: true,
      onboarding_completed: false,
    })
    .select("id, name, onboarding_completed, onboarding_pending")
    .single();
  if (insErr || !org) {
    return { ok: false, reason: "no_session" };
  }

  const { error: memErr } = await supabase.from("organization_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: "owner",
  });
  if (memErr) {
    return { ok: false, reason: "no_session" };
  }

  const { error: stErr } = await supabase.from("org_settings").insert({
    org_id: org.id,
    app_preferences: DEFAULT_APP_PREFERENCES as unknown as Json,
  });
  if (stErr) {
    return { ok: false, reason: "no_session" };
  }

  return {
    ok: true,
    orgId: org.id,
    orgName: org.name,
    onboardingCompleted: org.onboarding_completed,
    onboardingPending: org.onboarding_pending,
  };
}

export type CompleteOnboardingInput = {
  companyName: string;
  registration: string;
  phone1: string;
  address: string;
  city: string;
  phone2: string;
};

/**
 * Mark onboarding done and save company + preferences to org + org_settings.
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

  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!m) {
    return { ok: false, error: "no_organization" };
  }
  const orgId = m.org_id;

  const name = input.companyName.trim() || "Workspace";
  const addr = [input.address.trim(), input.city.trim()].filter(Boolean).join("\n");
  const { error: oErr } = await supabase
    .from("organizations")
    .update({
      name,
      onboarding_completed: true,
      onboarding_pending: false,
    })
    .eq("id", orgId);
  if (oErr) {
    return { ok: false, error: oErr.message };
  }

  const { data: existingSet } = await supabase
    .from("org_settings")
    .select("app_preferences")
    .eq("org_id", orgId)
    .maybeSingle();
  const base = parseAppPreferences(existingSet?.app_preferences);
  const merged: AppPreferences = {
    ...base,
    companyName: name,
    companyRegistration: input.registration.trim() || undefined,
    companyPhone: input.phone1.trim() || undefined,
    companyPhoneSecondary: input.phone2.trim() || undefined,
    companyAddress: addr || undefined,
  };
  const { error: sErr } = await supabase
    .from("org_settings")
    .upsert(
      {
        org_id: orgId,
        app_preferences: merged as unknown as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    );
  if (sErr) {
    return { ok: false, error: sErr.message };
  }
  return { ok: true };
}
