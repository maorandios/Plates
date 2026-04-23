"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getMaterialConfig,
  saveMaterialConfig,
  subscribeMaterialConfigChanged,
} from "@/lib/settings/materialConfig";
import { t } from "@/lib/i18n";
import type { MaterialConfig, MaterialType } from "@/types/materials";
import { MATERIAL_TYPE_LABELS } from "@/types/materials";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialPricingCard } from "./MaterialPricingCard";
import { StockSheetsTable } from "./StockSheetsTable";

/** Tab order (RTL): פלדה → אלומיניום → נירוסטה */
const SETTINGS_MATERIAL_COLUMN_ORDER: MaterialType[] = [
  "carbonSteel",
  "aluminum",
  "stainlessSteel",
];

const SK = "settings.materials" as const;

function MaterialTypeSettingsColumn({
  materialType,
  showMaterialHeading = false,
}: {
  materialType: MaterialType;
  /** When false, the tab label carries the name — hide duplicate heading. */
  showMaterialHeading?: boolean;
}) {
  const [config, setConfig] = useState<MaterialConfig>(() =>
    getMaterialConfig(materialType)
  );

  useEffect(() => {
    const sync = () => setConfig(getMaterialConfig(materialType));
    return subscribeMaterialConfigChanged(materialType, sync);
  }, [materialType]);

  const handleUpdate = useCallback((patch: Partial<MaterialConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      saveMaterialConfig(next);
      return next;
    });
  }, []);

  const materialLabel = MATERIAL_TYPE_LABELS[materialType];

  return (
    <div
      dir="rtl"
      className="flex min-w-0 flex-col gap-6 rounded-xl border border-border bg-card/40 p-4 sm:p-5 md:p-6 text-start"
    >
      {showMaterialHeading ? (
        <h2 className="border-b border-border pb-3 text-start text-base font-semibold text-foreground">
          {t(`${SK}.columnHeading`, { material: materialLabel })}
        </h2>
      ) : null}
      <MaterialPricingCard config={config} onUpdate={handleUpdate} />
      <StockSheetsTable config={config} onUpdate={handleUpdate} />
    </div>
  );
}

export function MaterialsConfigurationPage() {
  const defaultTab = SETTINGS_MATERIAL_COLUMN_ORDER[0];

  return (
    <div className="w-full pb-12" dir="rtl">
      <Tabs defaultValue={defaultTab} className="w-full">
        <div className="mb-4 w-full">
          {/*
            Full-width tab strip, same as content below. Grid + dir=rtl: first cell is on the
            right — פלדה | אלומיניום | נירוסטה
          */}
          <TabsList
            className="grid h-auto w-full min-w-0 grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1.5 sm:gap-2"
            dir="rtl"
            aria-label={t(`${SK}.tabListAria`)}
          >
            {SETTINGS_MATERIAL_COLUMN_ORDER.map((mat) => (
              <TabsTrigger
                key={mat}
                value={mat}
                className="min-h-10 w-full px-2 py-2 text-sm sm:px-4"
              >
                {MATERIAL_TYPE_LABELS[mat]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {SETTINGS_MATERIAL_COLUMN_ORDER.map((mat) => (
          <TabsContent
            key={mat}
            value={mat}
            className="mt-0 w-full outline-none focus-visible:ring-0"
          >
            <MaterialTypeSettingsColumn
              materialType={mat}
              showMaterialHeading={false}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
