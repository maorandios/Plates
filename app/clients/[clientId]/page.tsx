"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ClientMetricsCards } from "@/features/clients/components/ClientMetricsCards";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClientById } from "@/lib/store";
import { getClientMetrics } from "@/lib/clients/metrics";
import { getClientBatchHistory } from "@/lib/clients/history";
import { CUTTING_METHOD_LABELS } from "@/types/production";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId =
    typeof params?.clientId === "string"
      ? params.clientId
      : Array.isArray(params?.clientId)
        ? params?.clientId[0] ?? ""
        : "";
  const client = useMemo(() => {
    if (!clientId) return undefined;
    return getClientById(clientId);
  }, [clientId]);

  useEffect(() => {
    if (clientId && !getClientById(clientId)) {
      router.replace("/clients");
    }
  }, [clientId, router]);

  const metrics = useMemo(
    () => (clientId ? getClientMetrics(clientId) : null),
    [clientId]
  );

  const history = useMemo(
    () => (clientId ? getClientBatchHistory(clientId) : []),
    [clientId]
  );

  if (!clientId || !client) return null;

  return (
    <PageContainer>
      <PageHeader
        title={client.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2 mt-1">
            <span className="font-mono text-sm font-bold tracking-widest bg-muted px-2 py-0.5 rounded">
              {client.shortCode}
            </span>
            <Badge variant={client.status === "active" ? "default" : "secondary"}>
              {client.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/clients">All clients</Link>
            </Button>
            <Button asChild>
              <Link href={`/clients/${clientId}/edit`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />

      <section className="space-y-3 mb-8">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          Client info
        </h2>
        <div className="rounded-xl border border-border bg-card p-4 text-sm space-y-2 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <InfoRow label="Contact" value={client.contactName} />
            <InfoRow label="Email" value={client.email} />
            <InfoRow label="Phone" value={client.phone} />
            <InfoRow
              label="Created"
              value={new Date(client.createdAt).toLocaleString()}
            />
          </div>
          {client.notes && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Notes
              </p>
              <p className="text-foreground whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </div>
      </section>

      {metrics && (
        <section className="space-y-3 mb-8">
          <h2 className="text-sm font-semibold text-foreground">Metrics</h2>
          <ClientMetricsCards metrics={metrics} />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Batch history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 border border-dashed rounded-xl text-center">
            This client is not linked to any batch yet. Add them from a batch’s Import step, then
            run Validation to populate part counts and weights.
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Batch</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Cutting</TableHead>
                  <TableHead className="text-right tabular-nums">Parts</TableHead>
                  <TableHead className="text-right tabular-nums">Qty</TableHead>
                  <TableHead className="text-right tabular-nums">Weight (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.batchId}>
                    <TableCell className="font-medium">
                      <span className="text-foreground">{row.batchName}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(row.batchCreatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {CUTTING_METHOD_LABELS[row.cuttingMethod]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInteger(row.partsCount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInteger(row.totalQuantity)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatDecimal(row.totalWeight, 1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </PageContainer>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
