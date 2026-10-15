/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { OFFLINE_FALLBACK_URL, runtimeCaching } from "@/lib/pwa/runtime-caching";

// Serwist injects the precache manifest at build time into self.__SW_MANIFEST.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Privacy: only public static assets are cached (see src/lib/pwa/runtime-caching.ts).
// Do NOT reintroduce Serwist's defaultCache — it caches authenticated pages, RSC and /api GETs.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: OFFLINE_FALLBACK_URL,
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
