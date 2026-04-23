"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { MaterialsConfigurationPage } from "@/features/settings/materials/MaterialsConfigurationPage";
import { t } from "@/lib/i18n";

export default function SettingsMaterialsPage() {
  return (
    <PageContainer>
      <div dir="rtl" className="mx-auto w-full max-w-3xl space-y-6 text-start">
        <PageHeader
          title={t("pages.settingsMaterials.title")}
          description={t("pages.settingsMaterials.description")}
        />
        <MaterialsConfigurationPage />
      </div>
    </PageContainer>
  );
}
