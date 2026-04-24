"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TRIAL_DAYS = 30;

/** When true, hide the pricing / PayPal card. Wire to billing when ready. */
const HAS_ACTIVE_SUBSCRIPTION = false;

export default function BillAndUsagePage() {
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null | "auth">(
    () => (isSupabaseConfigured() ? "auth" : null)
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.created_at) {
        setTrialDaysLeft(null);
        return;
      }
      const startMs = new Date(user.created_at).getTime();
      const endMs = startMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
      const left = Math.max(
        0,
        Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000))
      );
      setTrialDaysLeft(left);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (!u?.created_at) {
        setTrialDaysLeft(null);
        return;
      }
      const startMs = new Date(u.created_at).getTime();
      const endMs = startMs + TRIAL_DAYS * 24 * 60 * 60 * 1000;
      const left = Math.max(
        0,
        Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000))
      );
      setTrialDaysLeft(left);
    });
    return () => subscription.unsubscribe();
  }, []);

  const showPricing = !HAS_ACTIVE_SUBSCRIPTION;

  return (
    <PageContainer>
      <div className="w-full max-w-3xl text-start" dir="rtl">
        <PageHeader
          titleIcon={Wallet}
          title={t("pages.settingsBill.title")}
          description={t("pages.settingsBill.description")}
        />

        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet
                  className="h-5 w-5 shrink-0 text-primary"
                  strokeWidth={2}
                  aria-hidden
                />
                {t("pages.settingsBill.trialTitle")}
              </CardTitle>
              <CardDescription>
                {t("pages.settingsBill.trialDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trialDaysLeft === "auth" ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  …
                </p>
              ) : trialDaysLeft === null ? (
                <p className="text-sm text-muted-foreground">
                  {t("pages.settingsBill.trialLoginRequired")}
                </p>
              ) : (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-6 text-center">
                  <p
                    className={cn(
                      "text-4xl font-bold tabular-nums text-primary",
                      trialDaysLeft === 0 && "text-destructive"
                    )}
                  >
                    {trialDaysLeft > 0 ? trialDaysLeft : 0}
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {trialDaysLeft === 0
                      ? t("pages.settingsBill.trialEnded")
                      : trialDaysLeft === 1
                        ? t("pages.settingsBill.trialLastDay")
                        : t("pages.settingsBill.trialOutOf30")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {showPricing ? (
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">
                  {t("pages.settingsBill.pricingTitle")}
                </CardTitle>
                <CardDescription>
                  {t("pages.settingsBill.pricingDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/20 px-4 py-5">
                  <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start sm:gap-6">
                    <div className="min-w-0 space-y-3 text-start">
                      <p className="font-semibold text-foreground">
                        {t("pages.settingsBill.pricingPlanName")}
                      </p>
                      <p className="text-lg font-semibold text-foreground">
                        {t("pages.settingsBill.pricingPriceBeforeTax")}
                      </p>
                      <ul
                        className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground"
                        dir="rtl"
                      >
                        <li>{t("pages.settingsBill.pricingUnlimitedYear")}</li>
                        <li>{t("pages.settingsBill.pricingIncludesNote1")}</li>
                        <li>{t("pages.settingsBill.pricingIncludesNote2")}</li>
                      </ul>
                    </div>
                    <Button
                      type="button"
                      className="h-11 bg-[#0070ba] text-base font-semibold text-white hover:bg-[#005ea6] sm:min-w-[220px]"
                      onClick={() => {
                        /* PayPal integration TBD */
                      }}
                    >
                      {t("pages.settingsBill.paypalButton")}
                    </Button>
                  </div>
                </div>
                <p className="text-pretty text-xs text-muted-foreground">
                  {t("pages.settingsBill.paypalDisclaimer")}
                </p>
                <p className="text-pretty text-xs text-muted-foreground">
                  {t("pages.settingsBill.mvpNote")}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </PageContainer>
  );
}
