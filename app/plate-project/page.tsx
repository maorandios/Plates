import { Suspense } from "react";
import { PlateProjectPage } from "@/features/plate-project/components/PlateProjectPage";
import { t } from "@/lib/i18n";

export default function PlateProjectRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-muted-foreground" dir="rtl">
          {t("common.loading")}
        </div>
      }
    >
      <PlateProjectPage />
    </Suspense>
  );
}
