# Multi-user: invite-only + per-user isolation (GitHub #13)

Generalize the single-owner app to multi-user with **invite-only** auth and **per-user data isolation**. The schema is ALREADY multi-tenant (domain rows scoped by `projectId` → `Project.userId`; pages use `getCurrentUser()`), so most isolation exists. This task adds invites, DB-backed allowlist, per-user persona tokens, and removes the remaining single-owner assumptions.

## Current single-owner assumptions to remove
- `src/lib/persona.ts` `getActivePersona()` → `prisma.user.findFirst({ where: { role: "owner" } })` (the ONE owner). Must become per-user (resolved by the persona token).
- `/api/persona` uses one env `PERSONA_API_TOKEN`. Must become per-user tokens.
- `src/lib/auth.ts` allowlist = env `AUTH_ALLOWLIST` only. Must include invited users.

## Build

### Schema (migration; applied local + cloud via redeploy)
- `Invite { id, email @unique, invitedByUserId, token String @unique, createdAt, acceptedAt DateTime? }`.
- `User.personaTokenHash String?` (sha256 of the per-user persona API token; nullable).
- `User.role` already exists (`owner` default) — invited users created as `member`.

### Auth — invite-only allowlist
- `src/lib/allowlist.ts` / `src/lib/auth.ts` `signIn` callback → allow sign-in if the email is ANY of:
  1. an existing `User` (already a member), OR
  2. an open `Invite` (not yet bound / acceptable), OR
  3. in the bootstrap env `AUTH_ALLOWLIST` (so the first owner can sign in before invites exist).
  Else reject (`AccessDenied`). On an invited email's first sign-in, the adapter creates the `User` (role `member`); set the matching `Invite.acceptedAt`.
- Keep it a small tested helper `isSignInAllowed(email, { isUser, isInvited, bootstrap })` (pure) + a DB-backed resolver in the callback.

### Invites (owner-only)
- Service `src/lib/services/invites.ts`: `createInvite(ownerUserId, email)` (role check: only `owner`), `listInvites`, ownership.
- Settings UI (visible only when `currentUser.role === "owner"`): enter an email → create the Invite (random token). v1: the invitee then signs in at `/login` with that email (allowed because the Invite exists) and gets the magic link. Show the invited email in a list with status (pending/accepted).

### Per-user persona token
- `src/lib/persona.ts`: replace the single env token with per-user tokens.
  - `getPersonaForUser(userId)` (rename `getActivePersona`); resolve the user's active project → active SelfModel.
  - `resolvePersonaUser(authHeader)`: hash the Bearer token (sha256), find the `User` with that `personaTokenHash` (constant-time not needed — it's a hash lookup; still don't leak). Returns the userId or null. **Back-compat**: if the Bearer equals the env `PERSONA_API_TOKEN` (still set), resolve to the owner — so the existing live token keeps working.
  - `/api/persona`: resolve user via `resolvePersonaUser` (401 if none) → that user's persona (404 if no model). ETag/304/md/json unchanged but per-user.
- Settings UI: "Generate persona API token" → create a random token, store `personaTokenHash`, show the plaintext ONCE (never again). Regenerate replaces it.

### Isolation audit
- Confirm EVERY domain query is scoped to `getCurrentUser().id` (projects/materials/contexts/interviews/calibrations/tasks/self-model). They already are via `getActiveProject(user.id)` — verify no stray `findFirst()`/owner-implicit query leaks across users. Add a note/test where feasible.

## Acceptance Criteria
- [ ] Owner can invite an email; that email can sign in via magic link; a non-invited, non-user email is rejected.
- [ ] An invited user gets their own empty project/data — cannot see the owner's data (and vice versa).
- [ ] Per-user persona token: each user generates their own; `/api/persona` with user A's token returns A's persona, not the owner's. Env token still resolves to the owner (back-compat).
- [ ] Existing data stays owned by the current owner (clarezoe@gmx.com); migration is additive/nullable.
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green; pure helpers (allowlist resolver, persona token hashing/resolution) unit-tested.

## Invariants / notes
- Row-level isolation: a user must NEVER read another user's rows. Ownership checks via project→userId already enforce this; don't regress.
- Tokens hashed at rest, shown once, never logged.
- Auth/proxy unchanged structurally; `signIn` callback now DB-aware (runs in the Node `auth.ts`, fine).
- Migration nullable/additive (existing rows safe). Deploy applies it via `prisma migrate deploy`.
