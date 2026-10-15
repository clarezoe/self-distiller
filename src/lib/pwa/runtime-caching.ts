import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  StaleWhileRevalidate,
  type RuntimeCaching,
} from "serwist";

// Privacy rule: the service worker may cache ONLY public, content-addressed or
// static assets. Authenticated documents, RSC payloads, /api/** and cross-origin
// requests always go to the network (NetworkOnly) so no user content or
// per-account response is ever written to Cache Storage.
//
// Rules are evaluated in order; the final catch-all keeps navigations on a
// strategy so the offline fallback plugin can apply to them.

const FONT_EXT = /\.(?:woff2?|ttf|otf)$/i;

type Ctx = { sameOrigin: boolean; url: URL };

export function isStaticBuildAsset({ sameOrigin, url }: Ctx): boolean {
  return sameOrigin && url.pathname.startsWith("/_next/static/");
}

export function isFontAsset({ sameOrigin, url }: Ctx): boolean {
  return sameOrigin && FONT_EXT.test(url.pathname);
}

export function isAppIcon({ sameOrigin, url }: Ctx): boolean {
  return (
    sameOrigin &&
    url.pathname.startsWith("/icons/") &&
    /\.(?:png|svg|ico|webp)$/i.test(url.pathname)
  );
}

export const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: isStaticBuildAsset,
    handler: new CacheFirst({
      cacheName: "static-build-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 30 * 24 * 3600 })],
    }),
  },
  {
    matcher: isFontAsset,
    handler: new CacheFirst({
      cacheName: "static-fonts",
      plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 365 * 24 * 3600 })],
    }),
  },
  {
    matcher: isAppIcon,
    handler: new StaleWhileRevalidate({
      cacheName: "static-icons",
      plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 7 * 24 * 3600 })],
    }),
  },
  // Everything else: documents, RSC, /api/**, /api/auth, /api/persona, cross-origin.
  {
    matcher: () => true,
    handler: new NetworkOnly(),
  },
];

export const OFFLINE_FALLBACK_URL = "/offline.html";
