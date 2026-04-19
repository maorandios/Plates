"use client";

import Link from "next/link";
import { Calculator, FolderKanban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { t } from "@/lib/i18n";

export default function DashboardPage() {
  return (
    <PageContainer className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {t("dashboard.welcomeTitle")}
      </h1>

      <div className="flex flex-row gap-3 sm:gap-4">
        <Link
          href="/plate-project"
          className="group flex min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
        >
          <Card className="flex w-full flex-col items-center justify-center gap-3 border border-white/[0.08] bg-card/80 px-4 py-6 text-center shadow-none transition-colors hover:bg-white/[0.06] sm:px-6 sm:py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary sm:h-14 sm:w-14 sm:rounded-2xl">
              <FolderKanban className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.75} aria-hidden />
            </div>
            <span className="text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
              {t("dashboard.cardNewProject")}
            </span>
          </Card>
        </Link>

        <Link
          href="/quick-quote"
          className="group flex min-w-0 flex-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
        >
          <Card className="flex w-full flex-col items-center justify-center gap-3 border border-white/[0.08] bg-card/80 px-4 py-6 text-center shadow-none transition-colors hover:bg-white/[0.06] sm:px-6 sm:py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 sm:h-14 sm:w-14 sm:rounded-2xl">
              <Calculator className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.75} aria-hidden />
            </div>
            <span className="text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
              {t("dashboard.cardNewQuote")}
            </span>
          </Card>
        </Link>
      </div>
    </PageContainer>
  );
}
