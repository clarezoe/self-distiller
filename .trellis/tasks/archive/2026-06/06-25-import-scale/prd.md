# Import scale: chunk large conversations, raise cap, batch upload

Follows the committed Google Chat importer (`781430f`). Real Takeout testing showed: parser is correct, but (a) the biggest single DM `messages.json` is 30MB > the 20MB upload cap → 413-rejected, and (b) a 30MB conversation as ONE RawMaterial is unusable for Analyze (far past the LLM context window). Reuse `src/lib/import/google-chat.ts` (validated) and the existing materials service.

## Requirements

### 1. Chunk large conversations (core)
- After parsing, split each conversation's `turns` into chunks with a target budget (~12,000 chars; hard max ~20,000), splitting ONLY on turn boundaries (never mid-message). A small conversation → 1 chunk/material.
- Each chunk → one `RawMaterial` (sourceType `chat`): content = the labeled turns (`me:` / `<other>:`) for that chunk; the owner's lines remain the style signal.
- `source_metadata` per material: `{ source: "google_chat_takeout", spaceName, part: i, partsTotal: N, dateRange: <chunk's first/last ts>, participants, ownerKey }`.
- Put the chunker in `src/lib/import/google-chat.ts` (or a sibling) as a PURE function `chunkConversation(turns, ownerKey, opts) → ChunkedMaterial[]`. Unit-test: boundary preservation, budget respected, part metadata, owner labeling per chunk, single-chunk small convo.

### 2. Raise upload cap
- Parse + commit routes: raise the total-payload cap from 20MB to **64MB** (chars) so heavy DM files aren't rejected. Keep a clear 413 above that. Server-side `request.json()`/`text()` in App Router has no 4MB Pages limit; fine for self-host.

### 3. Batch / multi-file upload
- Ensure the Google Chat import client's file input has `multiple` and the flow parses all selected files together (participants merged across files — parser already does this). Show a per-conversation summary (name, turn count, # chunks/materials it will create) before commit.

## Acceptance Criteria
- [ ] A ~30MB-class `messages.json` parses + commits without 413; produces multiple materials, each ≤ ~20k chars, correctly labeled, with `part`/`partsTotal` metadata.
- [ ] Small conversation still → 1 material.
- [ ] Multiple files can be selected + imported in one go.
- [ ] Each produced material round-trips into the existing Analyze flow.
- [ ] typecheck/lint/build/test green; `chunkConversation` unit-tested.

## Notes / out of scope
- A huge DM chunks into many materials — that's fine (DB rows are cheap; Analyze is opt-in per material). Materials-list pagination is a later concern; note it, don't build it.
- Don't change parser field-mapping (validated against the real export).
- Auth + ownership unchanged on routes; secrets server-side.
