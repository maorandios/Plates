"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { PageContainer } from "@/components/shared/PageContainer";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileQuestion } from "lucide-react";
import { ProjectPreviewView } from "@/features/plate-project/components/ProjectPreviewView";
import { getPlateProjectSnapshot } from "@/lib/projects/plateProjectSnapshot";
import { getPlateProjectsList } from "@/lib/projects/plateProjectList";
import type { ProjectPreviewListMeta } from "@/features/plate-project/components/ProjectPreviewView";
import { t } from "@/lib/i18n";

export default function ProjectPreviewPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const snapshot = useMemo(
    () => (typeof window === "undefined" ? null : getPlateProjectSnapshot(id)),
    [id]
  );

  const listMeta = useMemo((): ProjectPreviewListMeta => {
    if (!snapshot) {
      return {
        customerName: "",
        projectName: "",
        referenceNumber: "",
        createdAtIso: new Date().toISOString(),
      };
    }
    const row =
      typeof window === "undefined"
        ? undefined
        : getPlateProjectsList().find((p) => p.id === id);
    const j = snapshot.jobDetails;
    return {
      customerName: row?.customerName?.trim() || j.customerName?.trim() || "",
      projectName: row?.projectName?.trim() || j.projectName?.trim() || "",
      referenceNumber:
        row?.referenceNumber?.trim() || j.referenceNumber?.trim() || "",
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
            title={t("projectPreview.noSnapshotTitle")}
            description={t("projectPreview.noSnapshotDescription")}
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="!pt-0 px-6 pb-6 lg:px-8 lg:pb-8">
      <ProjectPreviewView projectId={id} snapshot={snapshot} listMeta={listMeta} />
    </PageContainer>
  );
}
