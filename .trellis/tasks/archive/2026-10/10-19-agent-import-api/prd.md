# Agent import API, sourceMetadata, and CLI

Source: [issue #38](https://github.com/clarezoe/self-distiller/issues/38). User (2026-10-19): "继续做38".
The issue body is the full requirement; this PRD records decisions and acceptance.

## Decisions

- **Separate route `POST /api/materials/import`**, not a Bearer branch on `POST /api/materials`.
  Why: session gating in `src/lib/auth.config.ts` is path-based. Excluding a dedicated path keeps the
  session route fully gated, and the two auth models never share one handler.
- **Write token = new nullable column `User.importTokenHash`** (SHA-256 hex, same hashing as the persona token).
  Generated and revoked in Settings next to the persona token. The persona token and `PERSONA_API_TOKEN`
  must never authorize imports. Additive migration, written by hand, applied manually in production
  (see `deploy/README.md`).
- **Provenance:** every material imported through the token path gets `sourceMetadata.importedVia = "import-token"`
  plus `importedAt` (ISO). Caller metadata keys cannot override these two.
- **`sourceMetadata` cap:** 4096 bytes of `JSON.stringify` output. Over the cap: 400 on the session route,
  per-item error on the bulk route.
- **Batch:** max 100 items per request; max request body governed by the existing content limits per item.
  Per-item validation errors never fail the whole batch.
- **`contextNames`:** resolved case-insensitively within the project. Unknown names → per-item error unless
  `createMissingContexts: true`, then created once (type `custom`… use the existing default context type
  the app uses for user-created contexts) and reused within the batch.
- **Rate limit:** simple in-memory per-user limiter on the import route (e.g. 30 requests/minute) → 429.
- **Analyzer scope:** preserve and display `sourceMetadata.note`, but do not forward it into the analyzer in this task. Document that provenance notes are not verified facts and do not change analysis. Jev scope decision (2026-10-19): preserve/document 1.00, forward now 0.00, stop for human decision 0.00; confidence 1.00.

## Requirements

### Part 1 — `sourceMetadata` on `POST /api/materials`
- Accept optional `sourceMetadata` (plain JSON object), size-capped; pass to `createMaterials`.
- Chunked materials (> `SPLIT_THRESHOLD`) keep it on every chunk (already true in the service; add test).
- Materials list shows metadata read-only; `url` / `sourceUrl` rendered as a safe external link (http/https only).

### Part 2 — `POST /api/materials/import`
- Auth: `Authorization: Bearer <token>` → sha256 → `User.importTokenHash`. Missing/unknown/revoked/persona
  token → 401. Project not owned by that user → 404.
- Body: `{ projectId, createMissingContexts?, materials: [{ sourceType, content, language?, contextIds?, contextNames?, materialTime?, sourceMetadata? }] }`.
- Response: `{ created, skipped, ids, errors: [{ index, error }] }`. Dedup via existing `contentHash`.
- Excluded from session gating in `auth.config.ts`, like `/api/persona`.
- Settings: generate (shown once), status, revoke for the import token; en/zh i18n.

### Part 3 — CLI `scripts/distill-import.mjs`
- Zero-dependency Node, same style as `scripts/persona-pull.mjs`.
- Env `DISTILL_URL`, `DISTILL_IMPORT_TOKEN`. Usage:
  `node scripts/distill-import.mjs --project <id> <file.jsonl> [--dry-run] [--create-missing-contexts] [--batch-size N]`.
  Project by id (name lookup would need a project-list endpoint on the token path; out of scope, documented).
- `--dry-run`: local validation only, prints counts per `sourceType`/`language`, no network (testable: export
  pure functions, network only in `main`).
- Output counts only: created / skipped / failed with JSONL line numbers. Never prints content or token.
- Exit non-zero if any line failed (local parse or server error).
- Help text warns: caller is responsible for cleaning boilerplate (CTAs etc.) — it becomes "style".
- Document in `README.md` and an agent-facing note (similar to `mcp/README.md`).

## Acceptance (from issue)
- `POST /api/materials` stores `sourceMetadata`; unchanged without it; oversized → 400.
- Chunked material keeps `sourceMetadata` on every chunk.
- Import endpoint rejects missing token, revoked token, persona token, other user's project — each tested.
- Batch with one invalid item imports the rest and reports that index.
- Re-run of same input: created 0, all skipped.
- `contextNames` resolves; unknown rejected unless create flag.
- CLI `--dry-run` makes no network call (test).
- CLI prints no content and no token (test).
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass.
- Migration documented.

## Verification and delivery state (2026-10-19)

- Implementation and independent review completed locally on `feat/agent-import-api`.
- Review fixed route-prefix overmatching, an invalid Next.js route export, credential-bearing metadata links, token-action identity checks, CLI URL validation, raw server error output, redirect following, malformed response handling, and per-item runtime failure isolation.
- Final reviewer run: lint and typecheck passed; full suite passed (41 files, 259 tests); production build passed.
- Parent verification after the final fixes: targeted CLI/service/route/body-limit suite passed (4 files, 30 tests); `git diff --check` passed.
- README, agent-facing CLI usage, migration runbook, and backend code-spec updated.
- No real database import, browser token-generation flow, or production migration/deployment was performed. The first consumer's 28-material bundle has not been imported.
- No commit, push, or PR yet. Commit and production release require user authorization; `.claude/settings.local.json` stays excluded.

## Out of scope
- MCP `import_materials` tool (optional follow-up in the issue).
- Content cleaning.
