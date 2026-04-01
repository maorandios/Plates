"use client";

import type { MaterialType } from "@/types/materials";
import type { BendPlateQuoteItem } from "../../bend-plate/types";
import { BendPlateBuilder } from "../../bend-plate/BendPlateBuilder";

interface BendPlateQuotePhaseProps {
  materialType: MaterialType;
  quoteItems: BendPlateQuoteItem[];
  onAddItem: (item: BendPlateQuoteItem) => void;
  onUpdateItem: (item: BendPlateQuoteItem) => void;
  onRemoveItem: (id: string) => void;
  onBack: () => void;
  onComplete: () => void;
}

export function BendPlateQuotePhase({
  materialType,
  quoteItems,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onBack,
  onComplete,
}: BendPlateQuotePhaseProps) {
  return (
    <BendPlateBuilder
      materialType={materialType}
      quoteItems={quoteItems}
      onAddItem={onAddItem}
      onUpdateItem={onUpdateItem}
      onRemoveItem={onRemoveItem}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}
