"use client";

import { Suspense, useId, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { safeInternalNextPath } from "@/lib/auth/publicPaths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

function isValidEmail(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const raw = searchParams.get("next");
    if (raw) {
      return safeInternalNextPath(raw);
    }
    return "/";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const emailId = useId();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailReady = isValidEmail(email);
  const magicLinkDisabledHint = t("auth.magicLinkDisabledHint");
  const useSupabase = isSupabaseConfigured();

  const authCallbackUrl = () => {
    if (typeof window === "undefined") return "";
    const enc = encodeURIComponent(nextPath);
    return `${window.location.origin}/auth/callback?next=${enc}`;
  };

  const afterMagicLinkLocal = () => {
    router.push(nextPath === "/" ? "/" : nextPath);
  };

  const signInWithEmail = async () => {
    if (!emailReady || !useSupabase) return;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: authCallbackUrl() },
      });
      if (err) {
        setError(t("auth.authGenericError"));
        return;
      }
      setSent(true);
    } catch {
      setError(t("auth.authGenericError"));
    } finally {
      setBusy(false);
    }
  };

  const onMagicClick = () => {
    if (useSupabase) {
      void signInWithEmail();
      return;
    }
    afterMagicLinkLocal();
  };

  const linkSent = sent && useSupabase;

  const authBlocks = (
    <>
      {error ? (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="space-y-1.5">
        <Button
          type="button"
          disabled={!emailReady || busy}
          title={!emailReady ? magicLinkDisabledHint : undefined}
          className="w-full text-sm font-semibold enabled:shadow-sm disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none disabled:hover:bg-muted"
          size="lg"
          onClick={onMagicClick}
        >
          {t("auth.magicLinkLoginButton")}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {t("auth.magicLinkSubtext")}
        </p>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-background md:flex-row">
      <section
        className="flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:px-8 md:w-1/2 md:flex-1"
        aria-label={t("auth.screenAria")}
      >
        <div className="w-full max-w-md space-y-7 text-center">
          <div className="text-center">
            <Image
              src="/icons/MAINLOGOALL.svg?v=1"
              alt=""
              width={1374}
              height={364}
              className="mx-auto h-[3.125rem] w-auto max-w-[15.625rem] object-contain object-center sm:h-[3.515625rem]"
            />
          </div>

          <div className="space-y-7">
            {linkSent ? (
              <p
                className="text-center text-base leading-relaxed text-foreground"
                role="status"
              >
                {t("auth.magicLinkSentPanel")}
              </p>
            ) : (
              <>
                <div className="space-y-2 text-center">
                  <Label
                    htmlFor={emailId}
                    className="block w-full text-center text-foreground text-sm font-semibold"
                  >
                    {t("auth.email")}
                  </Label>
                  <Input
                    id={emailId}
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t("auth.emailPlaceholder")}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setSent(false);
                      setError(null);
                    }}
                    className="text-center md:text-center"
                  />
                </div>
                {authBlocks}
              </>
            )}
          </div>

          <footer className="mt-10 text-center text-xs text-muted-foreground">
            {t("auth.copyrightFooter")}
          </footer>
        </div>
      </section>

      {/* RTL: visual left half. File: public/splitimage.png */}
      <div
        className="relative hidden min-h-0 h-full w-full border-s border-border bg-muted/15 md:block md:w-1/2 md:flex-1"
        aria-hidden
      >
        <Image
          src="/splitimage.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="50vw"
          priority
        />
      </div>
    </div>
  );
}

export function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50svh] w-full items-center justify-center bg-background">
          <span className="text-muted-foreground text-sm" aria-hidden>
            …
          </span>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
