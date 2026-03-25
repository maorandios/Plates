"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PlateBuilderForm } from "@/features/plate-builder/components/PlateBuilderForm";
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

  return (
    <PlateBuilderForm
      batchId={batchId}
      clients={clients}
      defaultClientId={defaultClientId}
    />
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
