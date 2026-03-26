"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { PlateBatchWorkspace } from "@/features/plate-builder/components/PlateBatchWorkspace";
import { getBatchById, getClientsByBatch } from "@/lib/store";

function PlateBuilderPageInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? (params.id[0] ?? "")
        : "";
  const defaultClientId = searchParams.get("clientId") ?? "";

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!batchId) {
      router.push("/batches");
      return;
    }
    if (!getBatchById(batchId)) {
      router.push("/batches");
      return;
    }
    setReady(true);
  }, [batchId, router]);

  if (!ready || !batchId) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading…</div>
    );
  }

  const clients = getClientsByBatch(batchId);
  const batch = getBatchById(batchId);

  return (
    <PageContainer className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <PageHeader
        title="Plate builder"
        description={
          batch
            ? `Batch: ${batch.name} — add plates, edit on the canvas, save DXF to this batch.`
            : "Build plates for this batch."
        }
      />
      <PlateBatchWorkspace
        batchId={batchId}
        clients={clients}
        defaultClientId={defaultClientId}
      />
    </PageContainer>
  );
}

export default function PlateBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <PlateBuilderPageInner />
    </Suspense>
  );
}
