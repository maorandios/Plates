import { getPublicSupabaseConfig } from "@/lib/supabase/runtimePublicEnv";

export function isSupabaseConfigured(): boolean {
  return getPublicSupabaseConfig() !== null;
}
