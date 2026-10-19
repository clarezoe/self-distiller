# Agent import CLI

`distill-import.mjs` sends writing samples from a JSONL file to the token-authenticated
`POST /api/materials/import` endpoint. It is a zero-dependency Node script.

```bash
DISTILL_URL=https://distill.example.com \
DISTILL_IMPORT_TOKEN='token-from-Settings' \
node scripts/distill-import.mjs --project <project-id> samples.jsonl
```

Use `--dry-run` to validate and count entries locally without making a network call.
The project is identified by ID; the token-authenticated API intentionally does not
provide project-name lookup. `--batch-size N` controls request batches (1–100), and
`--create-missing-contexts` permits unknown `contextNames` to be created as language
contexts (the app's default context type) and reused within the import.

Each non-empty JSONL line is one object with `sourceType` and `content`, plus optional
`language`, `contextIds`, `contextNames`, `materialTime`, and `sourceMetadata`. Repeated
content is skipped by the server using the project's content hash. Invalid lines are
reported by their JSONL line number; the process exits non-zero if any line fails.

The caller is responsible for cleaning boilerplate before import. Calls to action,
signatures, hashtags, and similar text are imported verbatim and may become part of
the learned style. `sourceMetadata.note` is retained as provenance metadata and is
shown in the materials list, but is not currently consumed as analyzer instructions.

The CLI only prints aggregate created/skipped/failed counts and line numbers. It never
prints material content or the import token. Generate and revoke the token in Settings;
it is separate from the read-only persona token.
