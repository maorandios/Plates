"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MaterialConfig } from "@/types/materials";

interface MaterialPricingCardProps {
  config: MaterialConfig;
  onUpdate: (patch: Partial<MaterialConfig>) => void;
}

export function MaterialPricingCard({ config, onUpdate }: MaterialPricingCardProps) {
  const [price, setPrice] = useState(config.materialPrice.toString());
  const [density, setDensity] = useState(config.densityKgPerM3.toString());
  const [markup, setMarkup] = useState(config.defaultMarkupPercent.toString());
  const [scrap, setScrap] = useState(config.defaultScrapPercent.toString());

  useEffect(() => {
    setPrice(config.materialPrice.toString());
    setDensity(config.densityKgPerM3.toString());
    setMarkup(config.defaultMarkupPercent.toString());
    setScrap(config.defaultScrapPercent.toString());
  }, [config.materialPrice, config.densityKgPerM3, config.defaultMarkupPercent, config.defaultScrapPercent]);

  const persist = useCallback(
    (patch: Partial<MaterialConfig>) => {
      onUpdate({ ...patch, pricingMode: "perKg" });
    },
    [onUpdate]
  );

  function handlePriceBlur() {
    const n = parseFloat(price);
    if (Number.isFinite(n) && n >= 0) {
      persist({ materialPrice: n });
    } else {
      setPrice(config.materialPrice.toString());
    }
  }

  function handleDensityBlur() {
    const n = parseFloat(density);
    if (Number.isFinite(n) && n > 0) {
      persist({ densityKgPerM3: n });
    } else {
      setDensity(config.densityKgPerM3.toString());
    }
  }

  function handleMarkupBlur() {
    const n = parseFloat(markup);
    if (Number.isFinite(n) && n >= 0) {
      persist({ defaultMarkupPercent: n });
    } else {
      setMarkup(config.defaultMarkupPercent.toString());
    }
  }

  function handleScrapBlur() {
    const n = parseFloat(scrap);
    if (Number.isFinite(n) && n >= 0) {
      persist({ defaultScrapPercent: n });
    } else {
      setScrap(config.defaultScrapPercent.toString());
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Basics Parameters</CardTitle>
        <CardDescription>
          Material cost, markup, and scrap defaults for {config.displayName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${config.materialType}-price`}>Material price (per kg)</Label>
            <Input
              id={`${config.materialType}-price`}
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onBlur={handlePriceBlur}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${config.materialType}-density`}>
              Density (kg/m³)
            </Label>
            <Input
              id={`${config.materialType}-density`}
              type="number"
              step="1"
              min="1"
              value={density}
              onChange={(e) => setDensity(e.target.value)}
              onBlur={handleDensityBlur}
              placeholder="7850"
            />
            <p className="text-[11px] text-muted-foreground">
              Used to estimate weight from plate area.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${config.materialType}-markup`}>Default markup (%)</Label>
            <Input
              id={`${config.materialType}-markup`}
              type="number"
              step="1"
              min="0"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              onBlur={handleMarkupBlur}
              placeholder="20"
            />
          </div>
        </div>

        <div className="space-y-2 max-w-[calc(50%-0.5rem)]">
          <Label htmlFor={`${config.materialType}-scrap`}>Default scrap (%)</Label>
          <Input
            id={`${config.materialType}-scrap`}
            type="number"
            step="1"
            min="0"
            value={scrap}
            onChange={(e) => setScrap(e.target.value)}
            onBlur={handleScrapBlur}
            placeholder="15"
          />
          <p className="text-[11px] text-muted-foreground">
            Used for sheet estimation in quotes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
