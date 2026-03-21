/** Lightweight nanoid replacement (no external dep needed) */
export function nanoid(size = 21): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const array = new Uint8Array(size);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    // Node.js fallback (for SSR)
    const { randomFillSync } = require("crypto") as typeof import("crypto");
    randomFillSync(array);
  }
  for (let i = 0; i < size; i++) {
    id += chars[array[i] % chars.length];
  }
  return id;
}
