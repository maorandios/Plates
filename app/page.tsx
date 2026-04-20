"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  FolderKanban,
  Layers,
  LayoutGrid,
  Package,
  Weight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  getPlateProjectsList,
  subscribePlateProjectsListChanged,
} from "@/lib/projects/plateProjectList";
import { getQuotesList, subscribeQuotesListChanged } from "@/lib/quotes/quoteList";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { t } from "@/lib/i18n";

/** Matches {@link PartBreakdownTable} `SummaryMetricCard` / method-phase summary strip. */
const METRIC_VALUE_ROW =
  "inline-flex flex-wrap items-baseline justify-center gap-x-1 font-semibold tabular-nums text-[#6A23F7] text-[1.875rem] leading-none tracking-tight sm:text-[2.0625rem]";

const METRIC_UNIT_CLASS =
  "font-semibold tabular-nums text-muted-foreground text-[0.72em] leading-none";

function DashboardSummaryMetricCard({
  icon: Icon,
  title,
  valueLine,
}: {
  icon: LucideIcon;
  title: string;
  valueLine: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[8rem] min-w-0 flex-1 flex-col items-center justify-center gap-2 px-3 py-4 text-center sm:min-h-[9.5rem] sm:px-4 sm:py-5">
      <Icon
        className="h-5 w-5 shrink-0 text-muted-foreground/70 sm:h-6 sm:w-6"
        strokeWidth={1.75}
        aria-hidden
      />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className={METRIC_VALUE_ROW}>{valueLine}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const u1 = subscribePlateProjectsListChanged(() => setTick((n) => n + 1));
    const u2 = subscribeQuotesListChanged(() => setTick((n) => n + 1));
    return () => {
      u1();
      u2();
    };
  }, []);

  const projectStats = useMemo(() => {
    if (!mounted) {
      return { count: 0, plateQty: 0, weightKg: 0, areaM2: 0 };
    }
    const projects = getPlateProjectsList();
    const count = projects.length;
    const plateQty = projects.reduce((s, p) => s + (p.totalItemQty ?? 0), 0);
    const weightKg = projects.reduce((s, p) => s + (p.totalWeightKg ?? 0), 0);
    const areaM2 = projects.reduce((s, p) => s + (p.totalAreaM2 ?? 0), 0);
    return { count, plateQty, weightKg, areaM2 };
  }, [tick, mounted]);

  const quoteStats = useMemo(() => {
    if (!mounted) {
      return { count: 0, approved: 0, weightKg: 0, areaM2: 0 };
    }
    const quotes = getQuotesList();
    const count = quotes.length;
    const approved = quotes.filter((q) => q.status === "complete").length;
    const weightKg = quotes.reduce((s, q) => s + (q.totalWeightKg ?? 0), 0);
    const areaM2 = quotes.reduce((s, q) => s + (q.totalAreaM2 ?? 0), 0);
    return { count, approved, weightKg, areaM2 };
  }, [tick, mounted]);

  return (
    <div className="flex max-h-[calc(100svh-3.5rem)] min-h-0 flex-1 flex-col overflow-hidden">
      <PageContainer
        embedded
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6 lg:p-8"
      >
        <h1 className="shrink-0 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {t("dashboard.welcomeTitle")}
        </h1>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
          {/* RTL: first column = visual right = projects */}
          <Card className="flex min-h-0 flex-1 flex-col border border-border bg-card/80 shadow-none">
            <div className="shrink-0 border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                {t("dashboard.sectionProjects")}
              </h2>
            </div>
            <div className="shrink-0 px-4 pb-3 pt-1">
              <div className="overflow-hidden rounded-md border border-border bg-white/[0.08]">
                <div className="grid min-w-0 grid-cols-4 gap-px">
                  <div className="min-w-0 bg-card">
                    <DashboardSummaryMetricCard
                      icon={Layers}
                      title={t("dashboard.metricTotalProjects")}
                      valueLine={<>{formatInteger(projectStats.count)}</>}
                    />
                  </div>
                  <div className="min-w-0 bg-card">
                    <DashboardSummaryMetricCard
                      icon={Package}
                      title={t("dashboard.metricPlateQty")}
                      valueLine={<>{formatInteger(Math.round(projectStats.plateQty))}</>}
                    />
                  </div>
                  <div className="min-w-0 bg-card">
                    <DashboardSummaryMetricCard
                      icon={LayoutGrid}
                      title={t("dashboard.metricTotalArea")}
                      valueLine={
                        <>
                          <span>{formatDecimal(projectStats.areaM2, 2)}</span>
                          <span className={METRIC_UNIT_CLASS}>
                            {t("methodMetrics.unitM2")}
                          </span>
                        </>
                      }
                    />
                  </div>
                  <div className="min-w-0 bg-card">
                    <DashboardSummaryMetricCard
                      icon={Weight}
                      title={t("dashboard.metricTotalWeight")}
                      valueLine={
                        <>
                          <span>{formatDecimal(projectStats.weightKg, 1)}</span>
                          <span className={METRIC_UNIT_CLASS}>
                            {t("methodMetrics.unitKg")}
                          </span>
                        </>
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-end p-4 pt-0">
              <Link
                href="/plate-project"
                className="group flex min-h-[5.5rem] w-full flex-1 items-center justify-center rounded-xl border border-border bg-white/[0.04] px-4 py-5 text-center transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-0 sm:py-8"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary sm:h-14 sm:w-14 sm:rounded-2xl">
                    <FolderKanban
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </div>
                  <span className="text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
                    {t("dashboard.cardNewProject")}
                  </span>
                </div>
              </Link>
            </div>
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col border border-border bg-card/80 shadow-none">
            <div className="shrink-0 border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                {t("dashboard.sectionQuotes")}
              </h2>
            </div>
            <div className="shrink-0 px-4 pb-3 pt-1">
              <div className="overflow-hidden rounded-md border border-border bg-white/[0.08]">
                <div className="grid min-w-0 grid-cols-4 gap-px">
                  <div className="min-w-0 bg-card">
                    <DashboardSummaryMetricCard
                      icon={Layers}
                      title={t("dashboard.metricTotalQuotes")}
                      valueLine={<>{formatInteger(quoteStats.count)}</>}
                    />
                  </div>
                  <div className="min-w-0 bg-card">
                    <DashboardSummaryMetricCard
                      icon={Package}
                      title={t("dashboard.metricApprovedQuotes")}
                      valueLine={<>{formatInteger(quoteStats.approved)}</>}
                    />
                  </div>
                  <div className="min-w-0 bg-card">
                    <DashboardSummaryMetricCard
                      icon={LayoutGrid}
                      title={t("dashboard.metricTotalArea")}
                      valueLine={
                        <>
                          <span>{formatDecimal(quoteStats.areaM2, 2)}</span>
                          <span className={METRIC_UNIT_CLASS}>
                            {t("methodMetrics.unitM2")}
                          </span>
                        </>
                      }
                    />
                  </div>
                  <div className="min-w-0 bg-card">
                    <DashboardSummaryMetricCard
                      icon={Weight}
                      title={t("dashboard.metricTotalWeight")}
                      valueLine={
                        <>
                          <span>{formatDecimal(quoteStats.weightKg, 1)}</span>
                          <span className={METRIC_UNIT_CLASS}>
                            {t("methodMetrics.unitKg")}
                          </span>
                        </>
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-end p-4 pt-0">
              <Link
                href="/quick-quote"
                className="group flex min-h-[5.5rem] w-full flex-1 items-center justify-center rounded-xl border border-border bg-white/[0.04] px-4 py-5 text-center transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-0 sm:py-8"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 sm:h-14 sm:w-14 sm:rounded-2xl">
                    <Calculator
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </div>
                  <span className="text-base font-semibold leading-snug tracking-tight text-foreground sm:text-lg">
                    {t("dashboard.cardNewQuote")}
                  </span>
                </div>
              </Link>
            </div>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
}
