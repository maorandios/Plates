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

/** Visual column order: פלדה → אלומיניום → נירוסטה */
const SETTINGS_MATERIAL_COLUMN_ORDER: MaterialType[] = [
  "carbonSteel",
  "aluminum",
  "stainlessSteel",
];
import { MaterialPricingCard } from "./MaterialPricingCard";
import { StockSheetsTable } from "./StockSheetsTable";

const SK = "settings.materials" as const;

function MaterialTypeSettingsColumn({ materialType }: { materialType: MaterialType }) {
  const [config, setConfig] = useState<MaterialConfig>(() => getMaterialConfig(materialType));

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
    <div className="flex min-w-0 flex-col gap-6 rounded-xl border border-white/[0.08] bg-card/40 p-4 sm:p-5">
      <h2 className="border-b border-white/10 pb-3 text-start text-base font-semibold text-foreground">
        {t(`${SK}.columnHeading`, { material: materialLabel })}
      </h2>
      <MaterialPricingCard config={config} onUpdate={handleUpdate} />
      <StockSheetsTable config={config} onUpdate={handleUpdate} />
    </div>
  );
}

export function MaterialsConfigurationPage() {
  return (
    <div className="w-full pb-12">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {SETTINGS_MATERIAL_COLUMN_ORDER.map((mat) => (
          <MaterialTypeSettingsColumn key={mat} materialType={mat} />
        ))}
      </div>
    </div>
  );
}
