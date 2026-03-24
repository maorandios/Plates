/**
 * Quick check that the static nest worker is served (postinstall copies it to public/nesting/).
 */

export async function isSvgnestWorkerReachable(workerUrl: string): Promise<boolean> {
  if (!workerUrl || typeof fetch === "undefined") return false;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(workerUrl, {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (res.ok) return true;
    const resGet = await fetch(workerUrl, {
      method: "GET",
      cache: "no-store",
      signal: ctrl.signal,
      headers: { Range: "bytes=0-0" },
    });
    return resGet.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(tid);
  }
}
