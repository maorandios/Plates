"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getMaterialConfig,
  saveMaterialConfig,
  subscribeMaterialConfigChanged,
} from "@/lib/settings/materialConfig";
import type { MaterialConfig, MaterialType } from "@/types/materials";
import { MATERIAL_TYPE_LABELS, MATERIAL_TYPE_OPTIONS } from "@/types/materials";
import { MaterialPricingCard } from "./MaterialPricingCard";
import { StockSheetsTable } from "./StockSheetsTable";

export function MaterialsConfigurationPage() {
  const [activeTab, setActiveTab] = useState<MaterialType>("carbonSteel");
  const [config, setConfig] = useState<MaterialConfig | null>(null);

  useEffect(() => {
    const sync = () => setConfig(getMaterialConfig(activeTab));
    sync();
    return subscribeMaterialConfigChanged(activeTab, sync);
  }, [activeTab]);

  const handleUpdate = useCallback(
    (patch: Partial<MaterialConfig>) => {
      if (!config) return;
      const next = { ...config, ...patch };
      saveMaterialConfig(next);
      setConfig(next);
    },
    [config]
  );

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MaterialType)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          {MATERIAL_TYPE_OPTIONS.map((mat) => (
            <TabsTrigger key={mat} value={mat}>
              {MATERIAL_TYPE_LABELS[mat]}
            </TabsTrigger>
          ))}
        </TabsList>

        {MATERIAL_TYPE_OPTIONS.map((mat) => (
          <TabsContent key={mat} value={mat} className="space-y-6 mt-6">
            <MaterialPricingCard config={config} onUpdate={handleUpdate} />
            <StockSheetsTable config={config} onUpdate={handleUpdate} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
