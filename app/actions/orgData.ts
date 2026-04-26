"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

export type UserWorkspaceRow = {
  user_id: string;
  email: string | null;
  app_preferences: Json;
  material_config: Json | null;
  cutting_profiles: Json | null;
  updated_at: string;
};

/**
 * Read account settings + all domain snapshot rows (used after login to hydrate the client).
 * @param accountUserId Must equal the signed-in user id (legacy callers pass session.orgId).
 */
export async function loadRemoteOrgData(accountUserId: string): Promise<{
  settings: UserWorkspaceRow | null;
  snapshots: { data_key: string; payload: Json; updated_at: string }[];
} | "forbidden" | "no_session"> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return "no_session";
  }
  if (user.id !== accountUserId) {
    return "forbidden";
  }
  const { data: settings } = await supabase
    .from("users")
    .select("user_id, email, app_preferences, material_config, cutting_profiles, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: snapshots } = await supabase
    .from("org_domain_snapshots")
    .select("data_key, payload, updated_at")
    .eq("user_id", user.id);
  return {
    settings: settings
      ? {
          user_id: settings.user_id,
          email: settings.email,
          app_preferences: settings.app_preferences,
          material_config: settings.material_config,
          cutting_profiles: settings.cutting_profiles,
          updated_at: settings.updated_at,
        }
      : null,
    snapshots: (snapshots ?? []) as { data_key: string; payload: Json; updated_at: string }[],
  };
}

/**
 * Partial upsert of public.users (only provided keys are sent).
 * @param accountUserId Must equal the signed-in user (legacy: session.orgId).
 */
export async function patchOrgSettings(
  accountUserId: string,
  patch: {
    app_preferences?: Json;
    material_config?: Json | null;
    cutting_profiles?: Json | null;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "not_authenticated" };
  }
  if (user.id !== accountUserId) {
    return { ok: false, error: "forbidden" };
  }
  const { data: cur } = await supabase
    .from("users")
    .select("app_preferences, material_config, cutting_profiles, email, name, onboarding_completed, onboarding_pending")
    .eq("user_id", user.id)
    .maybeSingle();
  const next = {
    user_id: user.id,
    name: cur?.name ?? "Workspace",
    onboarding_completed: cur?.onboarding_completed ?? false,
    onboarding_pending: cur?.onboarding_pending ?? true,
    email: user.email ?? cur?.email ?? null,
    app_preferences: patch.app_preferences ?? cur?.app_preferences ?? null,
    material_config:
      patch.material_config !== undefined ? patch.material_config : cur?.material_config ?? null,
    cutting_profiles:
      patch.cutting_profiles !== undefined ? patch.cutting_profiles : cur?.cutting_profiles ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("users").upsert(next, {
    onConflict: "user_id",
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function upsertDomainSnapshot(
  accountUserId: string,
  dataKey: string,
  payload: Json
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "not_authenticated" };
  }
  if (user.id !== accountUserId) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await supabase.from("org_domain_snapshots").upsert(
    {
      user_id: user.id,
      data_key: dataKey,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,data_key" }
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
