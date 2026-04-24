import { Suspense } from "react";
import { QuickQuotePage } from "@/features/quick-quote/components/QuickQuotePage";
import { t } from "@/lib/i18n";

export default function QuickQuoteRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-muted-foreground" dir="rtl">
          {t("common.loading")}
        </div>
      }
    >
      <QuickQuotePage />
    </Suspense>
  );
}
