# Magic-link email auth + allowlist (GitHub #9)

Replace password (Credentials) login with Auth.js v5 **Nodemailer email magic-link**, gated to a single allowlisted address. Auth.js v5 + Prisma adapter already wired (`src/lib/auth.ts`, `auth.config.ts`, `proxy-auth.ts`); `VerificationToken` table already exists in the schema.

## CRITICAL — data ownership
The migrated data is owned by the `User` row with email `owner@distill.me`. Magic-link will sign in as `clarezoe@gmx.com` → a DIFFERENT user → no data. So: **rename the existing owner User's email `owner@distill.me` → `clarezoe@gmx.com`** (keep the same `id`, all FKs intact). Do it locally now and on the cloud DB at deploy. The seed should also use `clarezoe@gmx.com` going forward.

## Build
- **Dep**: `nodemailer` (+ `@types/nodemailer` dev).
- **Auth.js Email provider** (`src/lib/auth.ts`): add the Nodemailer provider:
  - `server` from env (SMTP_HOST/SMTP_PORT/SMTP_SECURE/SMTP_USER/SMTP_PASS), `from` = SMTP_FROM.
  - In dev / when SMTP is unset: a custom `sendVerificationRequest` that `console.log`s the magic URL (so local login never needs real email — avoids lockout during dev).
  - **Remove the Credentials provider** (password login dropped per #9). Keep `bcryptjs`? It's now unused — remove its import/use here.
- **Allowlist** (`signIn` callback in `auth.ts` or `auth.config.ts`): allow sign-in ONLY when the email is in `AUTH_ALLOWLIST` (comma-separated env, default `clarezoe@gmx.com`), case-insensitive. Return false otherwise → Auth.js shows access-denied.
- **Session**: keep the existing JWT strategy + the jwt/session/authorized callbacks (proxy unchanged). Email provider works with JWT.
- **Login page** (`src/app/login/page.tsx`): replace the email+password form with an **email-only** form → server action calls `signIn("nodemailer", { email, redirectTo: "/" })`; show a "check your email for the sign-in link" confirmation state. i18n the new strings (en + zh in `messages/`).
- **Seed** (`prisma/seed.ts`): create/upsert the owner as `clarezoe@gmx.com` (no password needed for magic-link, but keep the upsert idempotent; passwordHash optional/null).
- **Env**: `.env.example` — add `AUTH_ALLOWLIST`, `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`. Real secrets pulled into `/opt/distill/.env.deploy` at deploy (from `~/My Apps/cc-proxy/.env`) — NOT committed.

## Acceptance Criteria
- [ ] Entering `clarezoe@gmx.com` on /login sends (or dev-logs) a magic link; clicking it signs in and lands authenticated owning the existing project/data.
- [ ] Any other email is rejected (allowlist).
- [ ] The existing owner User is renamed to `clarezoe@gmx.com` — all migrated data (96 materials etc.) still owned by the signed-in user.
- [ ] Credentials/password login removed; no password UI.
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green; existing 116 tests pass.
- [ ] No lockout: dev logs the link when SMTP unset; prod uses real SMTP.

## Invariants / notes
- Auth proxy/gating unchanged (JWT). Don't touch the i18n/theme/PWA work.
- VerificationToken table already present — no new migration needed for auth (the email/rename is data, not schema).
- Secrets never committed; allowlist + SMTP via env.
- Deploy: after merge, pull SMTP_* from cc-proxy/.env into the cloud .env.deploy, rename the cloud owner email, redeploy. (Main agent handles deploy + the email rename SQL on both DBs.)
