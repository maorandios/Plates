"use client";

import {
  ArrowLeftRight,
  FileCheck2,
  FileDown,
  FileText,
  LayoutGrid,
  PencilRuler,
  type LucideIcon,
  Wallet,
  Zap,
} from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { HAS_ACTIVE_SUBSCRIPTION } from "@/lib/billing/trial";
import { t } from "@/lib/i18n";

const PLAN_FEATURE_ICONS: LucideIcon[] = [
  Zap,
  ArrowLeftRight,
  PencilRuler,
  LayoutGrid,
  FileDown,
  FileText,
  FileCheck2,
];

const PLAN_FEATURE_KEYS = [
  "pages.settingsBill.planFeatureQuickQuote2min",
  "pages.settingsBill.planFeatureDxfExcelSync",
  "pages.settingsBill.planFeaturePlatesBent",
  "pages.settingsBill.planFeatureNestingReport",
  "pages.settingsBill.planFeatureDxfExportProd",
  "pages.settingsBill.planFeaturePdfProduction",
  "pages.settingsBill.planFeatureQuotePdfCustomer",
] as const;

const MONTHLY_NIS = 299;
const YEARLY_NIS = 3000;

function yearlySavingsPercentOverMonthlyX12(): number {
  const annualIfMonthly = MONTHLY_NIS * 12;
  if (annualIfMonthly <= 0) return 0;
  return Math.round(((annualIfMonthly - YEARLY_NIS) / annualIfMonthly) * 100);
}

function PlanPriceBlock({
  amountKey,
  id,
}: {
  amountKey: "pages.settingsBill.planMonthlyPriceAmount" | "pages.settingsBill.planYearlyPriceAmount";
  id: "monthly" | "yearly";
}) {
  return (
    <div className="mt-2.5 w-full sm:mt-3" dir="rtl">
      <div
        className="flex w-full max-sm:gap-1.5 items-baseline justify-start gap-2"
        id={`plan-price-amount-${id}`}
        aria-label={`${t(amountKey)} ₪, ${t("pages.settingsBill.planPriceBeforeVat")}`}
      >
        <span className="text-5xl font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-6xl">
          {t(amountKey)}
        </span>
        <span
          className="text-2xl font-bold tabular-nums text-foreground/90 sm:text-3xl"
          aria-hidden
        >
          ₪
        </span>
      </div>
      <p className="mt-0.5 w-full text-start text-xs font-medium text-muted-foreground/90 sm:mt-1 sm:text-sm">
        {t("pages.settingsBill.planPriceBeforeVat")}
      </p>
    </div>
  );
}

function PlanFeatureList() {
  return (
    <ul
      className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col justify-start gap-4 py-0 sm:gap-5"
      dir="rtl"
    >
      {PLAN_FEATURE_KEYS.map((key, i) => {
        const Icon = PLAN_FEATURE_ICONS[i]!;
        return (
          <li
            key={key}
            className="flex min-h-0 w-full min-w-0 items-start gap-4 text-sm leading-relaxed text-foreground/95 sm:gap-5 sm:text-base"
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-sm ring-1 ring-primary/10 sm:h-8 sm:w-8"
              aria-hidden
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 pe-0.5 text-foreground/90 sm:leading-relaxed">
              {t(key)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function BillAndUsagePage() {
  const showPricing = !HAS_ACTIVE_SUBSCRIPTION;
  const yearlySavingsPct = yearlySavingsPercentOverMonthlyX12();

  return (
    <PageContainer className="box-border !flex !h-full !min-h-0 !max-h-full !shrink-0 !flex-1 !flex-col !overflow-hidden !p-3 !pt-2 sm:!p-4">
      <div
        className="flex h-full min-h-0 w-full flex-1 flex-col"
        dir="rtl"
      >
        <div className="flex w-full shrink-0 justify-start">
          <div className="w-full min-w-0 max-w-5xl text-start">
            <PageHeader
              titleIcon={Wallet}
              title={t("pages.settingsBill.title")}
              description={t("pages.settingsBill.description")}
              className="mb-3 !gap-2 max-sm:mb-2 sm:[&_h1]:text-xl [&>div>div]:text-xs sm:[&>div>div]:text-sm [&_h1]:text-lg"
            />
          </div>
        </div>

        {showPricing ? (
          <div className="mt-0 flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center sm:mt-0.5">
            <div
              className="grid w-full min-h-[min(32rem,60svh)] max-w-5xl auto-rows-[1fr] gap-3 sm:grid-cols-2 sm:gap-4"
              role="list"
              aria-label={t("pages.settingsBill.title")}
            >
              <div
                role="listitem"
                className="relative flex min-h-0 min-w-0 max-w-md flex-1 flex-col justify-between overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-b from-card via-card to-muted/20 p-1 shadow-lg shadow-slate-900/5 ring-1 ring-inset ring-white/20 sm:max-w-none sm:min-h-[32rem] max-sm:max-h-[90svh] max-sm:min-h-0 max-sm:shadow-md dark:from-card dark:via-card dark:to-muted/10 dark:ring-white/5"
              >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 rounded-2xl bg-gradient-to-b from-white/30 to-transparent p-4 sm:gap-6 sm:p-6 dark:from-white/[0.04] dark:to-transparent">
                  <div className="w-full shrink-0 text-start">
                    <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                      {t("pages.settingsBill.planMonthlyName")}
                    </h2>
                    <p className="text-sm text-muted-foreground sm:text-sm">
                      {t("pages.settingsBill.planMonthlySubline")}
                    </p>
                    <PlanPriceBlock amountKey="pages.settingsBill.planMonthlyPriceAmount" id="monthly" />
                  </div>
                  <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable] pb-2">
                    <PlanFeatureList />
                  </div>
                </div>
                <div className="shrink-0 border-t border-border/40 bg-muted/5 px-4 pt-6 pb-4 sm:px-6 sm:pt-7 sm:pb-5">
                  <Button
                    type="button"
                    size="default"
                    className="h-11 w-full rounded-2xl text-base font-semibold shadow-md"
                    onClick={() => {
                      /* PayPal modal — monthly plan */
                    }}
                  >
                    {t("pages.settingsBill.createSubscription")}
                  </Button>
                </div>
              </div>

              <div
                role="listitem"
                className="relative flex min-h-0 min-w-0 max-w-md flex-1 flex-col justify-between overflow-hidden rounded-[10px] border border-border bg-gradient-to-b from-primary/[0.12] to-card/95 shadow-sm ring-2 ring-primary ring-offset-2 ring-offset-background sm:max-w-none sm:min-h-[32rem] max-sm:max-h-[90svh] max-sm:min-h-0"
              >
                <span
                  className="absolute end-2.5 top-2.5 z-20 inline-flex h-7 max-w-[calc(100%-1.25rem)] items-center justify-center whitespace-nowrap rounded-full border border-[#A0E6CF] bg-[#D6F5EB] px-2.5 text-[0.7rem] font-semibold leading-none text-[#1A867F] shadow-sm sm:top-3 sm:h-8 sm:max-w-[calc(100%-2.5rem)] sm:px-3 sm:py-0.5 sm:text-xs dark:border-[#A0E6CF] dark:bg-[#D6F5EB] dark:text-[#1A867F]"
                >
                  {t("pages.settingsBill.planSavingsYearly", {
                    percent: yearlySavingsPct,
                  })}
                </span>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden rounded-lg bg-gradient-to-b from-card/95 to-card/80 p-4 pt-9 sm:gap-6 sm:rounded-2xl sm:p-6 sm:pt-2">
                  <div className="w-full shrink-0 text-start">
                    <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                      {t("pages.settingsBill.planYearlyName")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t("pages.settingsBill.planYearlySubline")}
                    </p>
                    <PlanPriceBlock amountKey="pages.settingsBill.planYearlyPriceAmount" id="yearly" />
                  </div>
                  <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [scrollbar-gutter:stable] pb-2">
                    <PlanFeatureList />
                  </div>
                </div>
                <div className="shrink-0 border-t border-primary/15 bg-primary/[0.03] px-4 pt-6 pb-4 sm:px-6 sm:pt-7 sm:pb-5">
                  <Button
                    type="button"
                    size="default"
                    className="h-11 w-full rounded-2xl text-base font-semibold shadow-md"
                    onClick={() => {
                      /* PayPal modal — yearly plan */
                    }}
                  >
                    {t("pages.settingsBill.createSubscription")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
}
