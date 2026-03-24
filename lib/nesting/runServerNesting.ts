import type { Batch, NestingRun, NestingRunMode } from "@/types";
import type { UnitSystem } from "@/types/settings";
import { buildServerNestingPayload } from "./buildServerNestingPayload";
import { mapServerResultToNestingRun } from "./mapServerResultToRun";
import {
  createServerNestingJob,
  getServerNestingJobResult,
  getServerNestingJobStatus,
} from "./serverNestingClient";

const DEFAULT_BASE_URL = "/api/server-nesting";
const DEFAULT_POLL_MS = 1200;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runServerNesting(options: {
  batch: Batch;
  unitSystem: UnitSystem;
  nestingRunMode?: NestingRunMode;
  pollIntervalMs?: number;
  timeoutMs?: number;
}): Promise<NestingRun> {
  const {
    batch,
    unitSystem,
    nestingRunMode = "quick",
    pollIntervalMs = DEFAULT_POLL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const payload = buildServerNestingPayload({
    batch,
    unitSystem,
    runMode: nestingRunMode,
  });

  const created = await createServerNestingJob(DEFAULT_BASE_URL, payload);
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Server-side nesting timed out while waiting for job completion.");
    }
    const status = await getServerNestingJobStatus(DEFAULT_BASE_URL, created.jobId);
    if (status.status === "completed") {
      const result = await getServerNestingJobResult(DEFAULT_BASE_URL, created.jobId);
      return mapServerResultToNestingRun(result);
    }
    if (status.status === "failed") {
      throw new Error(status.error || "Server-side nesting failed.");
    }
    await sleep(pollIntervalMs);
  }
}
