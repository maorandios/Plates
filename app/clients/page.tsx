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

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const clients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return getClients()
      .filter(
        (c) =>
          !q ||
          c.fullName.toLowerCase().includes(q) ||
          c.shortCode.toLowerCase().includes(q)
      )
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
        title="Clients"
        description="Global directory — one permanent code per client, reused across every batch."
        actions={
          <Button asChild>
            <Link href="/clients/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              New client
            </Link>
          </Button>
        }
      />

      {getClients().length > 0 && (
        <div className="mb-4 max-w-sm">
          <Input
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {clients.length === 0 && getClients().length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description='Create your first client to reuse it across batches.'
          action={
            <Button asChild>
              <Link href="/clients/new">
                <PlusCircle className="h-4 w-4 mr-2" />
                New client
              </Link>
            </Button>
          }
        />
      ) : clients.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No clients match your search.
        </p>
      ) : (
        <ClientsTable
          clients={clients}
          metricsById={metricsById}
          onStatusToggled={refresh}
        />
      )}
    </PageContainer>
  );
}
