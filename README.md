# Self Distiller

A personal expression modeling app: learn how you write/decide across languages, roles, relationships, and scenarios, then draft replies that sound like you. Built around imported materials, role interviews, blind calibration, and task feedback. See `docs/self_distiller_prd_en.md`.

> Status: **Foundation** phase. Auth, data layer, and the LLM provider layer are in place; product phases (Import, Interview, Calibration, Output) come next.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS 4** + shadcn/ui primitives
- **Prisma 7** + **PostgreSQL** (pg driver adapter — no engine binary)
- **Auth.js v5** (NextAuth) — Credentials (single owner) now, OAuth-ready
- Provider-agnostic LLM layer: **OpenAI-compatible** + **Anthropic** adapters (user-selectable)
- Vitest for unit tests

## Prerequisites

- Node.js ≥ 20.19 / 22.12 / 24+
- pnpm 9+
- PostgreSQL (local, Docker, or hosted)

## Local development

```bash
pnpm install
cp .env.example .env          # then fill AUTH_SECRET + ENCRYPTION_KEY (see below)

# Postgres: either run your own, or use Docker:
docker compose up -d postgres # exposes host port 5433

pnpm prisma migrate dev       # apply schema
pnpm db:seed                  # create the OWNER user + a demo project
pnpm dev                      # http://localhost:3000
```

Generate secrets:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY (32 bytes)
```

Sign in with `OWNER_EMAIL` / `OWNER_PASSWORD` from `.env`.

> If you point `DATABASE_URL` at the Docker Postgres, use host port **5433**; if at a local Homebrew Postgres, use **5432**.

## Self-host with Docker

```bash
cp .env.example .env   # fill secrets
docker compose up --build
# postgres → migrate (migrations + seed) → app on http://localhost:3000
```

> Note: the Docker image build has not been verified in this environment (no Docker daemon available at build time). The `pnpm dev` path above is verified.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |
| `pnpm prisma:migrate` | `prisma migrate dev` |
| `pnpm db:seed` | Seed owner + demo project |

## Configuration

LLM provider/model and credentials are configured per-user in **Settings**. Credentials are encrypted at rest (AES-256-GCM via `ENCRYPTION_KEY`) and never sent to the client. The "ChatGPT subscription" option is intentionally disabled — use the OpenAI-compatible backend with an OpenAI/OpenRouter key (see `.trellis/tasks/06-22-self-distiller-mvp/research/`).

## Project structure

```
src/
  app/
    (app)/            # authenticated app shell (dashboard, contexts, settings, …)
    login/            # public login
    api/              # REST route handlers (auth, projects, contexts)
  lib/
    db.ts             # Prisma client (driver adapter)
    crypto.ts         # AES-256-GCM for credentials
    auth.ts           # Auth.js full config (Node)
    auth.config.ts    # lightweight config for the proxy (middleware)
    llm/              # provider-agnostic LLM layer + adapters
    services/         # projects / contexts / settings
  proxy.ts            # route gating (Next 16 middleware)
prisma/               # schema, migrations, seed
```
