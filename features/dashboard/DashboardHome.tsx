"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Layers } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { t } from "@/lib/i18n";
import { getAppPreferences } from "@/lib/settings/appPreferences";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { useOrgBootstrap } from "@/components/providers/OrgBootstrapProvider";
import { cn } from "@/lib/utils";

/** Shared card shell — quote-only variant adds the outer primary (purple) stroke. */
const cardShell =
  "group flex w-full min-h-[22.1rem] flex-col items-center justify-center gap-4 rounded-2xl border bg-background p-7 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[24.7rem] sm:gap-5 sm:p-8 lg:min-h-[26rem]";

const projectCard = `${cardShell} border-border/70 hover:border-border hover:bg-muted/25`;
const quoteCard = `${cardShell} border-2 border-primary/45 hover:border-primary/60 hover:bg-muted/15`;

/** 1.25× the prior 14/16 (3.5/4 rem) — matches list-screen icons (FileText / Layers) at larger size */
const iconBoxClass =
  "flex h-[4.375rem] w-[4.375rem] shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground sm:h-20 sm:w-20";
const cardIconClass = "h-[2.1875rem] w-[2.1875rem] sm:h-10 sm:w-10";

const titleTextClass =
  "text-balance text-base font-semibold leading-snug text-foreground sm:text-lg";
const hintTextClass =
  "max-w-[20rem] text-balance text-xs font-normal leading-relaxed text-muted-foreground sm:text-sm";
const cardTextBlock = "flex w-full min-w-0 flex-col items-center gap-2 sm:gap-2.5";

export function DashboardHome() {
  const { session } = useOrgBootstrap();
  const [prefTick, setPrefTick] = useState(0);

  useEffect(() => {
    const onPrefs = () => setPrefTick((n) => n + 1);
    if (typeof window === "undefined") return;
    window.addEventListener("plate-app-preferences-changed", onPrefs);
    return () => window.removeEventListener("plate-app-preferences-changed", onPrefs);
  }, []);

  const companyName = useMemo(() => {
    if (isSupabaseConfigured() && session?.ok) {
      const n = session.orgName?.trim();
      if (n) return n;
    }
    return getAppPreferences().companyName?.trim() ?? "";
  }, [session, prefTick]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageContainer
        embedded
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 p-6 lg:gap-10 lg:p-8"
      >
        <div className="flex max-w-2xl flex-col items-center text-center">
          {companyName ? (
            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {companyName}
            </h1>
          ) : (
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("dashboard.welcomeTitle")}
            </h1>
          )}
        </div>

        <div className="grid w-full max-w-4xl grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2 lg:items-stretch">
          <div className="flex min-h-0 w-full max-w-md justify-self-center lg:max-w-none lg:justify-self-end">
            <Link href="/quick-quote" className={cn(quoteCard, "w-full")}>
              <div className={iconBoxClass}>
                <FileText
                  className={cardIconClass}
                  strokeWidth={1.75}
                  aria-hidden
                />
              </div>
              <div className={cardTextBlock}>
                <span className={titleTextClass}>{t("dashboard.cardNewQuote")}</span>
                <span className={hintTextClass}>{t("dashboard.cardNewQuoteHint")}</span>
              </div>
            </Link>
          </div>

          <div className="flex w-full max-w-md justify-self-center lg:max-w-none lg:justify-self-start">
            <Link href="/plate-project" className={cn(projectCard, "w-full")}>
              <div className={iconBoxClass}>
                <Layers
                  className={cardIconClass}
                  strokeWidth={1.75}
                  aria-hidden
                />
              </div>
              <div className={cardTextBlock}>
                <span className={titleTextClass}>{t("dashboard.cardNewProject")}</span>
                <span className={hintTextClass}>{t("dashboard.cardNewProjectHint")}</span>
              </div>
            </Link>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
