# persona-mcp

Minimal [MCP](https://modelcontextprotocol.io) stdio server that exposes the
distilled persona to MCP-aware agents. It wraps the live `GET /api/persona`
endpoint (cloud-first) and falls back to the local cache at
`~/.distill/persona.md` when offline.

## Tool

`get_persona({ format })`

- `format: "md"` (default) — an agent-ready system prompt (markdown).
- `format: "json"` — the structured Self Model (`SelfModelJson`). Cloud only
  (the local cache stores the `md` system prompt); if the cloud is unreachable
  and you ask for `json`, the tool returns a clear error.

## Setup

```bash
cd mcp
npm install   # installs @modelcontextprotocol/sdk + zod (kept out of the main app)
```

Required env:

- `DISTILL_URL` — base URL of the live app (e.g. `https://distill.example.com`)
- `DISTILL_TOKEN` — the `PERSONA_API_TOKEN` value configured on the server

## Wire it into an agent

### Claude Code / Codex / any MCP client (JSON config)

```json
{
  "mcpServers": {
    "persona": {
      "command": "node",
      "args": ["/absolute/path/to/distill-me/mcp/persona-mcp.mjs"],
      "env": {
        "DISTILL_URL": "https://distill.example.com",
        "DISTILL_TOKEN": "your-persona-api-token"
      }
    }
  }
}
```

Then ask the agent to call `get_persona` and use the returned system prompt as
the voice it writes in.

## Offline cache

To keep a local copy fresh (and provide the offline fallback), run the zero-dep
puller on a cron or at agent start:

```bash
DISTILL_URL=https://distill.example.com \
DISTILL_TOKEN=your-persona-api-token \
node /absolute/path/to/distill-me/scripts/persona-pull.mjs
# writes ~/.distill/persona.md (+ persona.etag); offline → keeps the last copy
```
