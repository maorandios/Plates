"use client";

import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { MaterialsConfigurationPage } from "@/features/settings/materials/MaterialsConfigurationPage";
import { t } from "@/lib/i18n";

export default function SettingsMaterialsPage() {
  return (
    <PageContainer>
      <div dir="rtl" className="w-full space-y-6">
        <PageHeader
          title={t("pages.settingsMaterials.title")}
          description={t("pages.settingsMaterials.description")}
        />
        <div className="w-full max-w-none">
          <MaterialsConfigurationPage />
        </div>
      </div>
    </PageContainer>
  );
}
