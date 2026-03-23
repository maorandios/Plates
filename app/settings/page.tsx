"use client";

import { Settings } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { UnitSystemCard } from "@/features/settings/components/UnitSystemCard";
import { CuttingProfilesSettings } from "@/features/settings/components/CuttingProfilesSettings";

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Preferences"
        description="Global defaults for your workspace: units and cutting-method profiles for nesting."
        actions={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
        }
      />

      <div className="max-w-3xl space-y-8">
        <UnitSystemCard />
        <CuttingProfilesSettings />
      </div>
    </PageContainer>
  );
}
