"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers, Users, FileText, ArrowRight, PlusCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { BatchStatusBadge } from "@/components/shared/StatusBadge";
import { getBatches, getClients, getFiles } from "@/lib/store";
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
      label: "Total Batches",
      value: stats.totalBatches,
      icon: Layers,
      description: "All cutting batches",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Active Batches",
      value: stats.activeBatches,
      icon: TrendingUp,
      description: "Currently in progress",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Total Clients",
      value: stats.totalClients,
      icon: Users,
      description: "Across all batches",
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Uploaded Files",
      value: stats.totalFiles,
      icon: FileText,
      description: "DXF + Excel files",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Overview of your plate cutting operations"
        actions={
          <Button asChild>
            <Link href="/batches/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Batch
            </Link>
          </Button>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Card key={card.label} className="border border-border shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">
                    {card.label}
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {card.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.description}
                  </p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Batches */}
      <Card className="border border-border shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Recent Batches</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/batches" className="flex items-center gap-1 text-sm">
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {recentBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <Layers className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">No batches yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Create your first batch to get started
              </p>
              <Button size="sm" asChild>
                <Link href="/batches/new">
                  <PlusCircle className="h-3.5 w-3.5 mr-2" />
                  Create Batch
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentBatches.map((batch) => (
                <Link
                  key={batch.id}
                  href={`/batches/${batch.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {batch.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {batch.clientIds.length} client
                        {batch.clientIds.length !== 1 ? "s" : ""} ·{" "}
                        {new Date(batch.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <BatchStatusBadge status={batch.status} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
