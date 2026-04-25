"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAppPreferences,
  saveAppPreferences,
} from "@/lib/settings/appPreferences";
import { markOnboardingComplete, isOnboardingComplete } from "@/lib/onboardingLocal";
import { completeOnboarding } from "@/app/actions/organization";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { isDevOnboardingPreviewEnabled } from "@/lib/devOnboardingPreview";
import { useOrgBootstrap } from "@/components/providers/OrgBootstrapProvider";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Data-collection screens before the final “done” step. */
const DATA_STEPS = 4;
const SK = "onboarding" as const;

/** Typed value: text-base. Placeholder: 1.25rem (~1.25× 1rem). Overrides Input’s `md:text-sm`. */
const fieldClass =
  "h-14 rounded-[10px] border border-border bg-input px-4 text-center text-base md:text-base placeholder:text-[1.25rem] md:placeholder:text-[1.25rem] placeholder:text-muted-foreground/90";

const VALID_STEPS = [0, 1, 2, 3, 4, 5] as const;
type Step = (typeof VALID_STEPS)[number];

function stepCanProceed(
  s: Step,
  data: {
    companyName: string;
    registration: string;
    phone1: string;
    address: string;
  }
): boolean {
  const tr = (v: string) => v.trim();
  switch (s) {
    case 0:
    case 5:
      return true;
    case 1:
      return tr(data.companyName).length > 0;
    case 2:
      return tr(data.registration).length > 0;
    case 3:
      return tr(data.phone1).length > 0;
    case 4:
      return tr(data.address).length > 0;
    default:
      return false;
  }
}

export function OnboardingPage() {
  const router = useRouter();
  const { loading: orgLoading, session, refresh } = useOrgBootstrap();
  const singleFieldTitleId = useId();
  const [step, setStep] = useState<Step>(0);
  const [companyName, setCompanyName] = useState("");
  const [registration, setRegistration] = useState("");
  const [phone1, setPhone1] = useState("");
  const [address, setAddress] = useState("");

  const nameId = useId();
  const regId = useId();
  const phone1Id = useId();
  const addressId = useId();

  const data = {
    companyName,
    registration,
    phone1,
    address,
  };

  const canNext = stepCanProceed(step, data);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (orgLoading) return;
    if (isDevOnboardingPreviewEnabled()) {
      return;
    }
    if (isSupabaseConfigured()) {
      if (session?.ok && session.onboardingCompleted) {
        router.replace("/");
      }
      return;
    }
    if (isOnboardingComplete()) {
      router.replace("/");
    }
  }, [router, orgLoading, session]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    setStep((s) => (s < 5 ? (s + 1) as Step : s));
  }, [canNext]);

  const goBack = useCallback(() => {
    if (step > 0 && step < 5) {
      setStep((s) => (s - 1) as Step);
    }
  }, [step]);

  const finish = useCallback(async () => {
    const base = getAppPreferences();
    const addr = data.address.trim();
    saveAppPreferences({
      ...base,
      companyName: data.companyName.trim() || undefined,
      companyRegistration: data.registration.trim() || undefined,
      companyPhone: data.phone1.trim() || undefined,
      companyAddress: addr || undefined,
    });
    if (isSupabaseConfigured()) {
      const res = await completeOnboarding({
        companyName: data.companyName.trim(),
        registration: data.registration.trim(),
        phone1: data.phone1.trim(),
        address: addr,
      });
      if (!res.ok) {
        return;
      }
      refresh();
    }
    markOnboardingComplete();
    router.push("/");
  }, [data, router, refresh]);

  const dataIndexOnScreen = step >= 1 && step <= 4 ? step : 0;

  const preview = isDevOnboardingPreviewEnabled();

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center overflow-y-auto bg-background px-4 py-10 sm:px-8"
      dir="rtl"
    >
      <div className="flex w-full max-w-lg flex-col items-center gap-8">
        {preview ? (
          <p
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-950 dark:text-amber-100"
            role="status"
          >
            Local preview: you can design this flow even with onboarding already completed.
            Finishing the wizard still runs save actions against your org.
          </p>
        ) : null}
        <div className="text-center">
          <Image
            src="/icons/MAINLOGOALL.svg?v=1"
            alt=""
            width={1374}
            height={364}
            className="mx-auto h-10 w-auto max-w-[12.5rem] object-contain sm:h-[2.8125rem]"
          />
        </div>

        {step > 0 && step < 5 && (
          <OnboardingStepProgress
            current={dataIndexOnScreen}
            total={DATA_STEPS}
            label={t(`${SK}.progress`, {
              current: String(dataIndexOnScreen),
              total: String(DATA_STEPS),
            })}
          />
        )}

        {step === 0 && (
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center space-y-5 text-center">
            <h1 className="w-full text-balance text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t(`${SK}.welcomeTitle`)}
            </h1>
            <p className="w-full text-balance whitespace-pre-line text-center text-base leading-relaxed text-muted-foreground">
              {t(`${SK}.welcomeBody`)}
            </p>
            <div className="flex w-full justify-center">
              <Button
                type="button"
                size="lg"
                className="w-full max-w-sm text-base font-semibold"
                onClick={() => setStep(1)}
              >
                {t(`${SK}.startCta`)}
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <DataStepLayout
            onBack={goBack}
            onNext={goNext}
            canNext={canNext}
            nextLabel={t(`${SK}.next`)}
            backLabel={t(`${SK}.back`)}
          >
            <h2
              id={singleFieldTitleId}
              className="w-full text-center text-xl font-bold text-foreground sm:text-2xl"
            >
              {t(`${SK}.fieldBusinessName`)}
            </h2>
            <div className="w-full pt-1">
              <Input
                id={nameId}
                name="companyName"
                autoComplete="organization"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={t(`${SK}.fieldBusinessNamePlaceholder`)}
                className={cn(fieldClass)}
                aria-labelledby={singleFieldTitleId}
              />
            </div>
          </DataStepLayout>
        )}

        {step === 2 && (
          <DataStepLayout
            onBack={goBack}
            onNext={goNext}
            canNext={canNext}
            nextLabel={t(`${SK}.next`)}
            backLabel={t(`${SK}.back`)}
          >
            <h2
              id={singleFieldTitleId}
              className="w-full text-center text-xl font-bold text-foreground sm:text-2xl"
            >
              {t(`${SK}.fieldRegistration`)}
            </h2>
            <div className="w-full pt-1">
              <Input
                id={regId}
                name="registration"
                inputMode="text"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                placeholder={t(`${SK}.fieldRegistrationPlaceholder`)}
                className={cn(fieldClass)}
                aria-labelledby={singleFieldTitleId}
              />
            </div>
          </DataStepLayout>
        )}

        {step === 3 && (
          <DataStepLayout
            onBack={goBack}
            onNext={goNext}
            canNext={canNext}
            nextLabel={t(`${SK}.next`)}
            backLabel={t(`${SK}.back`)}
          >
            <h2
              id={singleFieldTitleId}
              className="w-full text-center text-xl font-bold text-foreground sm:text-2xl"
            >
              {t(`${SK}.fieldPhone`)}
            </h2>
            <div className="w-full pt-1">
              <Input
                id={phone1Id}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone1}
                onChange={(e) => setPhone1(e.target.value)}
                placeholder={t(`${SK}.fieldPhonePlaceholder`)}
                className={cn(fieldClass)}
                aria-labelledby={singleFieldTitleId}
              />
            </div>
          </DataStepLayout>
        )}

        {step === 4 && (
          <DataStepLayout
            onBack={goBack}
            onNext={goNext}
            canNext={canNext}
            nextLabel={t(`${SK}.next`)}
            backLabel={t(`${SK}.back`)}
          >
            <h2
              id={singleFieldTitleId}
              className="w-full text-center text-xl font-bold text-foreground sm:text-2xl"
            >
              {t(`${SK}.addressScreenTitle`)}
            </h2>
            <div className="w-full pt-1">
              <Input
                id={addressId}
                name="address"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t(`${SK}.fieldFullAddressPlaceholder`)}
                className={cn(fieldClass)}
                aria-labelledby={singleFieldTitleId}
              />
            </div>
          </DataStepLayout>
        )}

        {step === 5 && (
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center space-y-5 text-center">
            <h1 className="w-full text-balance text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t(`${SK}.doneTitle`)}
            </h1>
            <p className="w-full text-balance text-center text-base leading-relaxed text-muted-foreground">
              {t(`${SK}.doneBody`)}
            </p>
            <div className="flex w-full justify-center">
              <Button
                type="button"
                size="lg"
                className="w-full max-w-sm text-base font-semibold"
                onClick={finish}
              >
                {t(`${SK}.doneCta`)}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OnboardingStepProgress({
  current,
  total,
  label,
}: {
  current: number;
  total: number;
  label: string;
}) {
  const pct = Math.min(100, Math.max(0, (current / total) * 100));
  return (
    <div className="w-full max-w-xs">
      <p className="mb-1.5 text-center text-[11px] font-medium tabular-nums text-muted-foreground sm:text-xs">
        {label}
      </p>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-muted/90 ring-1 ring-border/50"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DataStepLayout({
  onBack,
  onNext,
  canNext,
  nextLabel,
  backLabel,
  children,
}: {
  onBack: () => void;
  onNext: () => void;
  canNext: boolean;
  nextLabel: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center space-y-6 text-center">
      {children}
      <div className="grid w-full grid-cols-[3fr_7fr] gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 min-w-0 max-w-full px-2 text-sm font-medium sm:px-3"
          onClick={onBack}
        >
          {backLabel}
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!canNext}
          className="h-12 min-w-0 max-w-full text-base font-semibold disabled:pointer-events-none disabled:opacity-50"
          onClick={onNext}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
