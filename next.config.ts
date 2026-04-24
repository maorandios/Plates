import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Puppeteer + bundled Chromium (quote PDF on Vercel) */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "nunjucks"],
};

export default nextConfig;
