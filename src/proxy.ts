// Next.js 16: middleware was renamed to proxy. Uses a SEPARATE lightweight NextAuth
// instance (authConfig only — no Prisma/bcrypt) so the proxy bundle stays free of
// Node-only deps. Gating runs via the `authorized` callback against the JWT.
// Always re-check auth inside Server Actions / Route Handlers too.
export { auth as proxy } from "@/lib/proxy-auth";

export const config = {
  // Exclude static + PWA assets (manifest, service worker, icons) so they are
  // publicly reachable without the auth redirect — required for installability.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:js|json|webmanifest|map|svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
