import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules", "svgnest-mjs", "dist", "nestWorker.js");
const destDir = path.join(root, "public", "nesting");
const dest = path.join(destDir, "nestWorker.js");

if (!fs.existsSync(src)) {
  console.warn("copy-svgnest-worker: nestWorker.js not found at", src);
  process.exit(0);
}
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("copy-svgnest-worker: copied to public/nesting/nestWorker.js");
