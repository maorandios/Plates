"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, PlusCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ClientsTable } from "@/features/clients/components/ClientsTable";
import { getClients } from "@/lib/store";
import { getClientMetrics } from "@/lib/clients/metrics";
import { subscribeQuotesListChanged } from "@/lib/quotes/quoteList";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

function clientMatchesSearch(c: Client, raw: string): boolean {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  if (c.fullName.toLowerCase().includes(q)) return true;
  if (c.shortCode.toLowerCase().includes(q)) return true;
  const reg = (c.companyRegistrationNumber ?? "").toLowerCase();
  if (reg.includes(q)) return true;
  const qDigits = raw.replace(/\D/g, "");
  const regDigits = (c.companyRegistrationNumber ?? "").replace(/\D/g, "");
  if (qDigits.length > 0 && regDigits.includes(qDigits)) return true;
  return false;
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(
    () => subscribeQuotesListChanged(() => setTick((n) => n + 1)),
    []
  );

  const allClients = useMemo(() => getClients(), [tick]);
  const hasAnyClients = allClients.length > 0;

  const clients = useMemo(() => {
    return allClients
      .filter((c) => clientMatchesSearch(c, search))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [search, allClients]);

  const metricsById = useMemo(() => {
    const m: Record<string, ReturnType<typeof getClientMetrics>> = {};
    for (const c of allClients) {
      m[c.id] = getClientMetrics(c.id);
    }
    return m;
  }, [allClients]);

  return (
    <PageContainer>
      <PageHeader
        titleIcon={Users}
        title={t("pages.clients.title")}
        description={t("pages.clients.description")}
        actions={
          hasAnyClients ? (
            <Button asChild>
              <Link href="/clients/new" className="inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                {t("pages.clients.newClient")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {hasAnyClients && (
        <div className="mb-4 max-w-sm">
          <Input
            placeholder={t("pages.clients.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {!hasAnyClients ? (
        <div
          className="flex min-h-[min(50vh,28rem)] flex-1 flex-col items-center justify-center px-2 py-6 sm:px-4"
          dir="rtl"
        >
          <Link
            href="/clients/new"
            aria-label={t("pages.clients.newClient")}
            className={cn(
              "group flex min-h-[min(20rem,55vh)] w-full max-w-md flex-col items-center justify-center gap-0 rounded-2xl border-2 border-dashed border-border bg-muted/25 p-8 text-center shadow-sm transition-all",
              "hover:border-primary/45 hover:bg-primary/[0.05]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <div
              className="mb-5 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/[0.16]"
              aria-hidden
            >
              <Plus className="h-8 w-8" strokeWidth={2.25} />
            </div>
            <h2 className="w-full text-balance text-center text-lg font-semibold text-foreground sm:text-xl">
              {t("pages.clients.emptyTitle")}
            </h2>
            <p className="mt-2 w-full text-pretty text-center text-sm text-muted-foreground sm:text-base">
              {t("pages.clients.emptyDescription")}
            </p>
            <div className="mt-6 flex w-full items-center justify-center">
              <span className="pointer-events-none inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm">
                <PlusCircle className="h-4 w-4 shrink-0" aria-hidden />
                {t("pages.clients.newClient")}
              </span>
            </div>
          </Link>
        </div>
      ) : clients.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("pages.clients.noSearchResults")}
        </p>
      ) : (
        <ClientsTable
          clients={clients}
          metricsById={metricsById}
          onChanged={refresh}
        />
      )}
    </PageContainer>
  );
}
