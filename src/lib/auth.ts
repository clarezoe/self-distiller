import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { createTransport } from "nodemailer";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { isSignInAllowed } from "@/lib/allowlist";
import { findOpenInviteByEmail, markInviteAccepted } from "@/lib/services/invites";

// Full config (Node runtime): Prisma adapter + email magic-link provider.
// Password (Credentials) login was removed in GitHub #9 — sign-in is now an
// allowlisted Nodemailer magic link only.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      from: process.env.SMTP_FROM,
      // Dev / SMTP-unset fallback: log the magic URL to the server console so
      // local login never needs a real mailbox (avoids dev lockout). When
      // SMTP_HOST is set, send a real email via nodemailer.
      async sendVerificationRequest({ identifier, url, provider }) {
        if (!process.env.SMTP_HOST) {
          console.log(`\n[auth] Magic sign-in link for ${identifier}:\n${url}\n`);
          return;
        }
        const transport = createTransport(provider.server);
        const { host } = new URL(url);
        await transport.sendMail({
          to: identifier,
          from: provider.from,
          subject: `Sign in to ${host}`,
          text: `Sign in to ${host}\n${url}\n\nIf you did not request this, you can ignore this email.`,
          html: `<p>Sign in to <strong>${host}</strong></p><p><a href="${url}">Click here to sign in</a></p><p>If you did not request this, you can ignore this email.</p>`,
        });
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Authoritative role into the JWT (GitHub #13). On sign-in Auth.js passes the
    // in-memory `user` object that the adapter's `createUser` returned — which
    // still carries the schema-default role "owner" even though our
    // `events.createUser` below has just demoted an invited user to "member" in
    // the DB (the event mutates the row, not this object). Re-read the role from
    // the DB so a first-login invited member never gets a stale "owner" token.
    // Falls back to the base (proxy-shared) jwt logic for the uid/role copy.
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        // Authoritative DB role (see note above) — not the stale in-memory user.
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role ?? user.role;
      }
      return token;
    },
    // Invite-only gate (GitHub #13). Allow sign-in if the email is an existing
    // User, has an open Invite, or is in the bootstrap env AUTH_ALLOWLIST (so the
    // first owner can sign in before any invite exists). DB-aware — runs in the
    // Node auth.ts, never in the proxy bundle.
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      const [existingUser, openInvite] = await Promise.all([
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
        findOpenInviteByEmail(email),
      ]);
      return isSignInAllowed(email, {
        isUser: !!existingUser,
        isInvited: !!openInvite,
        bootstrapEnv: process.env.AUTH_ALLOWLIST,
      });
    },
  },
  events: {
    // First sign-in of an invited email: the adapter just created the User (with
    // the schema default role "owner"). If an open Invite exists, demote to
    // "member" and stamp the invite accepted. No invite (bootstrap allowlist
    // email) → keep the default owner role.
    async createUser({ user }) {
      const invite = await findOpenInviteByEmail(user.email);
      if (!invite) return;
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "member" },
      });
      await markInviteAccepted(user.email);
    },
  },
});

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
