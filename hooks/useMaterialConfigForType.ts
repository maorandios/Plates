"use client";

import { useEffect, useState } from "react";
import {
  getMaterialConfig,
  subscribeMaterialConfigChanged,
} from "@/lib/settings/materialConfig";
import type { MaterialConfig, MaterialType } from "@/types/materials";

/**
 * `getMaterialConfig` from localStorage, re-read when
 * `plate-material-config-changed` fires (e.g. user added custom סיווג in Settings
 * and returned to Quick Quote) — not only when `materialType` changes.
 */
export function useMaterialConfigForType(
  materialType: MaterialType | null
): MaterialConfig | null {
  const [config, setConfig] = useState<MaterialConfig | null>(() =>
    materialType ? getMaterialConfig(materialType) : null
  );

  useEffect(() => {
    if (!materialType) {
      setConfig(null);
      return;
    }
    setConfig(getMaterialConfig(materialType));
  }, [materialType]);

  useEffect(() => {
    if (!materialType) return;
    return subscribeMaterialConfigChanged(materialType, () => {
      setConfig(getMaterialConfig(materialType));
    });
  }, [materialType]);

  return config;
}
