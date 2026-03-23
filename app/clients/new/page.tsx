"use client";

import { useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ClientForm } from "@/features/clients/components/ClientForm";
import { createGlobalClient } from "@/lib/store";
import type { ClientFormValues } from "@/lib/utils/schemas";
import { Button } from "@/components/ui/button";

export default function NewClientPage() {
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  function handleSubmit(values: ClientFormValues) {
    if (createdId) return;
    const client = createGlobalClient({
      fullName: values.fullName,
      contactName: values.contactName || undefined,
      email: values.email?.trim() || undefined,
      phone: values.phone || undefined,
      notes: values.notes || undefined,
      status: values.status,
    });
    setCreatedCode(client.shortCode);
    setCreatedId(client.id);
  }

  return (
    <PageContainer>
      <PageHeader
        title="New client"
        description="A unique global client code is generated automatically when you save."
        actions={
          <Button variant="outline" asChild>
            <Link href="/clients">Back to list</Link>
          </Button>
        }
      />

      <ClientForm
        onSubmit={handleSubmit}
        generatedShortCode={createdCode ?? undefined}
        readOnly={!!createdId}
        submitLabel="Create client"
      />

      {createdId && (
        <div className="mt-8 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/clients/${createdId}`}>View client</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/clients">All clients</Link>
          </Button>
        </div>
      )}
    </PageContainer>
  );
}
