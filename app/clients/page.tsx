"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Users, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ClientsTable } from "@/features/clients/components/ClientsTable";
import { getClients } from "@/lib/store";
import { getClientMetrics } from "@/lib/clients/metrics";
import { t } from "@/lib/i18n";
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

  const clients = useMemo(() => {
    return getClients()
      .filter((c) => clientMatchesSearch(c, search))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [search, tick]);

  const metricsById = useMemo(() => {
    const m: Record<string, ReturnType<typeof getClientMetrics>> = {};
    for (const c of getClients()) {
      m[c.id] = getClientMetrics(c.id);
    }
    return m;
  }, [tick]);

  return (
    <PageContainer>
      <PageHeader
        titleIcon={Users}
        title={t("pages.clients.title")}
        description={t("pages.clients.description")}
        actions={
          <Button asChild>
            <Link href="/clients/new" className="inline-flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              {t("pages.clients.newClient")}
            </Link>
          </Button>
        }
      />

      {getClients().length > 0 && (
        <div className="mb-4 max-w-sm">
          <Input
            placeholder={t("pages.clients.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {clients.length === 0 && getClients().length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("pages.clients.emptyTitle")}
          description={t("pages.clients.emptyDescription")}
          action={
            <Button asChild>
              <Link href="/clients/new" className="inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                {t("pages.clients.newClient")}
              </Link>
            </Button>
          }
        />
      ) : clients.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
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
