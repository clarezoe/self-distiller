// Next.js 16: middleware was renamed to proxy. Uses a SEPARATE lightweight NextAuth
// instance (authConfig only — no Prisma/bcrypt) so the proxy bundle stays free of
// Node-only deps. Gating runs via the `authorized` callback against the JWT.
// Always re-check auth inside Server Actions / Route Handlers too.
export { auth as proxy } from "@/lib/proxy-auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
