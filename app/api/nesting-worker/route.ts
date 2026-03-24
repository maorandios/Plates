import { readFile, stat } from "fs/promises";
import path from "path";

const workerPath = path.join(
  process.cwd(),
  "node_modules",
  "svgnest-mjs",
  "dist",
  "nestWorker.js"
);

const jsHeaders = {
  "Content-Type": "application/javascript; charset=utf-8",
  "Cache-Control": "public, max-age=86400",
} as const;

/** Serves SVGNest nestWorker.js from node_modules when public/nesting/ was not copied. */
export async function GET() {
  try {
    const buf = await readFile(workerPath);
    return new Response(buf, { status: 200, headers: jsHeaders });
  } catch {
    return new Response(
      "// nestWorker.js missing — run npm install (svgnest-mjs)\n",
      { status: 404, headers: jsHeaders }
    );
  }
}

export async function HEAD() {
  try {
    await stat(workerPath);
    return new Response(null, { status: 200, headers: jsHeaders });
  } catch {
    return new Response(null, { status: 404 });
  }
}
