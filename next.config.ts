import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

// Pin the workspace root to this project. A stray ~/package-lock.json otherwise
// makes Next infer the home directory as the root (Turbopack multi-lockfile warning).
const nextConfig: NextConfig = {
  // Standalone output for the self-host Docker image (D3/D5).
  output: "standalone",
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

// next-intl: cookie-based locale (no routing), config lives in src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// @serwist/next: build the offline service worker. Disabled in dev so the dev
// server keeps fast refresh and isn't shadowed by a cached shell.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// Compose: serwist wraps the next-intl-wrapped config.
export default withSerwist(withNextIntl(nextConfig));
