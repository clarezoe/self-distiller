import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

// Pin the workspace root to this project. A stray ~/package-lock.json otherwise
// makes Next infer the home directory as the root (Turbopack multi-lockfile warning).
const nextConfig: NextConfig = {
  // Standalone output for the self-host Docker image (D3/D5).
  output: "standalone",
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
