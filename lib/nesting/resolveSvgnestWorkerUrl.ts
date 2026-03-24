import { isSvgnestWorkerReachable } from "./checkSvgnestWorker";

/**
 * Picks a working SVGNest worker URL without user setup:
 * 1) static file from public/nesting/nestWorker.js (postinstall / predev / prebuild)
 * 2) same-origin API route that streams from node_modules
 */
export async function resolveSvgnestWorkerUrlClient(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const origin = window.location.origin;
  const staticUrl = `${origin}/nesting/nestWorker.js`;
  const apiUrl = `${origin}/api/nesting-worker`;

  if (await isSvgnestWorkerReachable(staticUrl)) return staticUrl;
  if (await isSvgnestWorkerReachable(apiUrl)) return apiUrl;
  return null;
}
