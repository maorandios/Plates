"use client";

import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { ClientForm } from "@/features/clients/components/ClientForm";
import { createGlobalClient } from "@/lib/store";
import type { ClientFormValues } from "@/lib/utils/schemas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { t } from "@/lib/i18n";

export default function NewClientPage() {
  const router = useRouter();

  function handleSubmit(values: ClientFormValues) {
    const client = createGlobalClient({
      fullName: values.fullName,
      companyRegistrationNumber: values.companyRegistrationNumber.trim(),
      contactName: values.contactName || undefined,
      email: values.email?.trim() || undefined,
      phone: values.phone || undefined,
      city: values.city?.trim() || undefined,
      notes: values.notes || undefined,
      status: values.status,
    });
    router.push(`/clients/${client.id}`);
  }

  return (
    <PageContainer className="!flex !min-h-0 !flex-1 !flex-col !overflow-hidden !p-4 sm:!p-5 lg:!p-6">
      <div className="mx-auto flex h-[calc(100svh-4.5rem)] max-h-[calc(100svh-4.5rem)] w-full max-w-4xl min-h-0 flex-1 flex-col">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-0 shadow-sm rounded-xl">
          <CardHeader className="shrink-0 space-y-2 px-6 pb-4 pt-6 sm:px-8 sm:pb-5 sm:pt-7">
            <CardTitle className="text-xl tracking-tight">
              {t("clientNew.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">
              {t("clientNew.subtitle")}
            </p>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6 pt-0 sm:px-8 sm:pb-8">
            <ClientForm
              mode="create"
              compact
              onSubmit={handleSubmit}
              onCancel={() => router.push("/clients")}
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
