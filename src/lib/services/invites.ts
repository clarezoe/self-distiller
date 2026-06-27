import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

// Invite-only auth (GitHub #13). Only an owner may create invites. Invited
// emails are allowed to sign in via magic link; on first sign-in the adapter
// creates the User (role "member") and `markInviteAccepted` stamps acceptedAt.

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Find an OPEN (not-yet-accepted) invite for an email. Used by the sign-in gate.
export async function findOpenInviteByEmail(email: string | null | undefined) {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return prisma.invite.findFirst({
    where: { email: normalized, acceptedAt: null },
  });
}

export function listInvites() {
  return prisma.invite.findMany({ orderBy: { createdAt: "desc" } });
}

// Owner-only: create an invite for an email. Idempotent on the unique email —
// returns the existing invite if one is already present.
export async function createInvite(ownerUserId: string, rawEmail: string) {
  const owner = await prisma.user.findUnique({ where: { id: ownerUserId } });
  if (!owner || owner.role !== "owner") {
    throw new Error("Only an owner can create invites");
  }

  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }

  const existing = await prisma.invite.findUnique({ where: { email } });
  if (existing) return existing;

  return prisma.invite.create({
    data: {
      email,
      invitedByUserId: ownerUserId,
      token: randomBytes(24).toString("hex"),
    },
  });
}

// Stamp acceptedAt on the invitee's first sign-in (idempotent — only flips an
// open invite). Safe to call for non-invited emails (no-op).
export async function markInviteAccepted(email: string | null | undefined) {
  if (!email) return;
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  await prisma.invite.updateMany({
    where: { email: normalized, acceptedAt: null },
    data: { acceptedAt: new Date() },
  });
}
