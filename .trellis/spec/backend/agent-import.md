# Agent Material Import

## 1. Scope / Trigger

Use this contract when changing material ingestion, import credentials, provenance, or the JSONL CLI. This path crosses Settings, authentication, API validation, Prisma storage, and the materials UI.

## 2. Signatures

- `POST /api/materials`: existing session-authenticated material creation, with optional `sourceMetadata`.
- `POST /api/materials/import`: dedicated Bearer-authenticated bulk import.
- `User.importTokenHash String?`: SHA-256 digest of a separate write token. Never store the plaintext token.
- `node scripts/distill-import.mjs --project <id> <file.jsonl> [--dry-run] [--create-missing-contexts] [--batch-size N]`.

Keep the write route separate from the session route. An exemption from session middleware is not authorization; the import handler must authenticate every request itself.

## 3. Contracts

Bulk request:

```json
{
  "projectId": "project-id",
  "createMissingContexts": false,
  "materials": [
    {
      "sourceType": "other",
      "content": "A writing sample.",
      "language": "en",
      "contextNames": ["Personal writing"],
      "sourceMetadata": {"sourceUrl": "https://example.com/post"}
    }
  ]
}
```

- At most 100 materials per request. Validate each item independently.
- Optional item fields also include `contextIds` and `materialTime`.
- `sourceMetadata` must be a JSON object, at most 4096 UTF-8 bytes after JSON serialization.
- Resolve context names case-insensitively within the owned project. Unknown names require `createMissingContexts: true`.
- Return `{ created, skipped, ids, errors: [{ index, error }] }`; indexes are zero-based within the submitted batch.
- Use the existing per-project content hash for deduplication and preserve metadata on every generated chunk.
- Server-controlled `importedVia: "import-token"` and ISO `importedAt` override caller-supplied provenance values.
- The CLI uses `DISTILL_URL` and `DISTILL_IMPORT_TOKEN`; project arguments are IDs, not names.
- Dry-run performs local validation and no network calls. Output contains counts and failed JSONL line numbers, never material text or credentials.
- Display metadata read-only. Only HTTP(S) metadata URLs may be clickable.
- Metadata notes are retained, not forwarded to the analyzer. Notes do not establish factual truth and cannot be relied on to change analysis.

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Missing, invalid, revoked, or persona-only token | HTTP 401 |
| Project absent or not owned by authenticated user | HTTP 404 |
| Invalid bulk envelope or more than 100 items | HTTP 400 |
| Invalid individual item or foreign context | Indexed item error; continue valid items |
| Unknown context name without creation flag | Indexed item error |
| Oversized metadata on session route | HTTP 400 |
| Oversized metadata in bulk item | Indexed item error |
| Existing identical content in same project | Skipped, not duplicated |
| Import rate limit exceeded | HTTP 429 |
| CLI local or server item failure | Non-zero exit status |

The in-memory limiter is process-local, not a distributed quota. Do not claim it survives restarts or applies globally across replicas.

## 5. Good / Base / Bad Cases

- **Good:** an owned project receives valid samples with known context names; a second identical import creates nothing and reports skips.
- **Base:** session import omits metadata and retains existing behavior. Agent dry-run needs no authenticated browser session and sends no requests.
- **Bad:** a persona read token attempts an import, or a valid import token names another user's project. Neither may write material.
- **Mixed:** one batch contains valid and invalid items. Valid items persist and invalid indexes map back to the original JSONL lines.

## 6. Tests Required

- Route tests: missing/revoked/persona token rejection, project ownership, invalid envelope, rate limit, and mixed item results.
- Service tests: context ownership, case-insensitive name matching, opt-in context creation, deduplication, metadata limits, and non-overridable provenance.
- Chunk tests: every chunk retains source metadata and existing chunk fields.
- CLI tests: no fetch during dry-run, stable original line numbers across batches, non-zero failures, and no plaintext material/token in output, including malicious error responses.
- Regression checks: session-gated routes remain gated; en/zh messages remain aligned; lint, typecheck, tests, and build pass.
- Production migration is additive and manual. Follow the deployment runbook; local tests are not evidence that production migrated or deployed.

## 7. Wrong vs Correct

**Wrong:** reuse `PERSONA_API_TOKEN` for writing because it already resolves an owner.

**Correct:** resolve only `User.importTokenHash`, then independently verify project ownership. Read and write capabilities must remain separate.

**Wrong:** spread caller metadata after the server's audit fields.

```ts
const metadata = { importedVia: "import-token", ...callerMetadata };
```

**Correct:** apply the server's audit fields last.

```ts
const metadata = {
  ...callerMetadata,
  importedVia: "import-token",
  importedAt: new Date().toISOString(),
};
```
