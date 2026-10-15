import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

// Build-time version label (short sha + commit date). Docker passes these via
// env/build args; locally we ask git and fall back quietly.
function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}
const gitSha =
  process.env.NEXT_PUBLIC_GIT_SHA || git("rev-parse --short=7 HEAD") || "dev";
const gitDate =
  process.env.NEXT_PUBLIC_GIT_DATE || git("log -1 --format=%cd --date=short");

// Pin the workspace root to this project. A stray ~/package-lock.json otherwise
// makes Next infer the home directory as the root (Turbopack multi-lockfile warning).
const nextConfig: NextConfig = {
  // Standalone output for the self-host Docker image (D3/D5).
  output: "standalone",
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_GIT_DATE: gitDate,
  },
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
  // Public static offline fallback (no user data); see src/lib/pwa/runtime-caching.ts.
  additionalPrecacheEntries: [{ url: "/offline.html", revision: "1" }],
});

// Compose: serwist wraps the next-intl-wrapped config.
export default withSerwist(withNextIntl(nextConfig));
