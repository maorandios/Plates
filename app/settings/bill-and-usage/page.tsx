"use client";

import { Receipt } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBatches, getClients } from "@/lib/store";

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
        title="Bill and usage"
        description="Subscription and usage overview for your workspace. Detailed billing will connect here as your plan rolls out."
        actions={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
            <Receipt className="h-5 w-5 text-muted-foreground" />
          </div>
        }
      />

      <div className="max-w-3xl space-y-6">
        <Card className="border border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Usage</CardTitle>
            <CardDescription>
              Snapshot from this browser (local data). Resets if you clear site data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <dt className="text-muted-foreground font-medium">Total quotes</dt>
                <dd className="text-2xl font-semibold tabular-nums mt-1">
                  {stats.totalQuotes}
                </dd>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <dt className="text-muted-foreground font-medium">Quotes this month</dt>
                <dd className="text-2xl font-semibold tabular-nums mt-1">
                  {stats.quotesThisMonth}
                </dd>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <dt className="text-muted-foreground font-medium">Clients</dt>
                <dd className="text-2xl font-semibold tabular-nums mt-1">
                  {stats.totalClients}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Billing</CardTitle>
            <CardDescription>
              Invoices, payment method, and plan details will appear here when billing is enabled
              for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You are on the <span className="font-medium text-foreground">Quotation MVP</span>{" "}
              experience. No charges are applied in this preview.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
