# Backend Directory Structure

Actual layout (single Next.js app, `src/`). New backend code goes in these homes.

```
src/
  app/
    api/                      # REST route handlers (PRD §18). One folder per resource.
      <resource>/route.ts     # GET/POST; [id]/<action>/route.ts for sub-actions
  lib/
    db.ts                     # Prisma 7 client singleton (pg driver adapter)
    crypto.ts                 # AES-256-GCM for credential secrets
    auth.ts                   # Auth.js full config (Node) + getCurrentUser/requireUser
    auth.config.ts            # lightweight config (no Prisma) for the proxy
    proxy-auth.ts             # NextAuth instance for proxy.ts
    utils.ts                  # cn() etc.
    llm/                      # provider-agnostic LLM layer
      index.ts                # runAgent + resolveCredential
      resolve.ts              # pure provider/model resolution + adapter map
      types.ts                # Provider, AgentRole, schema types
      providers/              # openai-compatible.ts, anthropic.ts
    prompts/                  # one file per agent prompt (mirrors PRD §13/§14)
    self-model/               # schema, generate, apply, version, markdown, context-subset, + agents
    services/                 # DB/business logic, one file per domain area
  generated/prisma/           # generated client (gitignored) — import @/generated/prisma/client
  proxy.ts                    # Next 16 middleware (route gating)
prisma/                       # schema.prisma, migrations/, seed.ts
prisma.config.ts              # Prisma 7 CLI config (schema path, datasource url)
```

Rules:
- **Route handler / server action** → thin: auth + zod + delegate to a `services/` or `self-model/` function. No business logic or raw Prisma in routes/pages.
- **Domain logic** → `src/lib/services/<area>.ts` (project-scoped, ownership-checked) or `src/lib/self-model/*` for model assembly/versioning.
- **LLM calls** → always `src/lib/llm` `runAgent`; prompts in `src/lib/prompts/`.
- **One Prisma client** (`src/lib/db.ts`); never instantiate `PrismaClient` elsewhere (seed/scripts excepted).
