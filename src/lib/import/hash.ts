// Content-hash helpers for import dedup.
//
// Why: nothing deduped imports before — re-importing the same data created
// duplicate RawMaterials, double-analyzed them, and inflated evidence frequency
// so the frequency-weighted Self Model (PRD §15.2) treated repeats as stronger
// patterns. We hash NORMALIZED content so cosmetic whitespace differences (CRLF
// vs LF, trailing spaces) don't defeat the dedup, and so a chunked piece hashes
// consistently however it was produced.
//
// PURE: no DB, no IO. Unit-tested.

import { createHash } from "node:crypto";

/**
 * Normalize text for hashing/dedup comparison:
 * - CRLF / CR line endings → LF
 * - strip trailing whitespace on each line
 * - trim leading/trailing whitespace of the whole string
 *
 * The same helper is reused for evidence-text dedup so both layers compare on
 * an identical, whitespace-insensitive basis.
 */
export function normalizeForHash(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

/** SHA-256 hex digest of the normalized text. */
export function contentHash(text: string): string {
  return createHash("sha256").update(normalizeForHash(text), "utf8").digest("hex");
}
