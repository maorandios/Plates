/**
 * Entity sync using the **browser** Supabase client so the user JWT is always attached
 * (server actions on Vercel often run without a readable session cookie).
 */
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { getOrgIdFromWindow } from "@/lib/supabase/runtimePublicEnv";
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
import { getQuotesList } from "@/lib/quotes/quoteList";
import type { PlateProjectListRecord } from "@/lib/projects/plateProjectList";
import { getPlateProjectsList } from "@/lib/projects/plateProjectList";
import type { MaterialConfig } from "@/types/materials";
import type { Json } from "@/types/supabase";
import {
  applyQuoteSessionPayloadFromServer,
  getQuoteSnapshot,
} from "@/lib/quotes/quoteSnapshot";

async function getBrowserOrgId(): Promise<string | null> {
  if (!isSupabaseConfigured() || typeof window === "undefined") {
    return null;
  }
  const fromBootstrap = getOrgIdFromWindow();
  if (fromBootstrap) {
    return fromBootstrap;
  }
  try {
    const supabase = createClient();
    await supabase.auth.getSession();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn(
        "[PLATE] Supabase sync: no session — sign in so data can save to the cloud."
      );
      return null;
    }
    const { data: rows, error } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1);
    if (error) {
      console.warn("[PLATE] org lookup failed", error.message);
      return null;
    }
    return rows?.[0]?.org_id ?? null;
  } catch (e) {
    console.warn("[PLATE] getBrowserOrgId error", e);
    return null;
  }
}

const PLATE_CLIENTS_LS = "plate_clients";

function readClientsFromLocalStorage(): Client[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PLATE_CLIENTS_LS);
    if (!raw) return [];
    return JSON.parse(raw) as Client[];
  } catch {
    return [];
  }
}

/**
 * @param orgIdForSync When set (e.g. org id from session / `pushToServer`), avoids relying on
 * `window.__PLATE_ORG_ID__` being set before the first sync.
 */
export async function syncClientsToSupabase(
  clients: Client[],
  orgIdForSync?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "supabase_not_configured_in_browser" };
  }
  const orgId = orgIdForSync ?? (await getBrowserOrgId());
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
  quotes: QuoteListRecord[],
  orgIdForSync?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "supabase_not_configured_in_browser" };
  }
  const orgId = orgIdForSync ?? (await getBrowserOrgId());
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
  const rows = quotes.map((q) => {
    const base = quoteToRow(orgId, q);
    const snap = getQuoteSnapshot(q.id);
    return {
      ...base,
      session_payload: (snap ?? null) as unknown as Json,
    };
  });
  const { error } = await supabase.from("quotes").upsert(rows, { onConflict: "id" });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function syncProjectsToSupabase(
  projects: PlateProjectListRecord[],
  orgIdForSync?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "supabase_not_configured_in_browser" };
  }
  const orgId = orgIdForSync ?? (await getBrowserOrgId());
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

/**
 * Pushes `plate_clients`, `plate_quotes_list_v1`, and `plate_projects_list_v1` to Supabase
 * in one shot. Call with the same `orgId` as `SupabaseSyncProvider` `pushToServer` so
 * relational tables stay aligned with `org_domain_snapshots` on the live app.
 */
export async function syncAllEntityTablesForOrg(
  orgId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || typeof window === "undefined" || !orgId) {
    return { ok: true };
  }
  const clients = readClientsFromLocalStorage();
  const [c, q, p] = await Promise.all([
    syncClientsToSupabase(clients, orgId),
    syncQuotesToSupabase(getQuotesList(), orgId),
    syncProjectsToSupabase(getPlateProjectsList(), orgId),
  ]);
  const errors: string[] = [];
  if (!c.ok) errors.push(`clients: ${c.error}`);
  if (!q.ok) errors.push(`quotes: ${q.error}`);
  if (!p.ok) errors.push(`projects: ${p.error}`);
  if (errors.length > 0) {
    return { ok: false, error: errors.join("; ") };
  }
  return { ok: true };
}

export async function syncSteelTypesFromMaterialConfigs(
  configs: MaterialConfig[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "supabase_not_configured_in_browser" };
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
  for (const r of qRes.data ?? []) {
    const row = r as { id: string; session_payload?: unknown };
    if (row.session_payload != null) {
      applyQuoteSessionPayloadFromServer(row.id, row.session_payload);
    }
  }
  return {
    clients: (cRes.data ?? []).map((r) => rowToClient(r as never)),
    quotes: (qRes.data ?? []).map((r) => rowToQuote(r as never)),
    projects: (pRes.data ?? []).map((r) => rowToProject(r as never)),
  };
}
