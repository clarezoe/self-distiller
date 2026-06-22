# Research: ChatGPT Subscription as a Programmatic LLM Backend

- **Query**: Feasibility / mechanics / ToS of using a ChatGPT subscription (Plus/Pro, NOT the paid OpenAI API) programmatically from a server-side web app, where the END USER logs in with their ChatGPT account and the app generates completions on their behalf.
- **Scope**: external (web + OpenAI Codex source) — ties directly to PRD decision **D2** ("ChatGPT subscription (OAuth, Codex-style) — pending feasibility/ToS research") and Open Question "ChatGPT-subscription backend: feasible + ToS-acceptable, or drop to API-only?"
- **Date**: 2026-06-22
- **Grounding**: OpenAI Codex CLI source on `github.com/openai/codex` (read directly), OpenRouter docs, OpenAI Python SDK README. OpenAI's policy pages are JS-rendered and not extractable by curl; ToS substance below reflects OpenAI's long-standing published terms (knowledge cutoff Jan 2026), not a fresh quote — treat exact wording as "verify against live ToS before relying on it."

---

## TL;DR / Decision

**Recommendation: (c) DROP "ChatGPT subscription" as a backend. Ship OpenAI-compatible API (base_url + api_key) instead.** Optionally keep a disabled, clearly-labeled "experimental / unsupported" placeholder, but do NOT build a working implementation for MVP.

Reasoning in one breath: there is **no official OpenAI OAuth flow that lets a third-party app use a user's ChatGPT subscription for completions**. Codex's "Sign in with ChatGPT" is a **first-party, hardcoded-client-ID** flow that is not delegable to third parties. The only way to replicate it from our app is to impersonate Codex's client ID or scrape ChatGPT session cookies — both violate OpenAI's terms, risk the **end user's** account being banned, and historically break constantly. The clean path (OpenAI-compatible API) already covers OpenAI official, OpenRouter, and local models with first-class structured JSON output, so we lose almost nothing by dropping the subscription backend.

This mirrors the asymmetry already baked into D2: Claude Pro/Max subscription auth is **officially supported** by the Claude Agent SDK (hence it's the default backend), whereas the ChatGPT-subscription equivalent is **not** officially exposed to third parties.

---

## Findings

### 1. How Codex CLI authenticates with a ChatGPT subscription

Codex CLI ("Sign in with ChatGPT" → use Plus/Pro/Business/Edu/Enterprise plan) uses a standard **OAuth 2.0 Authorization Code + PKCE** flow against `https://auth.openai.com`, with a **loopback (localhost) redirect**. Key facts pulled directly from `openai/codex` (`codex-rs/login/src/`):

| Detail | Value | Source |
|---|---|---|
| Issuer | `https://auth.openai.com` | `login/src/server.rs:52` (`DEFAULT_ISSUER`) |
| Authorize endpoint | `{issuer}/oauth/authorize` | `server.rs:520` |
| Token endpoint | `{issuer}/oauth/token` | `server.rs:731` |
| Redirect URI | `http://localhost:1455/auth/callback` (fallback 1457) | `server.rs:53,55,157` |
| PKCE | yes, `generate_pkce()` / `code_verifier` | `server.rs:31-32,142` |
| Scopes | `openid profile email offline_access api.connectors.read api.connectors.invoke` | `server.rs:498-499` |
| **Client ID (hardcoded)** | **`app_EMoamEEZ73f0CkXaXp7hrann`** | `login/src/auth/manager.rs:1344` (`pub const CLIENT_ID`) |
| Client-ID override env | `CODEX_APP_SERVER_LOGIN_CLIENT_ID` (for OpenAI's own app-server only) | `manager.rs:130` |
| Device-code flow | also present (`request_device_code` → `{base}/codex/device`, polls user_code) | `login/src/device_code_auth.rs:159-186` |
| Post-auth API key | after OAuth, Codex does an OAuth **token-exchange** (`urn:ietf:params:oauth:grant-type:token-exchange`) to mint an API key tied to the session | `server.rs:355-361, 1128-1149` |

How the token is used for completions: ChatGPT-auth sessions hit a `/responses` endpoint and send **their bearer plus an account-id header** (distinct from the API-key path, which sends an API bearer). See `codex-rs/core/src/client.rs:357-359`:

> "API-key sessions send that API bearer. ChatGPT-auth sessions send their bearer plus account id; ... `api.openai.com` sideband path."

and `client.rs:1973-1976` enumerating `AuthMode::Chatgpt | ChatgptAuthTokens | AgentIdentity | PersonalAccessToken` as the "Chatgpt" header family vs `ApiKey | BedrockApiKey`.

**Is this reusable by third-party apps? No.** It is gated on a single **first-party OpenAI client ID** (`app_EMoamEEZ73f0CkXaXp7hrann`) registered to Codex. The override env var exists only so OpenAI's own app-server can swap it. OpenAI does **not** publish a client-registration/consent screen that would let *our* app obtain its own client ID for "act on behalf of a ChatGPT subscription." A third party can only "reuse" the flow by **impersonating Codex's client ID** — i.e. pretending to be Codex. That is the crux of the ToS problem (§3).

### 2. Is there an official OAuth flow for third-party "act on behalf of ChatGPT subscription"?

**No.** As of mid-2026 there is:
- **No** "Login with OpenAI / Sign in with ChatGPT" consent product for arbitrary third-party apps to obtain chat completions billed to the user's ChatGPT subscription. (The OAuth endpoints exist, but consent/client registration is not open for this use case.)
- The **only official programmatic access to OpenAI models** is the **paid OpenAI API** with keys from `platform.openai.com` (billed per-token, separate from any ChatGPT subscription).
- Adjacent official things that are NOT this: **ChatGPT Apps SDK** (build apps that run *inside* ChatGPT, not apps that consume the subscription externally), **Connectors / MCP** (the `api.connectors.*` scopes above are about ChatGPT reaching out to data sources, not about external apps reaching into ChatGPT), and **workspace agents**. None of these let an external server generate completions on a user's ChatGPT-subscription dime.

Contrast (for D2): Anthropic *does* officially support subscription auth for programmatic use via the Claude Agent SDK + `claude setup-token` / `CLAUDE_CODE_OAUTH_TOKEN`. OpenAI has no third-party-facing equivalent for ChatGPT subscriptions. The two "subscription backends" in D2 are therefore not symmetric: Claude OAuth = supported; ChatGPT subscription = unsupported/grey-area.

### 3. OpenAI Terms of Service — does programmatic ChatGPT-subscription use violate ToS?

**Yes, materially, for a hosted third-party app.** OpenAI's Terms of Use + Usage Policies restrict (long-standing, verify exact wording against the live pages):
- **Automated / programmatic access** to ChatGPT outside provided interfaces, and **scraping / extracting data** from the service.
- **Circumventing** rate limits or protective measures, and reverse-engineering.
- **Sharing account credentials** / using another's credentials, and using the service in ways not authorized for the account type.
- ChatGPT consumer plans (Plus/Pro) are licensed for **interactive end-user use**, not as a resold/programmatic completion backend for a separate product.

Two distinct ToS-violating implementation shapes, both bad:
1. **Session-cookie / token scraping** (the classic "reverse-engineered ChatGPT API"): clearly "automated access" + "circumvention." High ban risk.
2. **Impersonating the Codex client ID** to run the official OAuth flow from our app: we are not Codex; using their first-party client ID to obtain tokens and route them through a hosted multi-tenant product is unauthorized use and credential/identity misuse.

**Risk profile:**
- **Account ban**: the risk lands on the **END USER's** ChatGPT account (the one whose credentials/tokens we'd use), not ours. Shipping a feature that can get *your users* banned is a product/trust liability, not just a legal footnote.
- **Breakage**: OpenAI rotates protections (Cloudflare/Arkose challenges, token formats, header requirements, client-ID allowlists). First-party-only flows can be locked down at any time with zero notice. Expect frequent outages.
- **Legal/commercial**: for any non-toy/hosted product, this is squarely against the terms governing consumer ChatGPT plans.

### 4. State of open-source reverse-engineered ChatGPT wrappers (stability)

History shows these are **unstable and abandoned** — OpenAI breaks them faster than maintainers can keep up:

| Project | State (checked 2026-06-22 via GitHub API) | Note |
|---|---|---|
| `acheong08/ChatGPT` (revChatGPT) — the canonical wrapper | **Archived**, last push **2023-08-02**, 27.9k stars | The most-starred reverse-engineered ChatGPT API; dead for ~3 years. |
| `linweiyuan/go-chatgpt-api` | **Archived**, last push **2024-03-20**, 1.4k stars | Abandoned. |
| `transitive-bullshit/chatgpt-api` → renamed `agentic` | **Archived**, last push 2026-02-11, 18k stars | **Pivoted entirely away** from reverse-engineering ChatGPT into a generic "your API → paid MCP" tool; no longer a ChatGPT-subscription client. |
| `xtekky/gpt4free` | Active, 66k stars, pushed 2026-06-19 | A ToS-violating multi-provider proxy aggregator (scrapes various providers). Active but explicitly grey/black-hat; not a stable or shippable dependency for a real product. |

Takeaway: the serious maintained projects either died (revChatGPT, go-chatgpt-api) or deliberately exited this space (chatgpt-api/agentic). The only live option is a known-abusive aggregator. This is direct evidence the approach is **not viable as a maintained MVP backend**.

### 5. The clean alternative — OpenAI-compatible API (base_url + api_key)

The "OpenAI-compatible API" pattern is exactly the third D2 backend and it covers the field:

- **One code path, many providers**: instantiate the OpenAI SDK with `base_url` + `api_key`. Confirmed in `openai/openai-python` README: client takes `base_url=...` (or `OPENAI_BASE_URL` env). This is the documented override mechanism.
- **OpenAI official**: default `https://api.openai.com/v1`, key from `platform.openai.com`. (Per-token billing — this is the *legitimate* way to use OpenAI models programmatically.)
- **OpenRouter**: OpenRouter docs explicitly state it is "compatible with any language or framework" via `/api/v1/chat/completions`, and that you can "use the OpenAI SDK pointed at OpenRouter as a **drop-in replacement**." So `base_url=https://openrouter.ai/api/v1` + OpenRouter key = access to many models (OpenAI, Anthropic, Google, open models) through the same interface.
- **Local models**: Ollama, vLLM, llama.cpp, LM Studio, text-generation-webui all expose `/v1/chat/completions` OpenAI-compatible servers (point `base_url` at `http://localhost:11434/v1` etc., dummy api_key). Same code path.

**Structured JSON output (critical — the PRD's agents emit structured Self-Model JSON via §12 schema):**
- OpenAI Chat Completions / Responses support `response_format: { type: "json_schema", json_schema: {...}, strict: true }` (Structured Outputs) and the older `{ type: "json_object" }` (JSON mode). The OpenAI Python SDK also offers `.parse()` helpers for typed parsing.
- OpenRouter passes `response_format` through to providers that support it.
- Local servers (vLLM "guided"/structured, Ollama `format`/json_schema, llama.cpp grammars) support constrained JSON, though feature parity varies by backend/model. For our LLM layer this means: prefer `json_schema` where supported; keep a `json_object` + validate-and-repair fallback for providers that only do JSON mode (this matches the D2 note "each backend adapts structured-JSON output").

Net: dropping the ChatGPT-subscription backend loses **no** capability the MVP needs — OpenAI models are still reachable (via API or OpenRouter), plus dozens of other models and local options, all with structured output, through a single adapter.

### 6. Concrete recommendation for D2 / the LLM layer

**Drop "ChatGPT subscription" from the MVP backend set (option c).** Keep the three-backend abstraction but make the second slot honest:

1. **Claude OAuth via SDK** — default, officially supported (unchanged from D2).
2. ~~ChatGPT subscription (OAuth, Codex-style)~~ → **removed / not implemented.** If product wants a visible placeholder, render it **disabled** with a tooltip: "Not available — OpenAI does not offer subscription-based API access for third-party apps. Use 'OpenAI-compatible API' with an OpenAI API key instead." Do **not** ship any cookie-scraping or Codex-client-ID-impersonation code path.
3. **OpenAI-compatible API (base_url + api_key)** — the real OpenAI on-ramp, plus OpenRouter and local. This is where users who "want ChatGPT" actually go: they paste a `platform.openai.com` API key (or an OpenRouter key) and pick `gpt-*`.

This keeps the provider-agnostic `complete({schema, ...})` interface and the credential store intact, removes a backend that carries account-ban risk **for our users** and guaranteed maintenance churn, and costs us nothing functionally. Revisit only if OpenAI ships an official third-party "Sign in with ChatGPT for API" consent product (none exists as of 2026-06).

---

## Caveats / Not Found

- **OpenAI policy pages are JS-rendered**; I could not curl the exact current clause text from `openai.com/policies/terms-of-use` or `/usage-policies` (returns a ~9.7KB SPA shell). The ToS *substance* in §3 reflects OpenAI's long-standing published restrictions and is high-confidence directionally, but **before relying on a specific clause, read the live ToS in a browser** and quote the exact wording.
- The Codex OAuth details in §1 are read **directly from `openai/codex` source on `main`** (high confidence), but line numbers can drift as the repo changes.
- Whether a *specific* reverse-engineering technique is currently working at this moment changes weekly; I report the maintained-project graveyard (§4) as the durable signal, not a live "does cookie X still work today" check.
- I did **not** find any evidence of an official OpenAI third-party subscription-delegation product. Absence-of-evidence here is strong but not absolute; recheck OpenAI's developer platform announcements if this becomes a hard requirement.
