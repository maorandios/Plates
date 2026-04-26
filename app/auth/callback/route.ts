import { bootstrapSession } from "@/app/actions/organization";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { safeInternalNextPath } from "@/lib/auth/publicPaths";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = safeInternalNextPath(rawNext);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      try {
        const boot = await bootstrapSession();
        if (boot.ok && !boot.onboardingCompleted) {
          return NextResponse.redirect(new URL("/onboarding", origin));
        }
      } catch {
        // Fall through: send user to the requested page; client guard will
        // route incomplete onboarding to /onboarding if needed.
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
