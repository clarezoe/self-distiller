# Research: Claude OAuth via SDK (subscription auth) for a server-side Next.js app

- **Query**: Does "Claude OAuth through SDK" (Pro/Max subscription auth, not API key) work programmatically from a multi-user server backend? If not, what is the clean path?
- **Scope**: mixed (local skill `claude-agent-sdk-auth` + Anthropic `claude-api` skill docs + local environment check)
- **Date**: 2026-06-22

## TL;DR / Decision

**"Claude OAuth via SDK" is NOT a viable backend for a multi-user hosted web app.** Subscription OAuth is a feature of the **Claude Code / Claude Agent SDK** (the `claude` CLI runtime), built around **per-machine credentials** (`~/.claude/.credentials.json` or a single long-lived `CLAUDE_CODE_OAUTH_TOKEN`). It authenticates *one developer's own subscription on one machine*; there is no per-end-user OAuth login flow you can run from a web server to let each visitor sign in with *their* Claude.ai subscription.

- **Multi-user hosted app** → do NOT plan on Claude subscription OAuth. Use **`ANTHROPIC_API_KEY` via `@anthropic-ai/sdk`** (clean, supported, structured JSON via tool-use / `output_config.format`). This should be the default Claude backend.
- **Single-user / self-hosted deployment** (the developer running it for themselves) → Claude subscription OAuth *can* work via `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`, but it carries operational fragility and ToS ambiguity. Treat it as an optional, flag-gated, self-host-only backend, not the MVP default.

This contradicts PRD decision **D2**, which lists "Claude OAuth via SDK (officially supported) — default." It is supported *for the Claude Code/Agent-SDK use case on a developer machine*, not as a per-user web-app auth method. **The PRD's framing should be corrected.**

## Findings

### Files Found (local)

| Path | Description |
|---|---|
| `~/.claude/skills/claude-agent-sdk-auth/SKILL.md` | Authoritative local guidance on running Claude Code / Agent SDK headless with a subscription. Source of the auth-precedence and `setup-token` facts below. |
| `~/.claude/.credentials.json` | **Exists on this machine.** Holds `claudeAiOauth: { accessToken, refreshToken, expiresAt, scopes, subscriptionType }`. This is the per-machine subscription credential — concrete proof the model is machine-local, not per-request. |
| `.trellis/tasks/06-22-self-distiller-mvp/prd.md` | PRD D2 names "Claude OAuth via SDK" as the default LLM backend — the assumption this research evaluates. |

### 1. Does the Claude Agent SDK support OAuth login with a subscription? How is the token obtained / stored / refreshed?

Yes, but as a **Claude Code** capability, not a general programmatic auth flow:

- The **Agent SDK is not an HTTP server**. `@anthropic-ai/claude-agent-sdk` `query()` spawns a local `claude` CLI subprocess over stdin/stdout; that subprocess calls `api.anthropic.com` directly. You cannot point a web backend at "the SDK" as an endpoint. (Source: skill, Agent SDK Hosting docs.)
- **How the subscription token is obtained**: interactively. Either `claude` `/login` (opens a browser, stores creds on the machine) or `claude setup-token` (opens a browser, prints a ~1-year inference-only OAuth token you copy out). Both require a human + browser at acquisition time.
- **Where stored**: macOS Keychain, or Linux `~/.claude/.credentials.json` (mode 0600) under `claudeAiOauth`. `setup-token`'s token is **not saved anywhere** — you copy it and inject it as `CLAUDE_CODE_OAUTH_TOKEN`.
- **Refresh**: the `/login` credential is auto-refreshed by Claude Code (it holds a `refreshToken` + `expiresAt`). The `setup-token` token is long-lived (~1 year) and inference-only; you re-run `setup-token` to renew. Hand-rolling refresh against the OAuth token endpoint from the raw `~/.claude/.credentials.json` is possible but explicitly called out as the fragile part you should avoid.

### 2. Is there an official OAuth flow to use a Claude.ai subscription programmatically, or is it tied to Claude Code / local credentials?

**Tied to Claude Code / local credentials.** There is no documented per-end-user OAuth authorization-code flow ("Sign in with Claude.ai") that a web app can host so visitors authenticate with their own Pro/Max subscriptions. The only subscription paths are:

1. Local interactive login stored on the machine (`~/.claude/.credentials.json`).
2. `claude setup-token` → a single long-lived `CLAUDE_CODE_OAUTH_TOKEN` for one subscription.

When OAuth subscription tokens are used against `/v1/messages` directly, they go on `Authorization: Bearer <token>` **plus** `anthropic-beta: oauth-2025-04-20` (not `x-api-key`). But that is still *one* token for *one* subscription holder — not a multi-tenant login system.

**Auth precedence order** (what `claude` checks; first match wins — from the skill):
1. Cloud provider env (`CLAUDE_CODE_USE_BEDROCK`, …)
2. `ANTHROPIC_AUTH_TOKEN` (bearer; intended for an LLM gateway/proxy)
3. `ANTHROPIC_API_KEY` (Console API key, metered)
4. `apiKeyHelper` (script whose stdout is the credential)
5. `CLAUDE_CODE_OAUTH_TOKEN` (long-lived subscription token from `setup-token`)
6. Subscription OAuth from `/login` (the stored `~/.claude` credential)

Gotcha: a set `ANTHROPIC_API_KEY` (even `""`) **shadows** the subscription (slot 3 beats 5/6). And `claude --bare` does NOT read `CLAUDE_CODE_OAUTH_TOKEN`.

### 3. Can this run server-side in a multi-user web app? Constraints.

**No, not as a per-user auth mechanism.** Constraints:

- **Per-machine, single-identity credentials.** Both subscription paths bind to one machine / one subscription. A hosted web app serving many users cannot map "visitor → their own Claude subscription" through this — there is no flow for the visitor to authorize their subscription to your server.
- **Subprocess, not a network service.** Running it server-side means each call shells out to the `claude` binary per request (spawn a local subprocess, stream stdin/stdout). That is the Agent SDK model — heavy, stateful around a local filesystem, designed for a developer box, not a horizontally-scaled stateless web tier.
- **Headless caveats**: `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN` on the server is the documented way to run unattended on a remote box, and it is independent of the origin machine. But it represents the *operator's own* subscription used for *all* traffic — fine for single-user/self-host, not for multi-tenant.
- **Token location / refresh**: depends on `~/.claude` (Linux) or Keychain (macOS) for the `/login` path; serverless/containerized runtimes (Vercel, etc.) have ephemeral or no home dir, so the `/login`-stored-credential path is impractical there. Only the env-var `CLAUDE_CODE_OAUTH_TOKEN` path is realistic on a server, and only for one subscription.

### 4. Anthropic ToS implications

Stated conservatively (not legal advice; the model can fix any specifics by reading current Anthropic Consumer Terms / Usage Policy / Commercial Terms):

- A **Claude Pro/Max subscription** is a consumer end-user product governed by the **Consumer Terms**, intended for that user's own interactive use through Anthropic's apps and Claude Code. It is **not** a commercial API license.
- The **Anthropic API** (`ANTHROPIC_API_KEY`, Console billing) is the product licensed for **building and operating applications / hosted services** under the Commercial/Developer terms.
- Using a **subscription OAuth token to power a hosted, multi-user service** repurposes a consumer credential as a backend for a product — this is the kind of use that sits *outside* the consumer subscription's intended scope and is the API's intended scope. It is at minimum a ToS gray area and plausibly a violation; it also risks rate-limiting/account-action on the subscription. **Do not ship subscription-OAuth-backed Claude as a feature of a hosted multi-user product.**
- For a **single user running the app for themselves** (self-host), using their own subscription token is closer to personal Claude Code usage, but still verify against current terms before relying on it.

### 5. The alternative: `ANTHROPIC_API_KEY` via `@anthropic-ai/sdk` — the clean path

This is the supported, multi-user-safe, server-side path. Confirmed from the `claude-api` skill docs (TypeScript):

- Install `@anthropic-ai/sdk`; `new Anthropic()` resolves `ANTHROPIC_API_KEY` from env, or pass `{ apiKey }`.
- Call `client.messages.create({ model, max_tokens, messages })`. Default model per current docs is `claude-opus-4-8` (model IDs are managed by the `claude-api` skill — the implementer should confirm via that skill at build time, not hardcode from memory).

**Structured JSON output — two supported approaches:**

1. **Structured outputs (recommended)** — constrain the whole response to a JSON Schema. Use `client.messages.parse({ ..., output_config: { format: zodOutputFormat(Schema) } })` (Zod helper) or raw `output_config: { format: { type: "json_schema", schema: {...} } }` on `messages.create`. The first text block is guaranteed-valid JSON; `messages.parse` returns a typed `parsed_output`. Supported on Opus 4.8 / Sonnet 4.6 / Haiku 4.5 (and legacy 4.5/4.1). **Use the API parameter `output_config.format`, NOT the deprecated `output_format`.**
2. **Forced tool-use** — define a tool with `input_schema` (+ `strict: true` for guaranteed-valid params, with `additionalProperties: false`), and force it via `tool_choice: { type: "tool", name: "..." }`. Claude's `tool_use.input` is the structured object.

Both let an agent layer call a single `complete({ schema, ... })`-style interface and get back structured JSON. For Self Distiller's agents this is clean: one provider adapter wrapping `@anthropic-ai/sdk` with `output_config.format`.

Notes for the implementer (from `claude-api` skill — confirm at build time):
- `thinking: { type: "adaptive" }` for non-trivial work; `output_config: { effort: "high" }` to tune depth.
- Stream (`client.messages.stream` → `.finalMessage()`) for long/large outputs to dodge HTTP timeouts; default `max_tokens` ~16000 non-streaming, ~64000 streaming.
- Parse tool inputs with `JSON.parse` — never raw-string-match.
- Use SDK typed errors (`Anthropic.RateLimitError`, etc.), most-specific-first.

### Related Specs / PRD

- `.trellis/tasks/06-22-self-distiller-mvp/prd.md` **D2** — lists three MVP backends: (1) Claude OAuth via SDK [default], (2) ChatGPT subscription OAuth, (3) OpenAI-compatible API. This research shows **(1) is not appropriate as the multi-user default**; the natural default for Claude is the OpenAI-incompatible-but-clean `@anthropic-ai/sdk` + API key path (which is effectively a 4th backend, or a Claude-specific adapter). The "OpenAI-compatible API (base_url + api_key)" backend does NOT cover Claude well — Claude's structured-output shape (tool-use / `output_config.format`) differs from OpenAI `json_schema`, so Claude needs its own adapter regardless.

## 6. Concrete recommendation

- **Multi-user hosted Self Distiller**: Default Claude backend = **`@anthropic-ai/sdk` + `ANTHROPIC_API_KEY`** (user pastes their own Anthropic API key into the credential store, same UX as the OpenAI-compatible backend). Structured JSON via `output_config.format` (preferred) or forced tool-use. Drop "Claude OAuth via SDK" as a multi-user option.
- **Single-user / self-hosted**: Optionally offer "Claude subscription (Claude Code)" as a **flag-gated, self-host-only** backend using `claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`, shelling out to the `claude` CLI / Agent SDK. Document the ToS caveat and the per-machine, single-identity, subprocess constraints. Not the MVP default.
- **Provider abstraction impact**: the `lib/llm` layer should model **two Claude shapes if both are kept** — (a) an HTTP adapter over `@anthropic-ai/sdk` (clean, default), and (b) an optional subprocess adapter over the Agent SDK/CLI (self-host). Keeping only (a) for MVP is the simpler, defensible choice.

## Caveats / Not Found

- **ToS specifics not quoted verbatim.** I did not fetch and quote current Anthropic Consumer/Commercial Terms section-by-section. The directional conclusion (subscription = consumer/personal; API = commercial/hosted) is well-established, but if a hard compliance statement is needed for the spec, fetch the live Anthropic Usage Policy / Consumer Terms / Commercial Terms before relying on exact wording.
- **No web search executed** (offline-leaning environment). Findings rest on the authoritative local skill `claude-agent-sdk-auth` and the bundled Anthropic `claude-api` skill docs, both of which are current and authoritative for these mechanics.
- **Model IDs / API parameters** (e.g. `claude-opus-4-8`, `output_config.format`) should be re-confirmed via the `claude-api` skill at implementation time rather than copied from this doc — they drift.
- This research did not evaluate the **ChatGPT subscription OAuth** backend (D2 option 2) — that is a separate open question in the PRD and would need its own research pass; note that the same consumer-vs-commercial ToS concern applies to it.
