# Dedup: material content-hash (A) + evidence text (B)

Follows the import work (Google Chat parser, chunking #5). Problem: nothing dedupes. Re-importing the same data → duplicate RawMaterials, double-analyzed, evidence double-counted → frequency-weighted Self Model (§15.2) treats repeats as stronger patterns. Build A + B.

## A — Material content-hash dedup
- Add `RawMaterial.contentHash String?` + `@@unique([projectId, contentHash])` (migration). Hash = SHA-256 of **normalized** content (trim + collapse trailing whitespace per line + normalize line endings — define a single `normalizeForHash` helper so chunked pieces hash consistently).
- `src/lib/crypto.ts` or a new `src/lib/import/hash.ts`: pure `contentHash(text) → string` (sha256 hex).
- `createMaterial` / `createMaterials` (`src/lib/services/materials.ts`): compute hash per material; skip insert when `(projectId, contentHash)` already exists. Return `{ created: RawMaterial[], skipped: number }`. For the chunked path, dedupe within the batch too (two identical chunks in one import).
- Route `POST /api/materials` + Google Chat commit route: surface `skipped` count in the response.
- Backfill: migration sets `contentHash` for existing rows (or leave null + a one-off in the migration). Existing rows nullable-safe.

## B — Evidence text dedup
- In `createEvidenceItems` (`src/lib/services/evidence.ts`): dedupe by **normalized `evidenceText`** (same `normalizeForHash`) — (1) within the incoming batch, (2) against existing evidence in the same project. Skip items whose evidenceText already exists for the project. Return created items + a skipped count.
- Keep it a pure-ish helper `dedupeEvidence(existingTexts: Set<string>, items) → { keep, skipped }` that's unit-tested; the service wires the DB query + the helper.
- Rationale: even with A, overlapping-but-not-identical materials (full DM + a pasted excerpt) produce the same quoted evidence; dedup at the evidence layer stops the same quote inflating confidence.

## Acceptance Criteria
- [ ] Importing the same file/text twice → second import creates 0 new materials, reports `skipped`.
- [ ] Two identical chunks in one import → 1 material.
- [ ] Re-analyzing overlapping materials → identical `evidenceText` not stored twice in a project; skipped count reported.
- [ ] Different content still imports/extracts normally (no false-positive dedup).
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green; `contentHash`, `normalizeForHash`, `dedupeEvidence` unit-tested.

## Invariants / out of scope
- Auth + project ownership unchanged; raw never silently lost (skip = intentional dedup, reported to user, not a silent drop). Dedup is **per project** (same text in two projects is independent).
- No fuzzy/similarity matching (exact normalized match only) — note it; don't build.
- Don't touch the conversation/text chunkers' splitting logic.
