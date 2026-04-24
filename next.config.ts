import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Puppeteer + bundled Chromium (quote PDF on Vercel) */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "nunjucks"],
  /**
   * @sparticuz/chromium must stay external (see package README) but the `bin/`
   * brotli binaries are not picked up by default NFT tracing — without this,
   * Vercel shows: input directory ".../chromium/bin" does not exist.
   * @see https://github.com/Sparticuz/chromium#bundler-configuration
   */
  outputFileTracingIncludes: {
    "/api/quotes/export-pdf": [
      "./node_modules/@sparticuz/chromium/**",
    ],
  },
};

export default nextConfig;
