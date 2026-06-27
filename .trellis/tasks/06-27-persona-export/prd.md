# Persona export: API + cache CLI + MCP (#11 + #12)

Expose the distilled persona so other agents (Claude Code, Codex, MCP-aware) consume it. Cloud-first + local offline cache. Builds on the live app (active `SelfModel` per project, `toMarkdown`, magic-link auth).

## Auth
Agents can't do magic-link → use a **static API token**: `PERSONA_API_TOKEN` env (single-user). Endpoint checks `Authorization: Bearer <token>` (constant-time compare). Set the real token in the Dokploy env at deploy (main agent handles). 401 if missing/wrong.

## 1) Export API (#11 v1) — in the app
- `GET /api/persona?format=md|json` (Bearer token):
  - resolve the owner's active project → its active `SelfModel` (404 if none).
  - `format=md` (default) → an **agent-ready system prompt** (see `toSystemPrompt` below), `Content-Type: text/markdown`.
  - `format=json` → the structured `SelfModelJson`.
  - **ETag** = weak tag from `{version, createdAt}` (e.g. `W/"v0.2-<epoch>"`); honor `If-None-Match` → `304` when unchanged. Set `Last-Modified` from the model's createdAt.
  - This route must be PUBLIC to the proxy/middleware (token-gated, not session) — exclude `/api/persona` from the auth `authorized` redirect (like `/api/auth`). Token check happens in the handler.
- `src/lib/persona.ts`:
  - `getActivePersona(): Promise<{ modelJson, version, createdAt } | null>` (owner's active model).
  - `toSystemPrompt(modelJson): string` — PURE. Assemble a system prompt: identity/values/voice summary, per-language/role/relationship/scene guidance, boundaries, "write as the user, not as an assistant". Unit-test it (handles open-ended §12 shapes, no `[object Object]`). Reuse/extend `toMarkdown` ideas but framed as instructions.
  - `checkPersonaToken(header): boolean` (Bearer, constant-time, env `PERSONA_API_TOKEN`). Unit-test.

## 2) Cache CLI (#11 v2)
- `scripts/persona-pull.mjs` (node, no deps): env `DISTILL_URL` + `DISTILL_TOKEN`. Reads stored ETag from `~/.distill/persona.etag`; GETs `${DISTILL_URL}/api/persona?format=md` with `If-None-Match`. 200 → write `~/.distill/persona.md` + etag; 304 → keep; network error → keep existing cached file (offline fallback), exit 0; print the path. Make it idempotent + safe to run on a cron/agent-start.
- Document the one-liner in README/skill.

## 3) MCP server (#12)
- `mcp/persona-mcp.mjs` — minimal MCP stdio server (uses `@modelcontextprotocol/sdk`) exposing tool `get_persona({ format: "md"|"json" })` → does cloud-first fetch (reusing the cache logic: fetch API, fall back to `~/.distill/persona.md`). Env `DISTILL_URL` + `DISTILL_TOKEN`. Add a short README for wiring it into an agent's MCP config.
- Keep it a standalone script (its own package.json under `mcp/` or documented `npx`); it depends on the MCP SDK only.

## Acceptance Criteria
- [ ] `GET /api/persona?format=md` with valid token → 200 system-prompt markdown; wrong/no token → 401; no model → 404; `If-None-Match` match → 304.
- [ ] `format=json` → structured model.
- [ ] `/api/persona` reachable without a login session (token-gated, proxy-excluded).
- [ ] `persona-pull.mjs`: online → writes ~/.distill/persona.md; offline → keeps cached; 304 → no rewrite.
- [ ] MCP `get_persona` returns the persona (cloud-first + cache fallback).
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green; `toSystemPrompt` + `checkPersonaToken` unit-tested.

## Invariants / notes
- Token never logged/returned; constant-time compare. No secrets in git (`.env.example` placeholder `PERSONA_API_TOKEN`).
- Don't break existing auth/proxy; only ADD `/api/persona` to the public-prefix exclusion.
- Reuse `getActiveModel`/`modelRowToJson`/`getActiveProject`.
- Deploy: set `PERSONA_API_TOKEN` in Dokploy env (main agent), then the API is live for agents.
