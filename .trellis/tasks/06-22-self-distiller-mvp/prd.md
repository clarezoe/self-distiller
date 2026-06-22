# brainstorm: Self Distiller MVP

## Goal

Build the MVP of **Self Distiller** — a personal expression modeling web app that learns how a user writes/decides across languages, roles, relationships, and scenarios, then drafts replies that sound like the user. Source of truth: `docs/self_distiller_prd_en.md`.

The MVP must validate one core loop: round-2 agent reply sounds more like the user than round-1, and the user understands why.

## What I already know

- Greenfield repo. No source code yet. Only `.trellis/`, `.claude/`, `AGENTS.md`, `docs/self_distiller_prd_en.md`.
- PRD recommends: Next.js + React + Tailwind + shadcn/ui, PostgreSQL + Prisma, OpenAI structured JSON, optional pgvector/Redis/S3.
- PRD defines 11 DB tables, 6 LLM agents, MVP feature list (19 items, §8.3), and a 16-step minimum dev loop (§24).
- Core invariants (§23): updates are proposals only; new version only after user approval; versions immutable; evidence traceable; raw material never discarded; context composable (no hardcoded friend/work/zh); hidden answer never shown before user submits; Draft Mode only (no auto-send); sensitive topics force user takeover.
- MVP main path (§8.2): Chinese + close friend chat + casual/comforting/complaining/advice.

## Assumptions (temporary)

- Single-user / self-hosted scope first (the user is building this for themselves).
- LLM provider open to change — global rule says default to latest Claude models for AI apps; PRD says OpenAI. To confirm.
- No payment, no mobile, no browser extension (explicit MVP exclusions §8.3).

## Open Questions

- (none blocking — converging)
- Deploy target detail: Docker Compose layout (defer to Foundation impl).

## Decisions (ADR-lite)

### D1 — Build scope: decompose into phases
**Context**: PRD MVP is 19 features / 5 phases — too large for one task.
**Decision**: This brainstorm locks whole-MVP architecture (stack, full DB schema, agent contracts). Then decompose into 5 subtasks (Foundation → Import → Interview → Calibration → Output). Build Foundation first.
**Consequences**: Each subtask stays shippable/reviewable. Foundation-relevant decisions (LLM provider, auth, DB) are resolved now; product-feature details refined per-subtask later.

### D2 — LLM layer: multi-provider, user-selectable (finalized after research + D3)
**Context**: PRD §17.3 assumes OpenAI; global rule defaults to Claude. User wants the provider chosen at runtime, not hardcoded. Research (`research/*.md`) corrected feasibility.
**Decision**: Provider-agnostic LLM layer (`lib/llm`) exposing one `complete({schema, model, ...})` interface; each backend has its own adapter for structured-JSON output. MVP backends:
1. **OpenAI-compatible API** (`base_url` + `api_key`) — covers OpenAI, OpenRouter, local (Ollama/vLLM). Structured output via `json_schema`. Always available.
2. **Anthropic / Claude** — its own adapter (tool-use / `output_config.format`); NOT covered by the OpenAI-compatible shape. Self-host: may use OAuth-via-SDK (own subscription, `CLAUDE_CODE_OAUTH_TOKEN` / local creds) behind a `SELF_HOST` flag; SaaS: `ANTHROPIC_API_KEY` (BYO/platform).
3. **ChatGPT subscription** — **disabled placeholder** in the UI (no reusable client, ToS ban risk on user account, wrapper graveyard). "I want ChatGPT" → route to backend #1 with an OpenAI/OpenRouter key.
Additional providers pluggable later via new adapters.
**Consequences**: Two real adapters to build (OpenAI-compatible + Anthropic). Need a credential store + provider/model selection setting. Claude OAuth path is self-host-only and flag-gated.

### D3 — Deployment: self-host now, SaaS-ready later
**Context**: Product is intrinsically personal; subscription-OAuth only works single-user/self-host; but we don't want to repaint into a corner.
**Decision**: Build a single-user self-host MVP, but keep the data model **multi-tenant from day one** (`user_id` on every row, pluggable auth). Auth = single-owner now, swappable to real multi-user later. Subscription-OAuth backends gated by a `SELF_HOST` flag.
**Consequences**: Schema discipline now (user_id everywhere). Auth abstraction so a Credentials/owner gate can later become OAuth/Clerk/Auth.js without schema churn. Deploy target likely Docker Compose for self-host.

### D4 — Auth: Auth.js (NextAuth)
**Context**: Need single-owner auth now, multi-user later, no extra service to deploy. Considered Appwrite (user's usual tool) but it's a separate self-hosted backend stack; Auth.js is pure in-app code.
**Decision**: **Auth.js (NextAuth)**, code-only (same process as Next.js). Credentials provider for the single owner now; OAuth/email providers flip on later for SaaS — no schema churn. Prisma adapter stores User/Account/Session in Postgres. Access behind `auth()`/`getCurrentUser()` seam. No Appwrite.
**Consequences**: Zero extra services (app + Postgres only). Adds User/Account/Session tables. `user_id` FK on all domain tables already planned (D3).

### D5 — Data + stack: Postgres + Prisma, Next.js, local files
**Context**: No Appwrite → app owns its data + storage. PRD §17 recommends this stack.
**Decision**: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Zustand + React Hook Form. **PostgreSQL + Prisma** for all domain data (PRD §11 tables, Self Model as JSONB). Connection-string driven (local Docker Postgres for dev → Neon/Supabase/RDS later, free swap). File uploads to **local disk** now, S3-compatible later. Deploy: Docker Compose (app + Postgres) for self-host.
**Consequences**: One DB, JSONB for nested Self Model (§12) — strong fit for version immutability + evidence graph. Storage abstraction so disk→S3 is swappable.

### D6 — LLM config + credential scope: per-user, with per-agent model override
**Context**: User picks provider/model (D2); need where that's stored.
**Decision**: Per-user `llm_settings` (default provider, default model) + optional per-agent-role model overrides (JSON map). Separate `credentials` store (provider → encrypted key/token, encrypted at rest). All 6 agents resolve model via settings → override → default. Self-host Claude-OAuth path flag-gated (D2).
**Consequences**: Adds `llm_settings` + `credentials` to schema. Encryption util in Foundation.

## Requirements (evolving)

- Whole-MVP architecture locked in this brainstorm; implementation decomposed into 5 phase-subtasks; Foundation built first.
- Stack: Next.js (App Router) + TS + Tailwind + shadcn/ui + Zustand + React Hook Form + Prisma + PostgreSQL; files local→S3.
- Auth.js (NextAuth), Credentials provider (single owner) now, OAuth later; Prisma adapter; `getCurrentUser()` seam.
- Provider-agnostic `lib/llm`; per-user provider/model selection + per-agent override; encrypted credential store.
- LLM access via provider-agnostic layer (`lib/llm`); user selects provider/model; backends: OpenAI-compatible API + Anthropic/Claude (real adapters), ChatGPT-subscription disabled placeholder; pluggable for more.
- Single-user self-host MVP with multi-tenant schema (`user_id` everywhere) and swappable auth; subscription-OAuth gated by `SELF_HOST`.

## Technical Approach

### Architecture
- **Monolith**: Next.js (App Router) fullstack — UI + API routes in one app. Server-side LLM calls only (keys never reach client).
- **Layers**: `app/` (routes/pages) → `app/api/` (route handlers) → `lib/` services (`lib/llm`, `lib/prompts`, `lib/self-model`, `lib/model-updates`, `lib/context-router`, `lib/auth`, `lib/storage`, `lib/crypto`) → Prisma → Postgres.
- **LLM layer** (`lib/llm`): one `complete({ messages, schema, model, agentRole })` interface; adapters `providers/openai-compatible.ts` (json_schema) + `providers/anthropic.ts` (tool-use). Model resolved per-agent via D6 settings. All calls log raw + parsed response (PRD §17.3).
- **Invariants enforced in service layer** (PRD §23): updates are proposals; new immutable Self Model version only on user approval; evidence traceable; raw material never deleted; hidden calibration answer withheld until user submits; Draft Mode only; sensitive-topic boundary checks.

### Data model (Prisma / Postgres)
- **Auth.js**: `User`, `Account`, `Session`, `VerificationToken`.
- **Per-user config**: `LlmSettings` (default provider/model + per-agent override JSON), `Credential` (provider → encrypted key/token).
- **Domain (PRD §11, adopted)**: `Project`, `Context`, `ContextCombination`, `RawMaterial`, `EvidenceItem`, `SelfModel` (JSONB blobs §12, immutable, version + active/archived), `Interview`, `BlindCalibration`, `ModelUpdate`, `TaskOutput`.
- **Tenancy**: domain rows scoped by `projectId` (Project → User); user-level tables carry `userId`. SaaS-ready without schema churn (D3).

### Decomposition (5 subtasks, build in order)
1. **Foundation** (build first) — Next.js scaffold, Tailwind/shadcn, Prisma + full schema + migrations, Auth.js single-owner + `getCurrentUser()` seam, `lib/llm` with both adapters + settings/credential store + `lib/crypto`, Project + Context CRUD, base layout/nav. Acceptance: can log in, create a project, add contexts, save LLM provider/creds, and make one structured LLM call end-to-end.
2. **Import + Self Model v0.1** — import UI (paste/.txt/.md), import analyzer agent, evidence extraction, v0.1 generation, Markdown export.
3. **Interview Studio** — interview planner + chat UI + extractor + update proposal.
4. **Blind Calibration** — hidden-answer gen (withheld), user-answer capture, comparator, update proposal, versioning.
5. **Task Output** — context selection, persona router, output generator, feedback capture.

## Acceptance Criteria (evolving)

Brainstorm/architecture acceptance:
- [x] Build scope + decomposition decided (D1)
- [x] LLM provider strategy decided + researched (D2)
- [x] Deploy model decided (D3)
- [x] Auth decided (D4)
- [x] Data/stack decided (D5)
- [x] LLM config/credential scope decided (D6)
- [x] User approves architecture + decomposition
- [x] 5 subtasks created; Foundation subtask has its own PRD
- [ ] Whole-MVP target AC carried forward (PRD §20.1, §24) into subtask PRDs (per subtask, when built)

## Definition of Done (team quality bar)

- Tests added/updated where appropriate
- Lint / typecheck / build green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Out of Scope (explicit)

- Auto WeChat/WhatsApp/Telegram import, auto-send, voice, image, multi-user, payment, enterprise admin, live proxy, browser extension, native mobile (per §8.3).

## Research References

- [`research/claude-oauth-sdk.md`](research/claude-oauth-sdk.md) — Claude OAuth-via-SDK is per-machine single-identity (CLI subprocess), viable only for single-user/self-host; hosted path = API key + own Claude adapter.
- [`research/chatgpt-subscription-auth.md`](research/chatgpt-subscription-auth.md) — ChatGPT-subscription programmatic use = no reusable client, ToS violation (ban hits user account), wrapper graveyard. Drop from MVP; route to OpenAI-compatible.

## Technical Notes

- PRD §11 data model, §12 Self Model JSON schema, §13 agent behavior, §14 prompt templates, §17 stack, §18 API, §22 build phases.
- Recommended dir structure §17.4.
- **D2 correction pending deployment model**: Claude OAuth-via-SDK only works single-user/self-host; ChatGPT-subscription dropped regardless. Final LLM-auth design depends on D3 (below).
