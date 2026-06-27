-- Multi-user: invite-only auth + per-user persona token (GitHub #13).
-- Additive / nullable so existing rows stay owned by the current owner.

-- Per-user persona API token hash (sha256 hex). Null until generated.
ALTER TABLE "User" ADD COLUMN "personaTokenHash" TEXT;

-- Invite-only allowlist.
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invite_email_key" ON "Invite"("email");
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
CREATE INDEX "Invite_invitedByUserId_idx" ON "Invite"("invitedByUserId");
