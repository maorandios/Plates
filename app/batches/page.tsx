"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  PlusCircle,
  ArrowRight,
  Calendar,
  Users,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { BatchStatusBadge } from "@/components/shared/StatusBadge";
import { getBatches, getClientsByBatch } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import type { Batch } from "@/types";
import { CUTTING_METHOD_LABELS } from "@/types/production";
import { t } from "@/lib/i18n";

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const data = getBatches();
    setBatches(
      [...data].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    );
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title={t("pages.batches.title")}
        description={t("pages.batches.description")}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/batches/new" className="inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                {t("pages.batches.newJob")}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/quick-quote" className="inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                {t("pages.batches.quickQuote")}
              </Link>
            </Button>
          </div>
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("pages.batches.emptyTitle")}
          description={t("pages.batches.emptyDescription")}
          action={
            <div className="flex gap-2">
              <Button asChild variant="outline">
                <Link href="/batches/new" className="inline-flex items-center gap-2">
                  <PlusCircle className="h-4 w-4" />
                  {t("pages.batches.newJob")}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/quick-quote" className="inline-flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  {t("pages.batches.quickQuote")}
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function BatchCard({ batch }: { batch: Batch }) {
  const clients = getClientsByBatch(batch.id);

  return (
    <Link href={`/batches/${batch.id}`}>
      <Card className="shadow-none hover:shadow-md transition-all cursor-pointer group h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3 gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <BatchStatusBadge status={batch.status} />
              <Badge variant="outline" className="text-[10px] font-medium">
                {CUTTING_METHOD_LABELS[batch.cuttingMethod]}
              </Badge>
            </div>
          </div>

          <h3 className="font-semibold text-foreground mb-1 truncate">
            {batch.name}
          </h3>

          {batch.notes && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {batch.notes}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {clients.length}{" "}
              {clients.length !== 1
                ? t("dashboard.clientsCount")
                : t("dashboard.clientSingular")}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(batch.updatedAt).toLocaleDateString("he-IL")}
            </span>
            <ArrowRight className="h-3.5 w-3.5 ms-auto opacity-0 group-hover:opacity-100 transition-opacity text-foreground rtl:rotate-180" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
