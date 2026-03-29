"use client";

import { Ruler } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { UnitSystemCard } from "@/features/settings/components/UnitSystemCard";

export default function SettingsUnitsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Unit system"
        description="How lengths, areas, and weights are shown across quotes and parts."
        actions={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
            <Ruler className="h-5 w-5 text-muted-foreground" />
          </div>
        }
      />
      <div className="max-w-3xl">
        <UnitSystemCard />
      </div>
    </PageContainer>
  );
}
