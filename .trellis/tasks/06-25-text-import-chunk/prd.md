# Auto-chunk large materials in the plain-text Import path

GitHub issue #5. Found in real use: a 1.1MB `MY_MESSAGES.txt` imported via the "Paste or upload .txt/.md" path became ONE RawMaterial (~280k tokens) → Analyze LLM call returned **502** (provider gateway choked). The Google Chat JSON path chunks; the generic text/paste path does not.

## Goal
When pasted/uploaded text is large, split it into multiple analyzable RawMaterials (target ~12k chars, hard max ~20k) on line boundaries. Small text → still 1 material. Each Analyze call then stays within model context.

## Build (reuse existing patterns; follow `.trellis/spec/`)

### 1. Pure generic chunker — `src/lib/import/chunk-text.ts`
- `chunkText(text: string, opts?: { targetChars?: number; maxChars?: number }) → { content: string; part: number; partsTotal: number }[]`
- Split ONLY on line boundaries (`\n`): accumulate lines until reaching `targetChars` (default 12_000); never exceed `maxChars` (default 20_000) except a single line longer than `maxChars` becomes its own chunk (never split mid-line).
- Small text (≤ target) → exactly 1 chunk. Empty/whitespace-only → 0 chunks (caller handles). Mirror the boundary/budget logic of `src/lib/import/chunk.ts` (conversation chunker) but operating on raw lines, not turns.
- PURE, unit-tested: budget respected, no mid-line split, oversized single line isolated, small text → 1 chunk, multi-chunk part/partsTotal correct.

### 2. Apply in the materials service — `src/lib/services/materials.ts`
- Add `createMaterials(projectId, data)` (or extend `createMaterial`): if `content.length` exceeds a threshold (e.g. > maxChars), run `chunkText` and create one RawMaterial per chunk; else create one as today. Each chunk material: same sourceType/language/contextIds; `source_metadata` gains `{ part, partsTotal }` (merged with any caller metadata). Returns the created materials (array) + count.
- Keep `createMaterial` (single) working for callers that don't need splitting, or have it delegate. Don't break the Google Chat path (it already chunks via its own service — leave it).

### 3. Wire the API + UI
- `POST /api/materials` (the plain-text path): use the chunking create; respond with how many materials were created (e.g. `{ created: N, ids: [...] }` or the array). Auth + ownership + zod unchanged.
- `import-client.tsx` ("Paste or upload .txt/.md"): after submit, surface "Created N materials" when N>1 so the user understands a big paste became several. The Analyze flow already works per-material.

## Acceptance Criteria
- [ ] Importing a >100k-char `.txt`/paste yields multiple materials, each ≤ ~20k chars; each Analyzes without 502/context overflow.
- [ ] Small text still → exactly 1 material (no behavior change for normal use).
- [ ] `part`/`partsTotal` recorded in source_metadata for split materials.
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green; `chunkText` unit-tested (incl. no-mid-line-split + oversized line).

## Out of scope
- Re-chunking already-imported oversized materials (user can re-import). Note it; don't build.
- Token-accurate splitting (char budget is a good-enough proxy). 
- Touching the Google Chat importer (already chunks).

## Notes
- Auth + project ownership unchanged on the route; secrets server-side; raw never discarded (splitting preserves all text across chunks — assert total content round-trips).
