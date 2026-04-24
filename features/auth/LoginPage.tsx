"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { setOnboardingPending } from "@/lib/onboardingLocal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

type AuthMode = "login" | "signup";

function isValidEmail(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function OrDivider() {
  return (
    <div className="relative py-1" role="separator" aria-label={t("auth.magicLinkDivider")}>
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-background px-3 text-muted-foreground">
          {t("auth.magicLinkDivider")}
        </span>
      </div>
    </div>
  );
}

export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const emailId = useId();

  const emailReady = isValidEmail(email);
  const magicLinkDisabledHint = t("auth.magicLinkDisabledHint");

  const afterMagicOrGoogle = () => {
    if (mode === "signup") {
      setOnboardingPending();
      router.push("/onboarding");
      return;
    }
    router.push("/");
  };

  const authBlocks = (
    <>
      <div className="space-y-1.5">
        <Button
          type="button"
          disabled={!emailReady}
          title={!emailReady ? magicLinkDisabledHint : undefined}
          className="w-full text-sm font-semibold enabled:shadow-sm disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none disabled:hover:bg-muted"
          size="lg"
          onClick={afterMagicOrGoogle}
        >
          {mode === "login"
            ? t("auth.magicLinkLoginButton")
            : t("auth.magicLinkSignUp")}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {mode === "login"
            ? t("auth.magicLinkSubtext")
            : t("auth.magicLinkSubtextSignUp")}
        </p>
      </div>

      <OrDivider />

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 border-border bg-card text-foreground shadow-sm hover:bg-muted/50"
        size="lg"
        onClick={afterMagicOrGoogle}
      >
        <GoogleMark className="size-5 shrink-0" />
        <span className="text-sm font-medium">
          {mode === "login"
            ? t("auth.loginWithGoogle")
            : t("auth.signUpWithGoogle")}
        </span>
      </Button>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-background md:flex-row">
      <section
        className="flex min-h-0 w-full min-w-0 flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:px-8 md:w-1/2 md:flex-1"
        aria-label={t("auth.screenAria")}
      >
        <div className="w-full max-w-md space-y-7 text-start">
          <div className="text-center">
            <Image
              src="/icons/MAINLOGOALL.svg?v=1"
              alt=""
              width={1374}
              height={364}
              className="mx-auto h-10 w-auto max-w-[12.5rem] object-contain object-center sm:h-[2.8125rem]"
            />
          </div>

          <div className="space-y-7">
            <div className="space-y-2 text-start">
              <Label
                htmlFor={emailId}
                className="text-foreground text-sm font-semibold"
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
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {authBlocks}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                {t("auth.footerNoAccount")}{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-semibold text-primary hover:underline"
                >
                  {t("auth.footerSignUp")}
                </button>
              </>
            ) : (
              <>
                {t("auth.footerHasAccount")}{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-semibold text-primary hover:underline"
                >
                  {t("auth.footerLogIn")}
                </button>
              </>
            )}
          </p>

          <footer className="mt-10 text-center text-xs text-muted-foreground">
            {t("auth.copyrightFooter")}
          </footer>
        </div>
      </section>

      <div
        className="hidden min-h-0 w-1/2 flex-1 border-s border-border bg-muted/15 md:block"
        aria-hidden
      />
    </div>
  );
}
