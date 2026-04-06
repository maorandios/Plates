"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  ClientForm,
  clientFormValuesFromClient,
} from "@/features/clients/components/ClientForm";
import { Button } from "@/components/ui/button";
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
      status: values.status,
      updatedAt: new Date().toISOString(),
    });
    router.push(`/clients/${clientId}`);
  }

  return (
    <PageContainer>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" asChild>
            <Link href={`/clients/${clientId}`}>
              {t("clientEdit.cancelBack")}
            </Link>
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-xl tracking-tight">
              {t("clientEdit.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("clientEdit.subtitle", { code: current.shortCode })}
            </p>
          </CardHeader>
          <CardContent>
            <ClientForm
              mode="edit"
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
