/* Remove the Next.js cache directory (fix stale / missing file bundler errors). */
const fs = require("node:fs");
const path = require("node:path");
const nextDir = path.join(__dirname, "..", ".next");
try {
  fs.rmSync(nextDir, { recursive: true, force: true });
} catch {
  // ignore
}
