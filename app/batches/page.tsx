"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Layers,
  PlusCircle,
  ArrowRight,
  Calendar,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { BatchStatusBadge } from "@/components/shared/StatusBadge";
import { getBatches, getClientsByBatch } from "@/lib/store";
import type { Batch } from "@/types";

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
        title="Batches"
        description="Manage your plate cutting production batches"
        actions={
          <Button asChild>
            <Link href="/batches/new">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Batch
            </Link>
          </Button>
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No batches yet"
          description="Create your first batch to start organizing plate cutting jobs for your clients."
          action={
            <Button asChild>
              <Link href="/batches/new">
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Batch
              </Link>
            </Button>
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
      <Card className="border border-border shadow-none hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
              <Layers className="h-5 w-5 text-muted-foreground" />
            </div>
            <BatchStatusBadge status={batch.status} />
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
              {clients.length} client{clients.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(batch.updatedAt).toLocaleDateString()}
            </span>
            <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
