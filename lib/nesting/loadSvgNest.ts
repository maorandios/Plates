/**
 * Eager (static) import of SVGNest for the browser bundle.
 *
 * Dynamic `import("svgnest-mjs")` from `runSvgNest` caused Turbopack dev HMR to invalidate the
 * async chunk while nesting was still running ("deleted by an HMR update"), leaving SVGNest in a
 * broken state and yielding zero placements + repeated console warnings.
 */

import SvgNest from "svgnest-mjs";

export { SvgNest };
