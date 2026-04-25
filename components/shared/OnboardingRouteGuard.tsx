"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  hasOnboardingPending,
  isOnboardingComplete,
  onboardingGateShouldRedirect,
} from "@/lib/onboardingLocal";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { isDevOnboardingPreviewEnabled } from "@/lib/devOnboardingPreview";
import { useOrgBootstrap } from "@/components/providers/OrgBootstrapProvider";

type OnboardingRouteGuardProps = {
  children: React.ReactNode;
};

/**
 * After signup, keeps the user in the onboarding flow until it is completed
 * (or they stay on /login or /onboarding); prevents using the app until then.
 */
export function OnboardingRouteGuard({ children }: OnboardingRouteGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, session } = useOrgBootstrap();

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isSupabaseConfigured()) {
      if (loading) return;
      if (!session) return;
      if (!session.ok) {
        return;
      }
      if (session.onboardingCompleted) {
        if (
          (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) &&
          !isDevOnboardingPreviewEnabled()
        ) {
          router.replace("/");
        }
        return;
      }
      if (
        session.onboardingPending &&
        !session.onboardingCompleted &&
        pathname !== "/login" &&
        !pathname.startsWith("/login/") &&
        pathname !== "/onboarding" &&
        !pathname.startsWith("/onboarding/")
      ) {
        router.replace("/onboarding");
      }
      return;
    }

    const complete = isOnboardingComplete();
    const pending = hasOnboardingPending();
    if (onboardingGateShouldRedirect(pathname, pending, complete)) {
      router.replace("/onboarding");
    }
  }, [pathname, router, loading, session]);

  return <>{children}</>;
}
