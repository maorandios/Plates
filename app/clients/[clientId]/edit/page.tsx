"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  ClientForm,
  clientFormValuesFromClient,
} from "@/features/clients/components/ClientForm";
import { Button } from "@/components/ui/button";
import { getClientById, saveClient } from "@/lib/store";
import type { Client } from "@/types";
import type { ClientFormValues } from "@/lib/utils/schemas";

export default function EditClientPage() {
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

  if (!clientId || !client) return null;
  const current: Client = client;

  function handleSubmit(values: ClientFormValues) {
    saveClient({
      ...current,
      fullName: values.fullName.trim(),
      contactName: values.contactName?.trim() || undefined,
      email: values.email?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      status: values.status,
      updatedAt: new Date().toISOString(),
    });
    router.push(`/clients/${clientId}`);
  }

  return (
    <PageContainer>
      <PageHeader
        title="Edit client"
        description={
          <span className="flex items-center gap-2">
            Code{" "}
            <span className="font-mono font-bold tracking-widest">{current.shortCode}</span>
            <span className="text-muted-foreground">(permanent)</span>
          </span>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={`/clients/${clientId}`}>Cancel</Link>
          </Button>
        }
      />

      <ClientForm
        defaultValues={clientFormValuesFromClient(current)}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/clients/${clientId}`)}
        submitLabel="Save changes"
      />
    </PageContainer>
  );
}
