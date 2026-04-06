"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  ClientForm,
  clientFormValuesFromClient,
} from "@/features/clients/components/ClientForm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getClientById, saveClient } from "@/lib/store";
import type { Client } from "@/types";
import type { ClientFormValues } from "@/lib/utils/schemas";
import { t } from "@/lib/i18n";

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
      companyRegistrationNumber: values.companyRegistrationNumber.trim(),
      contactName: values.contactName?.trim() || undefined,
      email: values.email?.trim() || undefined,
      phone: values.phone?.trim() || undefined,
      city: values.city?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      status: "active",
      updatedAt: new Date().toISOString(),
    });
    router.push(`/clients/${clientId}`);
  }

  return (
    <PageContainer className="!flex !min-h-0 !flex-1 !flex-col !overflow-hidden !p-4 sm:!p-5 lg:!p-6">
      <div className="mx-auto flex h-[calc(100svh-4.5rem)] max-h-[calc(100svh-4.5rem)] w-full max-w-4xl min-h-0 flex-1 flex-col">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-0 shadow-sm rounded-xl">
          <CardHeader className="shrink-0 space-y-2 px-6 pb-4 pt-6 sm:px-8 sm:pb-5 sm:pt-7">
            <CardTitle className="text-xl tracking-tight">
              {t("clientEdit.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
              {t("clientEdit.subtitle")}
            </p>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-0 sm:px-8 sm:pb-8">
            <ClientForm
              mode="edit"
              compact
              warnOnUnsavedCancel
              defaultValues={clientFormValuesFromClient(current)}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/clients/${clientId}`)}
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
