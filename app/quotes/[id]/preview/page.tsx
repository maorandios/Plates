"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileQuestion } from "lucide-react";
import { QuotePreviewView } from "@/features/quotes/components/QuotePreviewView";
import {
  getQuoteSnapshot,
  type QuoteSessionSnapshot,
} from "@/lib/quotes/quoteSnapshot";
import { loadEntityTablesForOrg } from "@/lib/supabase/entityTableSyncBrowser";
import { getQuotesList } from "@/lib/quotes/quoteList";
import type { QuotePreviewListMeta } from "@/features/quotes/components/QuotePreviewView";
import { t } from "@/lib/i18n";

export default function QuotePreviewPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [snapshot, setSnapshot] = useState<QuoteSessionSnapshot | null>(null);

  useLayoutEffect(() => {
    if (!id) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      let s = getQuoteSnapshot(id);
      if (!s) {
        const data = await loadEntityTablesForOrg();
        if (!cancelled && !("error" in data)) {
          s = getQuoteSnapshot(id);
        }
      }
      if (!cancelled) setSnapshot(s);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const listMeta = useMemo((): QuotePreviewListMeta => {
    if (!snapshot) {
      return {
        customerName: "",
        projectName: "",
        referenceNumber: "",
        createdAtIso: new Date().toISOString(),
      };
    }
    const row = getQuotesList().find((q) => q.id === id);
    const q = snapshot.draft.quote;
    return {
      customerName:
        row?.customerName?.trim() || q.customer_name?.trim() || q.customer_company?.trim() || "",
      projectName: row?.projectName?.trim() || q.project_name?.trim() || "",
      referenceNumber: row?.referenceNumber?.trim() || q.quote_number?.trim() || "",
      createdAtIso: row?.createdAt || snapshot.savedAt,
    };
  }, [id, snapshot]);

  if (!id) {
    return null;
  }

  if (!snapshot) {
    return (
      <PageContainer className="!pt-0 px-6 pb-6 lg:px-8 lg:pb-8">
        <div dir="rtl">
          <EmptyState
            icon={FileQuestion}
            title={t("quotePreview.noSnapshotTitle")}
            description={t("quotePreview.noSnapshotDescription")}
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="!pt-0 px-6 pb-6 lg:px-8 lg:pb-8">
      <QuotePreviewView quoteId={id} snapshot={snapshot} listMeta={listMeta} />
    </PageContainer>
  );
}
