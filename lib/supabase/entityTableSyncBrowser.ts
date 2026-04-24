/**
 * Entity sync using the **browser** Supabase client so the user JWT is always attached
 * (server actions on Vercel often run without a readable session cookie).
 */
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import {
  clientToRow,
  projectToRow,
  quoteToRow,
  rowToClient,
  rowToProject,
  rowToQuote,
  type LoadedEntityTables,
} from "@/lib/supabase/entityMappers";
import type { Client } from "@/types/clients";
import type { QuoteListRecord } from "@/lib/quotes/quoteList";
import type { PlateProjectListRecord } from "@/lib/projects/plateProjectList";
import type { MaterialConfig } from "@/types/materials";

async function getBrowserOrgId(): Promise<string | null> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return null;
  }
  const supabase = createClient();
  await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[PLATE] Supabase entity sync: no auth session");
    }
    return null;
  }
  const { data: m, error } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[PLATE] org lookup failed", error.message);
  }
  return m?.org_id ?? null;
}

export async function syncClientsToSupabase(
  clients: Client[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: true };
  }
  const orgId = await getBrowserOrgId();
  if (!orgId) {
    return { ok: false, error: "no_org_or_session" };
  }
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("org_id", orgId);
  const nextIds = new Set(clients.map((c) => c.id));
  const toDelete = (existing ?? [])
    .map((r) => r.id)
    .filter((id) => !nextIds.has(id));
  for (const id of toDelete) {
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);
    if (error) {
      return { ok: false, error: error.message };
    }
  }
  if (clients.length === 0) {
    return { ok: true };
  }
  const { error: upErr } = await supabase
    .from("clients")
    .upsert(clients.map((c) => clientToRow(orgId, c)), { onConflict: "id" });
  if (upErr) {
    return { ok: false, error: upErr.message };
  }
  return { ok: true };
}

export async function syncQuotesToSupabase(
  quotes: QuoteListRecord[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: true };
  }
  const orgId = await getBrowserOrgId();
  if (!orgId) {
    return { ok: false, error: "no_org_or_session" };
  }
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("quotes")
    .select("id")
    .eq("org_id", orgId);
  const nextIds = new Set(quotes.map((q) => q.id));
  for (const row of existing ?? []) {
    if (!nextIds.has(row.id)) {
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", row.id)
        .eq("org_id", orgId);
      if (error) {
        return { ok: false, error: error.message };
      }
    }
  }
  if (quotes.length === 0) {
    return { ok: true };
  }
  const { error } = await supabase
    .from("quotes")
    .upsert(quotes.map((q) => quoteToRow(orgId, q)), { onConflict: "id" });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function syncProjectsToSupabase(
  projects: PlateProjectListRecord[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: true };
  }
  const orgId = await getBrowserOrgId();
  if (!orgId) {
    return { ok: false, error: "no_org_or_session" };
  }
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("org_id", orgId);
  const nextIds = new Set(projects.map((p) => p.id));
  for (const row of existing ?? []) {
    if (!nextIds.has(row.id)) {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", row.id)
        .eq("org_id", orgId);
      if (error) {
        return { ok: false, error: error.message };
      }
    }
  }
  if (projects.length === 0) {
    return { ok: true };
  }
  const { error } = await supabase
    .from("projects")
    .upsert(projects.map((p) => projectToRow(orgId, p)), { onConflict: "id" });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function syncSteelTypesFromMaterialConfigs(
  configs: MaterialConfig[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: true };
  }
  const orgId = await getBrowserOrgId();
  if (!orgId) {
    return { ok: false, error: "no_org_or_session" };
  }
  const supabase = createClient();
  const { error: delErr } = await supabase
    .from("steel_types")
    .delete()
    .eq("org_id", orgId);
  if (delErr) {
    return { ok: false, error: delErr.message };
  }
  const rows: {
    org_id: string;
    family: string;
    name: string;
    sort_order: number;
    is_active: boolean;
  }[] = [];
  for (const c of configs) {
    let i = 0;
    for (const name of c.enabledGrades) {
      const t = name.trim();
      if (!t) continue;
      rows.push({
        org_id: orgId,
        family: c.materialType,
        name: t,
        sort_order: i++,
        is_active: true,
      });
    }
  }
  if (rows.length === 0) {
    return { ok: true };
  }
  const { error: insErr } = await supabase.from("steel_types").insert(rows);
  if (insErr) {
    return { ok: false, error: insErr.message };
  }
  return { ok: true };
}

/**
 * Load clients, quotes, and projects (browser session) for localStorage hydration.
 */
export async function loadEntityTablesForOrg(): Promise<
  LoadedEntityTables | { error: string }
> {
  if (!isSupabaseConfigured()) {
    return { error: "not_configured" };
  }
  const orgId = await getBrowserOrgId();
  if (!orgId) {
    return { error: "no_org_or_session" };
  }
  const supabase = createClient();
  const [cRes, qRes, pRes] = await Promise.all([
    supabase.from("clients").select("*").eq("org_id", orgId).order("updated_at", { ascending: false }),
    supabase.from("quotes").select("*").eq("org_id", orgId).order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("*")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false }),
  ]);
  if (cRes.error) {
    return { error: cRes.error.message };
  }
  if (qRes.error) {
    return { error: qRes.error.message };
  }
  if (pRes.error) {
    return { error: pRes.error.message };
  }
  return {
    clients: (cRes.data ?? []).map((r) => rowToClient(r as never)),
    quotes: (qRes.data ?? []).map((r) => rowToQuote(r as never)),
    projects: (pRes.data ?? []).map((r) => rowToProject(r as never)),
  };
}
