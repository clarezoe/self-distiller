# Backend Quality Guidelines

Real conventions from the Foundation build. Match these exactly in later phases.

## Stack reality (post-training-cutoff — do not guess)
- **Next.js 16** App Router. `middleware` is renamed to **`proxy.ts`** (`export { x as proxy }`, matcher config). `params`, `searchParams`, `cookies()`, `headers()` are **async — await them**. `next lint` removed (use `eslint`). Read `node_modules/next/dist/docs/` before novel Next usage.
- **Prisma 7** with **driver adapters**: client built to `src/generated/prisma` (import `@/generated/prisma/client`). No `datasourceUrl` option — runtime client uses `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })` (see `src/lib/db.ts`). `url` lives in `prisma.config.ts`, not the schema. Enums are const objects, not TS enums.
- **Auth.js v5 beta**. Split config: `src/lib/auth.config.ts` (lightweight, no Prisma — used by `proxy.ts` via `src/lib/proxy-auth.ts`) and `src/lib/auth.ts` (full, adapter + Credentials). NEVER import Prisma/bcrypt into the proxy bundle.

## Layering
- `app/` routes → `app/api/*/route.ts` (REST per PRD §18) OR server actions (`"use server"`) for UI mutations → `src/lib/services/*` (DB logic) → `src/lib/db.ts` (Prisma) → Postgres.
- **Business logic lives in `src/lib/services/`**, not in route handlers or pages. Routes/actions = auth + validation + call service.
- LLM work goes through `src/lib/llm` (`runAgent`) — never call provider SDKs directly from features.

## Auth + tenancy (enforce every time)
- Every route handler / server action: `const user = await getCurrentUser(); if (!user) return 401 / null`. The proxy gates pages but **always re-check in handlers/actions** (defense in depth).
- All domain rows are scoped by `projectId`; verify ownership with `getProjectForUser(userId, projectId)` before any read/write that takes a client-supplied id. Never trust ids from form/body without the ownership check.
- User-level rows (`LlmSettings`, `Credential`) keyed by `userId`.

## Validation & errors
- Validate request bodies with **zod** `safeParse`; return `400` with `parsed.error.flatten()` on failure. Use explicit string-literal enums in zod (`z.enum(["language", ...])`), cast to the Prisma enum type.
- Route handlers return `NextResponse.json(data, { status })`. Throw → handle; never leak stack traces to clients.

## Core invariants (PRD §23 — non-negotiable)
- Model updates are **proposals**; a new immutable `SelfModel` version is created only after explicit user approval. Never mutate an existing `SelfModel` row.
- Evidence is traceable (`EvidenceItem` → `rawMaterialId`); raw material is never deleted on analysis.
- `BlindCalibration.hiddenAgentAnswer` is **never returned to the client** before `userAnswer` is submitted.
- Draft Mode only — no auto-send. Sensitive-topic scenarios route to user takeover.
- Secrets (`Credential.secret`) are AES-256-GCM encrypted at rest (`src/lib/crypto.ts`) and never selected into client-facing responses.

## LLM calls
- Use `runAgent({ userId, projectId?, agentRole, messages, schema?, ... })`. It resolves provider/model (per-agent override → user default → fallback), calls the adapter, and logs raw+parsed to `LlmCallLog`. Always pass a `schema` for structured output. Store prompts under `src/lib/prompts/`, mirroring PRD §14.

## Definition of done (every change)
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` all green. Add vitest unit tests for pure logic (services with branching, parsers, model-merge). DB/LLM-coupled code: extract pure helpers and test those.
