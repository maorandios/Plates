"use client";

import { UserCircle } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { AccountSettingsCard } from "@/features/settings/components/AccountSettingsCard";

export default function SettingsAccountPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Account settings"
        description="Company details used on quotations and PDF exports."
        actions={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted shrink-0">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          </div>
        }
      />
      <div className="max-w-3xl">
        <AccountSettingsCard />
      </div>
    </PageContainer>
  );
}
