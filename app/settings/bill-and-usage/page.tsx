"use client";

import { Receipt } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBatches, getClients } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function BillAndUsagePage() {
  const batches = getBatches();
  const clients = getClients();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const quotesThisMonth = batches.filter((b) => {
    const d = new Date(b.updatedAt);
    return d.getFullYear() === y && d.getMonth() === m;
  }).length;
  const stats = {
    totalQuotes: batches.length,
    quotesThisMonth,
    totalClients: clients.length,
  };

  return (
    <PageContainer>
      <PageHeader
        title={t("pages.settingsBill.title")}
        description={t("pages.settingsBill.description")}
        actions={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
            <Receipt className="h-5 w-5 text-muted-foreground" />
          </div>
        }
      />

      <div className="max-w-3xl space-y-6">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">{t("pages.settingsBill.usageTitle")}</CardTitle>
            <CardDescription>
              {t("pages.settingsBill.usageDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg bg-muted/30 px-4 py-3">
                <dt className="text-muted-foreground font-medium">{t("pages.settingsBill.statTotalQuotes")}</dt>
                <dd className="text-2xl font-semibold tabular-nums mt-1">
                  {stats.totalQuotes}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/30 px-4 py-3">
                <dt className="text-muted-foreground font-medium">{t("pages.settingsBill.statQuotesMonth")}</dt>
                <dd className="text-2xl font-semibold tabular-nums mt-1">
                  {stats.quotesThisMonth}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/30 px-4 py-3">
                <dt className="text-muted-foreground font-medium">{t("pages.settingsBill.statClients")}</dt>
                <dd className="text-2xl font-semibold tabular-nums mt-1">
                  {stats.totalClients}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">{t("pages.settingsBill.billingTitle")}</CardTitle>
            <CardDescription>
              {t("pages.settingsBill.billingDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("pages.settingsBill.mvpNote")}
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
