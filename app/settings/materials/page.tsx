"use client";

import { Layers } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { MaterialsConfigurationPage } from "@/features/settings/materials/MaterialsConfigurationPage";

export default function SettingsMaterialsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Materials configuration"
        description="Define pricing, cutting behavior, and default stock sheets for the materials you quote most often."
        actions={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
            <Layers className="h-5 w-5 text-muted-foreground" />
          </div>
        }
      />
      <div className="max-w-5xl">
        <MaterialsConfigurationPage />
      </div>
    </PageContainer>
  );
}
