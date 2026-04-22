"use client";

import { Building2 } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { AccountSettingsCard } from "@/features/settings/components/AccountSettingsCard";
import { t } from "@/lib/i18n";

export default function SettingsAccountPage() {
  return (
    <PageContainer>
      <div className="w-full max-w-3xl text-start" dir="rtl">
        <PageHeader
          titleIcon={Building2}
          title={t("pages.settingsAccount.title")}
          description={t("pages.settingsAccount.description")}
        />
        <AccountSettingsCard />
      </div>
    </PageContainer>
  );
}
