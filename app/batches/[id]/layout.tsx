import { BatchProcessShell } from "@/features/batches/BatchProcessShell";

export default async function BatchIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BatchProcessShell batchId={id}>{children}</BatchProcessShell>;
}
