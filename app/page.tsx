"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Users,
  ArrowLeft,
  TrendingUp,
  Calculator,
  FolderKanban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { BatchStatusBadge } from "@/components/shared/StatusBadge";
import { formatInteger } from "@/lib/formatNumbers";
import { getBatches, getClients, getFiles } from "@/lib/store";
import { t } from "@/lib/i18n";
import type { Batch } from "@/types";

interface Stats {
  totalBatches: number;
  activeBatches: number;
  totalClients: number;
  totalFiles: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalBatches: 0,
    activeBatches: 0,
    totalClients: 0,
    totalFiles: 0,
  });
  const [recentBatches, setRecentBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const batches = getBatches();
    const clients = getClients();
    const files = getFiles();

    setStats({
      totalBatches: batches.length,
      activeBatches: batches.filter((b) => b.status === "active").length,
      totalClients: clients.length,
      totalFiles: files.length,
    });

    setRecentBatches(
      [...batches]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5)
    );
  }, []);

  const statCards = [
    {
      labelKey: "dashboard.stats.totalQuotes" as const,
      value: stats.totalBatches,
      icon: FileText,
      descriptionKey: "dashboard.stats.totalQuotesDesc" as const,
      color: "text-sky-400",
      bg: "bg-sky-500/15",
    },
    {
      labelKey: "dashboard.stats.activeQuotes" as const,
      value: stats.activeBatches,
      icon: TrendingUp,
      descriptionKey: "dashboard.stats.activeQuotesDesc" as const,
      color: "text-primary",
      bg: "bg-primary/15",
    },
    {
      labelKey: "dashboard.stats.clients" as const,
      value: stats.totalClients,
      icon: Users,
      descriptionKey: "dashboard.stats.clientsDesc" as const,
      color: "text-violet-400",
      bg: "bg-violet-500/15",
    },
    {
      labelKey: "dashboard.stats.newQuoteCta" as const,
      value: "←",
      icon: Calculator,
      descriptionKey: "dashboard.stats.newQuoteDesc" as const,
      color: "text-amber-400",
      bg: "bg-amber-500/15",
      href: "/quick-quote",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/plate-project" className="inline-flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                {t("dashboard.newPlateProject")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/quick-quote" className="inline-flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                {t("dashboard.newQuote")}
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const content = (
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    {t(card.labelKey)}
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {typeof card.value === "number" ? formatInteger(card.value) : card.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(card.descriptionKey)}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          );
          if ("href" in card && card.href) {
            return (
              <Link key={card.labelKey} href={card.href}>
                <Card className="border-0 shadow-none transition-all duration-150 hover:shadow-sm cursor-pointer">
                  {content}
                </Card>
              </Link>
            );
          }
          return (
            <Card key={card.labelKey} className="border-0 shadow-none">
              {content}
            </Card>
          );
        })}
      </div>

      {/* Recent Quotes */}
      <Card className="border-0 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">{t("dashboard.recentQuotes")}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/quick-quote" className="flex items-center gap-1 text-sm">
              {t("dashboard.openQuote")}
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {recentBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">{t("dashboard.noQuotes")}</p>
              <p className="text-xs text-muted-foreground mb-4">{t("dashboard.noQuotesHint")}</p>
              <Button size="sm" asChild>
                <Link href="/quick-quote" className="inline-flex items-center gap-2">
                  <Calculator className="h-3.5 w-3.5" />
                  {t("dashboard.newQuote")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {recentBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="flex items-center justify-between px-6 py-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {batch.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.clientIds.length}{" "}
                        {batch.clientIds.length !== 1
                          ? t("dashboard.clientsCount")
                          : t("dashboard.clientSingular")}{" "}
                        · {new Date(batch.updatedAt).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <BatchStatusBadge status={batch.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
