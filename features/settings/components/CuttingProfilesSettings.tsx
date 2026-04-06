"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import {
  getAllCuttingProfileRanges,
  subscribeCuttingProfilesChanged,
} from "@/lib/settings/cuttingProfiles";
import { CUTTING_METHOD_OPTIONS } from "@/types/production";
import { CuttingMethodProfileSection } from "./CuttingMethodProfileSection";

export function CuttingProfilesSettings() {
  const { preferences } = useAppPreferences();
  const [tick, setTick] = useState(0);

  const byMethod = useMemo(() => {
    const all = getAllCuttingProfileRanges();
    return CUTTING_METHOD_OPTIONS.map((method) => ({
      method,
      ranges: all
        .filter((r) => r.method === method)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [tick]);

  useEffect(() => {
    return subscribeCuttingProfilesChanged(() => setTick((t) => t + 1));
  }, []);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Cutting profiles</CardTitle>
        <CardDescription>
          Default nesting-related settings by cutting process and plate thickness. Batches will use
          these when you add nesting rules: the rule matching the batch method and part thickness
          loads here first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-2">
        {byMethod.map(({ method, ranges }) => (
          <CuttingMethodProfileSection
            key={method}
            method={method}
            ranges={ranges}
            unitSystem={preferences.unitSystem}
            onRangesChange={() => setTick((t) => t + 1)}
          />
        ))}
      </CardContent>
    </Card>
  );
}
