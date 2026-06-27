// Email sign-in allowlist. Magic-link auth (GitHub #9) gates sign-in to a small
// set of addresses configured via AUTH_ALLOWLIST (comma-separated). Pure helper
// so it can be unit-tested without Auth.js / DB.

export const DEFAULT_ALLOWLIST = "clarezoe@gmx.com";

/**
 * Parse a comma-separated allowlist env value into a normalized set of emails.
 * Trims whitespace, lowercases, drops empties.
 */
export function parseAllowlist(allowlistEnv: string | undefined): string[] {
  return (allowlistEnv || DEFAULT_ALLOWLIST)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/**
 * Returns true only if `email` is present in the allowlist (case-insensitive).
 * Falsy / malformed emails are rejected.
 */
export function isAllowedEmail(
  email: string | null | undefined,
  allowlistEnv: string | undefined,
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return parseAllowlist(allowlistEnv).includes(normalized);
}

/**
 * Invite-only sign-in decision (GitHub #13). Pure so it can be unit-tested
 * without Auth.js / DB. Allow sign-in when the email is ANY of:
 *  - `isUser`: already an existing User (a current member), OR
 *  - `isInvited`: has an open Invite (not yet accepted), OR
 *  - in the bootstrap env `AUTH_ALLOWLIST` (so the first owner can sign in
 *    before any invite exists).
 * Falsy / empty emails are always rejected.
 */
export function isSignInAllowed(
  email: string | null | undefined,
  opts: { isUser: boolean; isInvited: boolean; bootstrapEnv: string | undefined },
): boolean {
  if (!email || !email.trim()) return false;
  if (opts.isUser) return true;
  if (opts.isInvited) return true;
  return isAllowedEmail(email, opts.bootstrapEnv);
}
