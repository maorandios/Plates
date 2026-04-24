"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";

export type UserWorkspaceRow = {
  org_id: string;
  email: string | null;
  app_preferences: Json;
  material_config: Json | null;
  cutting_profiles: Json | null;
  updated_at: string;
};

/**
 * Read org settings + all domain snapshot rows (used after login to hydrate the client).
 */
export async function loadRemoteOrgData(orgId: string): Promise<{
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
  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!m) {
    return "forbidden";
  }
  const { data: settings } = await supabase
    .from("users")
    .select("org_id, email, app_preferences, material_config, cutting_profiles, updated_at")
    .eq("org_id", orgId)
    .maybeSingle();
  const { data: snapshots } = await supabase
    .from("org_domain_snapshots")
    .select("data_key, payload, updated_at")
    .eq("org_id", orgId);
  return {
    settings: settings
      ? {
          org_id: settings.org_id,
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
 */
export async function patchOrgSettings(
  orgId: string,
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
  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!m) {
    return { ok: false, error: "forbidden" };
  }
  const { data: cur } = await supabase
    .from("users")
    .select("app_preferences, material_config, cutting_profiles, email")
    .eq("org_id", orgId)
    .maybeSingle();
  const next = {
    org_id: orgId,
    email: user.email ?? cur?.email ?? null,
    app_preferences: patch.app_preferences ?? cur?.app_preferences ?? null,
    material_config:
      patch.material_config !== undefined ? patch.material_config : cur?.material_config ?? null,
    cutting_profiles:
      patch.cutting_profiles !== undefined ? patch.cutting_profiles : cur?.cutting_profiles ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("users").upsert(next, {
    onConflict: "org_id",
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function upsertDomainSnapshot(
  orgId: string,
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
  const { data: m } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!m) {
    return { ok: false, error: "forbidden" };
  }
  const { error } = await supabase.from("org_domain_snapshots").upsert(
    {
      org_id: orgId,
      data_key: dataKey,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,data_key" }
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
