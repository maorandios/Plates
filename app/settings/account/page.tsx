"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { AccountSettingsCard } from "@/features/settings/components/AccountSettingsCard";
import { t } from "@/lib/i18n";

export default function SettingsAccountPage() {
  return (
    <PageContainer>
      <PageHeader
        title={t("pages.settingsAccount.title")}
        description={t("pages.settingsAccount.description")}
      />
      <div className="max-w-3xl">
        <AccountSettingsCard />
      </div>
    </PageContainer>
  );
}
