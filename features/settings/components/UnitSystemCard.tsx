"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import type { UnitSystem } from "@/types/settings";

const OPTIONS: { value: UnitSystem; label: string; hint: string }[] = [
  { value: "metric", label: "Metric", hint: "mm, m², kg in the UI" },
  { value: "imperial", label: "Imperial", hint: "in, ft², lb in the UI" },
];

export function UnitSystemCard() {
  const { preferences, setUnitSystem } = useAppPreferences();

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Unit system</CardTitle>
        <CardDescription>
          Geometry stays stored in millimeters internally. This only changes how lengths, areas,
          and weights are formatted in the app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 max-w-md">
        <Label htmlFor="unit-system">Display units</Label>
        <Select
          value={preferences.unitSystem}
          onValueChange={(v) => setUnitSystem(v as UnitSystem)}
        >
          <SelectTrigger id="unit-system" className="w-full">
            <SelectValue placeholder="Select unit system" />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label} — {o.hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
