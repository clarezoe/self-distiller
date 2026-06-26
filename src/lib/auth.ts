import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { createTransport } from "nodemailer";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";
import { isAllowedEmail } from "@/lib/allowlist";

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
    // Allowlist gate: only configured addresses may sign in (case-insensitive).
    signIn({ user }) {
      return isAllowedEmail(user.email, process.env.AUTH_ALLOWLIST);
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
