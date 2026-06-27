#!/usr/bin/env node
// Persona cache pull (GitHub #11 v2). Cloud-first with an offline fallback:
// fetch the owner's active persona system prompt and cache it locally so agents
// can read ~/.distill/persona.md even when offline. Zero dependencies (Node 18+).
//
// Env:
//   DISTILL_URL   base URL of the live app (e.g. https://distill.example.com)
//   DISTILL_TOKEN the PERSONA_API_TOKEN value
//
// Behavior:
//   200 → write ~/.distill/persona.md + ~/.distill/persona.etag
//   304 → keep the cached file (no rewrite)
//   network/fetch error → keep the existing cached file (offline), exit 0
// Idempotent + safe to run on a cron or at agent start. Prints the cache path.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_DIR = join(homedir(), ".distill");
const MD_PATH = join(CACHE_DIR, "persona.md");
const ETAG_PATH = join(CACHE_DIR, "persona.etag");

async function readIfExists(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function main() {
  const baseUrl = process.env.DISTILL_URL;
  const token = process.env.DISTILL_TOKEN;

  if (!baseUrl || !token) {
    console.error("persona-pull: DISTILL_URL and DISTILL_TOKEN must be set.");
    // Don't crash agent startup; fall back to whatever is cached.
    if (existsSync(MD_PATH)) console.log(MD_PATH);
    process.exit(existsSync(MD_PATH) ? 0 : 1);
  }

  await mkdir(CACHE_DIR, { recursive: true });

  const url = `${baseUrl.replace(/\/+$/, "")}/api/persona?format=md`;
  const headers = { Authorization: `Bearer ${token}` };
  const cachedEtag = await readIfExists(ETAG_PATH);
  if (cachedEtag) headers["If-None-Match"] = cachedEtag.trim();

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    // Offline / DNS / connection error → keep the cached file.
    console.error(`persona-pull: fetch failed (${err?.message ?? err}); using cache.`);
    if (existsSync(MD_PATH)) {
      console.log(MD_PATH);
      process.exit(0);
    }
    process.exit(0);
  }

  if (res.status === 304) {
    // Unchanged — keep the cached file as-is.
    console.log(MD_PATH);
    process.exit(0);
  }

  if (res.status === 200) {
    const body = await res.text();
    await writeFile(MD_PATH, body, "utf8");
    const etag = res.headers.get("etag");
    if (etag) await writeFile(ETAG_PATH, etag, "utf8");
    console.log(MD_PATH);
    process.exit(0);
  }

  // Any other status (401/404/5xx) → don't clobber the cache; report + keep cache.
  console.error(`persona-pull: server returned ${res.status}; keeping cache.`);
  if (existsSync(MD_PATH)) console.log(MD_PATH);
  process.exit(0);
}

// Never let an unexpected error (e.g. a filesystem permission issue while
// writing the cache) crash agent startup: report it and keep any existing cache.
main().catch((err) => {
  console.error(`persona-pull: unexpected error (${err?.message ?? err}); keeping cache.`);
  if (existsSync(MD_PATH)) console.log(MD_PATH);
  process.exit(0);
});
