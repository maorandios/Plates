"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Layers } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { nanoid } from "@/lib/utils/nanoid";
import {
  getBatchById,
  getPartsByBatch,
  getPurchasedSheetSizes,
  getStockSheetsByBatch,
  saveStockSheetsForBatch,
} from "@/lib/store";
import { useAppPreferences } from "@/features/settings/useAppPreferences";
import {
  createEmptyStockSheetEntry,
  deriveThicknessGroupsFromParts,
  validateStockSheetEntry,
} from "@/lib/nesting/stockConfiguration";
import type { StockSheetEntry } from "@/types/nesting";
import { ThicknessStockAccordion } from "./ThicknessStockAccordion";
import { GenerateNestingPanel } from "./GenerateNestingPanel";

function useBatchIdParam(): string {
  const params = useParams();
  const raw = params?.id;
  return typeof raw === "string" ? raw : Array.isArray(raw) ? (raw[0] ?? "") : "";
}

export default function StockConfigurationPage() {
  const batchId = useBatchIdParam();
  const router = useRouter();
  const { preferences, unitSystem } = useAppPreferences();

  const [rows, setRows] = useState<StockSheetEntry[]>([]);
  const [cuttingOverridesRefreshKey, setCuttingOverridesRefreshKey] = useState(0);
  const [purchasedCatalogRev, setPurchasedCatalogRev] = useState(0);

  const batch = useMemo(
    () => (batchId ? getBatchById(batchId) : undefined),
    [batchId]
  );

  const parts = useMemo(
    () => (batchId ? getPartsByBatch(batchId) : []),
    [batchId]
  );

  const groups = useMemo(
    () => deriveThicknessGroupsFromParts(parts),
    [parts]
  );

  useEffect(() => {
    if (!batchId) return;
    if (!getBatchById(batchId)) {
      router.replace("/batches");
      return;
    }
  }, [batchId, router]);

  useEffect(() => {
    if (!batchId) return;
    setRows(getStockSheetsByBatch(batchId));
  }, [batchId]);

  useEffect(() => {
    const onCatalog = () => setPurchasedCatalogRev((n) => n + 1);
    window.addEventListener("plate-purchased-sheet-catalog-changed", onCatalog);
    return () =>
      window.removeEventListener(
        "plate-purchased-sheet-catalog-changed",
        onCatalog
      );
  }, []);

  const purchasedCatalog = useMemo(
    () => getPurchasedSheetSizes(),
    [purchasedCatalogRev]
  );

  const persistValid = useCallback(
    (all: StockSheetEntry[]) => {
      if (!batchId) return;
      const valid = all.filter((r) => validateStockSheetEntry(r).ok);
      saveStockSheetsForBatch(batchId, valid);
    },
    [batchId]
  );

  const patchRow = useCallback(
    (id: string, patch: Partial<StockSheetEntry>) => {
      const now = new Date().toISOString();
      setRows((prev) => {
        const next = prev.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: now } : r
        );
        persistValid(next);
        return next;
      });
    },
    [persistValid]
  );

  const deleteRow = useCallback(
    (id: string) => {
      setRows((prev) => {
        const next = prev.filter((r) => r.id !== id);
        persistValid(next);
        return next;
      });
    },
    [persistValid]
  );

  const addRow = useCallback(
    (thicknessMm: number | null) => {
      if (!batchId) return;
      const now = new Date().toISOString();
      const id = nanoid();
      const row = createEmptyStockSheetEntry(batchId, thicknessMm, id, now);
      setRows((prev) => {
        const next = [...prev, row];
        persistValid(next);
        return next;
      });
    },
    [batchId, persistValid]
  );

  const addRowFromCatalog = useCallback(
    (thicknessMm: number | null, widthMm: number, lengthMm: number) => {
      if (!batchId) return;
      const now = new Date().toISOString();
      const id = nanoid();
      const row: StockSheetEntry = {
        ...createEmptyStockSheetEntry(batchId, thicknessMm, id, now),
        widthMm,
        lengthMm,
      };
      setRows((prev) => {
        const next = [...prev, row];
        persistValid(next);
        return next;
      });
    },
    [batchId, persistValid]
  );

  if (!batchId) return null;

  if (!batch) return null;

  if (parts.length === 0) {
    return (
      <PageContainer embedded>
        <div className="max-w-3xl mx-auto space-y-6">
          <header className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              Stock configuration
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Assign available stock sheets for each thickness in this batch.
            </p>
          </header>
          <EmptyState
            icon={Layers}
            title="No parts in this batch"
            description="Build the unified parts table in Validation first so thickness values are available for stock assignment."
            action={
              <Button asChild>
                <Link href={`/batches/${batchId}/parts`}>Go to Validation</Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer embedded>
      <div className="max-w-5xl mx-auto space-y-8 pb-8">
        <header className="space-y-2 border-b border-border/80 pb-6">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            Stock configuration
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Assign available stock sheets for each thickness. If you defined{" "}
            <Link
              href="/settings/materials#purchased-sheets"
              prefetch={false}
              className="underline font-medium text-foreground hover:text-primary"
            >
              purchased sheet sizes
            </Link>{" "}
            in Preferences, pick them from the catalogue under each thickness — or add
            sheets manually.
          </p>
        </header>

        <ThicknessStockAccordion
          batch={batch}
          groups={groups}
          stockRows={rows}
          purchasedCatalog={purchasedCatalog}
          unitSystem={unitSystem}
          cuttingOverridesRefreshKey={cuttingOverridesRefreshKey}
          onThicknessCuttingMutate={() =>
            setCuttingOverridesRefreshKey((k) => k + 1)
          }
          onAddRow={addRow}
          onAddRowFromCatalog={addRowFromCatalog}
          onPatchRow={patchRow}
          onDeleteRow={deleteRow}
        />

        <GenerateNestingPanel batch={batch} />
      </div>
    </PageContainer>
  );
}
