"use client";

import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import type { ClientMetrics } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, Package, Hash, Weight, Calendar, ScanSearch } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function ClientMetricsCards({ metrics }: { metrics: ClientMetrics }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <MetricCard
        title="Batches"
        value={formatInteger(metrics.totalBatches)}
        icon={Layers}
      />
      <MetricCard
        title="Parts"
        value={formatInteger(metrics.totalParts)}
        icon={Package}
      />
      <MetricCard
        title="Quantity"
        value={formatInteger(metrics.totalQuantity)}
        icon={Hash}
      />
      <MetricCard
        title="Weight (kg)"
        value={formatDecimal(metrics.totalWeight, 1)}
        icon={Weight}
      />
      <MetricCard
        title="Area (m²)"
        value={formatDecimal(metrics.totalAreaM2, 2)}
        icon={ScanSearch}
      />
      <MetricCard
        title="Last batch"
        value={
          metrics.lastBatchDate
            ? new Date(metrics.lastBatchDate).toLocaleDateString()
            : "—"
        }
        icon={Calendar}
        className="col-span-2 lg:col-span-1 xl:col-span-1"
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={`shadow-none ${className ?? ""}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className="text-xl font-bold tabular-nums text-foreground mt-0.5 leading-tight">
              {value}
            </p>
          </div>
          <Icon className="h-4 w-4 text-muted-foreground/50 shrink-0" strokeWidth={1.75} />
        </div>
      </CardContent>
    </Card>
  );
}
