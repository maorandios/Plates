"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  hasOnboardingPending,
  isOnboardingComplete,
  onboardingGateShouldRedirect,
} from "@/lib/onboardingLocal";

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const complete = isOnboardingComplete();
    const pending = hasOnboardingPending();
    if (onboardingGateShouldRedirect(pathname, pending, complete)) {
      router.replace("/onboarding");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
