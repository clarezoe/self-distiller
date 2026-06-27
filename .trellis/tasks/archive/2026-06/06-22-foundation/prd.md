# Foundation: scaffold, schema, auth, LLM layer

Parent architecture: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md) (decisions D1–D6).
Product source of truth: `docs/self_distiller_prd_en.md`.

## Goal

Stand up the Self Distiller skeleton so every later phase (Import, Interview, Calibration, Output) has auth, data, and an LLM layer to build on. No product features yet — just the foundation that makes the first structured LLM call work end-to-end behind a logged-in user.

## Requirements

### R1 — Project scaffold
- Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui initialized.
- Zustand + React Hook Form installed and wired with a trivial example each.
- ESLint + Prettier + `tsc --noEmit` scripts; `npm run lint` / `typecheck` / `build` all green.
- Base layout + nav shell for the 9 PRD sections (Dashboard, Import, Interview Studio, Calibration, Self Model, Contexts, Tasks, Versions, Settings) — nav present, pages can be stubs.
- `.env.example` documenting every env var; `README.md` with local run + Docker steps.

### R2 — Database (Prisma + Postgres)
- Prisma + PostgreSQL, connection-string driven (`DATABASE_URL`); local dev via Docker Compose (app + Postgres).
- Full schema migrated (whole-MVP, not just Foundation tables), so later phases add no core migrations:
  - **Auth.js**: `User`, `Account`, `Session`, `VerificationToken`.
  - **Config**: `LlmSettings` (userId, defaultProvider, defaultModel, agentOverrides JSON), `Credential` (userId, provider, encrypted secret, label).
  - **Domain (PRD §11)**: `Project`, `Context`, `ContextCombination`, `RawMaterial`, `EvidenceItem`, `SelfModel`, `Interview`, `BlindCalibration`, `ModelUpdate`, `TaskOutput`.
- `SelfModel` stores §12 nested JSON in JSONB columns; immutable rows (version + status active|archived).
- Tenancy: domain rows scoped by `projectId` (Project.userId); user-level tables carry `userId`.
- Seed script: one OWNER user + a demo Project.

### R3 — Auth (Auth.js / NextAuth)
- Auth.js with Prisma adapter; Credentials provider for the single OWNER (password bcrypt-hashed, from env/seed).
- `lib/auth/getCurrentUser()` seam returning the session user server-side; protected routes/handlers redirect/401 when unauthenticated.
- Login + logout UI. OAuth/email providers NOT enabled now but config left pluggable.

### R4 — LLM layer (`lib/llm`)
- One interface: `complete({ messages, schema?, model?, agentRole? }) → { parsed, raw }`.
- Adapters:
  - `providers/openai-compatible.ts` — `base_url` + `api_key`; structured output via `json_schema`; covers OpenAI / OpenRouter / local.
  - `providers/anthropic.ts` — Anthropic SDK; structured output via tool-use / `output_config.format`. (Claude OAuth-via-SDK path flag-gated by `SELF_HOST`, may stub the OAuth branch this phase and ship API-key branch.)
- Model resolution per D6: agentOverride → user default → hard fallback.
- Every call persists raw + parsed response for debugging (log table or file).
- `ChatGPT subscription` shows in provider UI as **disabled** with a tooltip routing to OpenAI-compatible.

### R5 — Credentials + crypto
- `lib/crypto` symmetric encryption (key from `ENCRYPTION_KEY` env) for `Credential.secret` at rest.
- Settings UI: pick provider + model, enter/save credential, test-connection button that makes one real `complete()` call.

### R6 — Project + Context CRUD
- API routes + minimal UI: create/list/edit Project; create/list/edit Context (type: language|role|relationship|scene, name, description, metadata JSON) and ContextCombination.
- All scoped to current user; matches PRD §18.1/§18.2 API shapes.

## Acceptance Criteria

- [x] `lint`, `typecheck`, `build` all green. (also: 11 vitest tests pass)
- [~] `docker compose up` brings up app + Postgres; migrations apply; seed creates OWNER. — Dockerfile + compose (postgres/migrate/app) written; **image build NOT verified (no Docker daemon in env)**. Migrations + seed verified against local Postgres.
- [x] Can log in as OWNER and log out. — verified end-to-end (CSRF → 302 → session returns owner id+role); logout wired via signOut action.
- [x] Can create a Project, add Contexts (all 4 types) and a ContextCombination — persisted, user-scoped. — verified via API (POST 201, GET returns row, unauth blocked 307).
- [x] Settings: save an OpenAI-compatible credential (encrypted at rest) and select provider/model. — UI + service built; crypto round-trip/tamper unit-tested.
- [~] Test-connection makes one real structured LLM call and returns schema-valid parsed (raw + parsed persisted). — built (runAgent + LlmCallLog); **not verified live (no real API key available)**.
- [x] Anthropic adapter callable with the same interface (API-key path). — implemented + typechecks; resolver/adapter unit-tested.
- [x] No product-phase tables missing — full MVP schema migrated; later phases need zero core migrations.

### Verified green this session
typecheck · eslint · `next build` (standalone, server.js emitted) · 11 vitest tests · dev boot (proxy gating, no Prisma-in-middleware crash) · auth login flow · project/context CRUD.

### Not verified (environment limits)
Docker image build (no daemon) · live LLM test-connection (no API key).

### Deferred to follow-up (small)
Zustand/RHF demo wiring — app standardized on **server actions + native forms** for server mutations; zustand/RHF available for client-heavy phases (Interview chat, Calibration). Logout click-test (action wired).

## Definition of Done

- Tests for `lib/llm` adapter selection/schema parsing + `lib/crypto` round-trip.
- Lint/typecheck/build green; migrations checked in.
- `.env.example` + README updated.
- Secrets never sent to client; LLM calls server-side only.

## Out of Scope (this phase)

- Import analyzer, interviews, calibration, output generation (later subtasks).
- OAuth/email login providers, S3 storage, ChatGPT-subscription backend, multi-user UX.

## Technical Notes

- Dir structure per PRD §17.4 + `lib/auth`, `lib/crypto`, `lib/storage`.
- Research: [`../06-22-self-distiller-mvp/research/claude-oauth-sdk.md`](../06-22-self-distiller-mvp/research/claude-oauth-sdk.md), [`../06-22-self-distiller-mvp/research/chatgpt-subscription-auth.md`](../06-22-self-distiller-mvp/research/chatgpt-subscription-auth.md).
- Latest Claude model ids for the Anthropic adapter default: `claude-sonnet-4-6` (general), `claude-opus-4-8` (hard reasoning).
