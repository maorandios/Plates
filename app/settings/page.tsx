"use client";

import { Settings } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { UnitSystemCard } from "@/features/settings/components/UnitSystemCard";
import { PurchasedSheetSizesCard } from "@/features/settings/components/PurchasedSheetSizesCard";
import { CuttingProfilesSettings } from "@/features/settings/components/CuttingProfilesSettings";

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Preferences"
        description="Global defaults: units, purchased sheet sizes for stock pickers, and cutting-method profiles for nesting."
        actions={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
        }
      />

      <div className="max-w-3xl space-y-8">
        <UnitSystemCard />
        <PurchasedSheetSizesCard />
        <CuttingProfilesSettings />
      </div>
    </PageContainer>
  );
}
