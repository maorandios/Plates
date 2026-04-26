"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import {
  computeTrialDaysLeft,
  HAS_ACTIVE_SUBSCRIPTION,
} from "@/lib/billing/trial";

/**
 * Days left in the sign-up trial window, or null if not applicable.
 * Returns `undefined` only briefly before the first client read.
 *
 * We always use `getUser()` for `created_at` — the `session` passed to
 * `onAuthStateChange` can omit it or run before cookies hydrate, which used to
 * leave the chip hidden or `undefined` forever.
 */
export function useTrialDaysLeft():
  | undefined
  | { kind: "hidden" }
  | { kind: "ready"; days: number } {
  const [state, setState] = useState<
    undefined | { kind: "hidden" } | { kind: "ready"; days: number }
  >(undefined);

  useEffect(() => {
    if (HAS_ACTIVE_SUBSCRIPTION) {
      setState({ kind: "hidden" });
      return;
    }
    if (!isSupabaseConfigured()) {
      setState({ kind: "hidden" });
      return;
    }
    const supabase = createClient();

    const applyFromUser = (createdAt: string | undefined | null) => {
      const days = computeTrialDaysLeft(createdAt ?? null);
      if (days == null) {
        setState({ kind: "hidden" });
        return;
      }
      setState({ kind: "ready", days });
    };

    const sync = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          setState({ kind: "hidden" });
          return;
        }
        let created: string | undefined = data.user.created_at;
        if (!created) {
          const { data: sess } = await supabase.auth.getSession();
          created = sess.session?.user?.created_at;
        }
        applyFromUser(created ?? null);
      } catch {
        setState({ kind: "hidden" });
      }
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s == null) {
        setState({ kind: "hidden" });
        return;
      }
      void sync();
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
