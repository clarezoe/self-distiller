import type { NextAuthConfig } from "next-auth";

// Lightweight config shared by the proxy (middleware) and the full server config.
// MUST NOT import Prisma, bcrypt, or other Node-only deps — the proxy bundle
// includes this, and route gating only needs the JWT (no DB access).
// `/api/persona` is token-gated (PERSONA_API_TOKEN) in its own handler, not
// session-gated — keep it out of the login redirect so external agents reach it.
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/api/persona"];

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // real providers (Credentials) are added in auth.ts (Node runtime)
  callbacks: {
    // Route gating for proxy.ts. Return false → redirect to signIn page.
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      if (typeof token.role === "string") session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
