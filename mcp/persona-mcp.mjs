#!/usr/bin/env node
// Persona MCP server (GitHub #12). Minimal stdio MCP server exposing a single
// tool `get_persona({ format })` that returns the owner's distilled persona.
// Cloud-first (fetch the live API), with an offline fallback to the local cache
// at ~/.distill/persona.md (written by scripts/persona-pull.mjs).
//
// Env:
//   DISTILL_URL   base URL of the live app (e.g. https://distill.example.com)
//   DISTILL_TOKEN the PERSONA_API_TOKEN value
//
// Depends only on @modelcontextprotocol/sdk (declared in mcp/package.json).

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const CACHE_MD = join(homedir(), ".distill", "persona.md");

async function readCache() {
  try {
    return await readFile(CACHE_MD, "utf8");
  } catch {
    return null;
  }
}

// Cloud-first fetch with cache fallback. For json we only go cloud (the cache
// holds the md system prompt); if json is unavailable we surface a clear error.
async function getPersona(format) {
  const baseUrl = process.env.DISTILL_URL;
  const token = process.env.DISTILL_TOKEN;

  if (baseUrl && token) {
    try {
      const url = `${baseUrl.replace(/\/+$/, "")}/api/persona?format=${format}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        return { text: await res.text(), source: "cloud" };
      }
      // fall through to cache on non-2xx
    } catch {
      // network error → fall through to cache
    }
  }

  if (format === "md") {
    const cached = await readCache();
    if (cached) return { text: cached, source: "cache" };
  }

  throw new Error(
    "Persona unavailable: cloud fetch failed and no local cache. " +
      "Set DISTILL_URL + DISTILL_TOKEN, or run persona-pull to populate ~/.distill/persona.md.",
  );
}

const server = new McpServer({ name: "persona-mcp", version: "1.0.0" });

server.registerTool(
  "get_persona",
  {
    title: "Get distilled persona",
    description:
      "Return the owner's distilled persona. format=md (default) is an agent-ready " +
      "system prompt; format=json is the structured Self Model. Cloud-first, falls " +
      "back to the local ~/.distill/persona.md cache when offline.",
    inputSchema: { format: z.enum(["md", "json"]).optional() },
  },
  async ({ format }) => {
    const { text } = await getPersona(format ?? "md");
    return { content: [{ type: "text", text }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
