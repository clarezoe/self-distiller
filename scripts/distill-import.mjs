#!/usr/bin/env node
// Agent import CLI (GitHub #38). Reads a JSONL file (one material per line, the
// same shape as an item of POST /api/materials/import) and imports it with the
// write-scoped import token. Zero dependencies (Node 18+).
//
// Env:
//   DISTILL_URL           base URL of the live app (e.g. https://distill.example.com)
//   DISTILL_IMPORT_TOKEN  import token generated in Settings (NOT the persona token)
//
// Usage:
//   node scripts/distill-import.mjs --project <id> <file.jsonl>
//        [--dry-run] [--create-missing-contexts] [--batch-size N]
//
// Output is counts and JSONL line numbers only: never material content, never
// the token. Exit code is non-zero if any line failed.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const SOURCE_TYPES = [
  "chat",
  "copywriting",
  "email",
  "social_post",
  "diary",
  "course_script",
  "product_text",
  "sales_reply",
  "chatgpt_conversation",
  "other",
];
export const MAX_BATCH = 100;
export const DEFAULT_BATCH = 50;
export const MAX_METADATA_BYTES = 4096;
export const MAX_ITEM_CONTENT_CHARS = 500_000;

export const HELP = `distill-import: import writing samples into Self Distiller

Usage:
  node scripts/distill-import.mjs --project <projectId> <file.jsonl> [options]

Options:
  --dry-run                    validate locally, print counts, make NO network call
  --create-missing-contexts    create contexts named in "contextNames" if absent
  --batch-size N               items per request (1-${MAX_BATCH}, default ${DEFAULT_BATCH})
  -h, --help                   show this help

Env: DISTILL_URL, DISTILL_IMPORT_TOKEN (import token from Settings)

Each JSONL line: {"sourceType","content","language"?,"contextIds"?,"contextNames"?,
"materialTime"?,"sourceMetadata"?}. sourceType is one of: ${SOURCE_TYPES.join(", ")}.

WARNING: you are responsible for cleaning the text first. boilerplate such as
calls to action, signatures, or hashtags is imported verbatim and the model will
learn it as the author's "style".

The project is given by id (see the project in the app). Output shows counts and
line numbers only, never content or the token.
`;

export function parseArgs(argv) {
  const opts = {
    project: null,
    file: null,
    dryRun: false,
    createMissingContexts: false,
    batchSize: DEFAULT_BATCH,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--create-missing-contexts") opts.createMissingContexts = true;
    else if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--project") opts.project = argv[++i] ?? null;
    else if (a === "--batch-size") {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1 || n > MAX_BATCH) {
        throw new Error(`--batch-size must be an integer between 1 and ${MAX_BATCH}`);
      }
      opts.batchSize = n;
    } else if (a.startsWith("-")) throw new Error("unknown option");
    else if (opts.file === null) opts.file = a;
    else throw new Error("only one input file is supported");
  }
  return opts;
}

// Validate one parsed line. Returns an error string (no content echoed) or null.
export function validateItem(item) {
  if (typeof item !== "object" || item === null || Array.isArray(item)) return "line is not a JSON object";
  if (!SOURCE_TYPES.includes(item.sourceType)) return "invalid sourceType";
  if (typeof item.content !== "string" || item.content.trim() === "") return "content must be a non-empty string";
  if (typeof item.content === "string" && item.content.length > MAX_ITEM_CONTENT_CHARS) return `content exceeds ${MAX_ITEM_CONTENT_CHARS} chars`;
  if (item.language !== undefined && typeof item.language !== "string") return "language must be a string";
  for (const k of ["contextIds", "contextNames"]) {
    if (
      item[k] !== undefined &&
      !(Array.isArray(item[k]) && item[k].every((x) => typeof x === "string" && x.trim() !== ""))
    ) {
      return `${k} must be an array of non-empty strings`;
    }
  }
  if (item.materialTime !== undefined && (typeof item.materialTime !== "string" || Number.isNaN(new Date(item.materialTime).getTime()))) {
    return "materialTime must be a date string";
  }
  if (item.sourceMetadata !== undefined) {
    const m = item.sourceMetadata;
    if (typeof m !== "object" || m === null || Array.isArray(m)) return "sourceMetadata must be an object";
    if (Buffer.byteLength(JSON.stringify(m), "utf8") > MAX_METADATA_BYTES) {
      return `sourceMetadata exceeds ${MAX_METADATA_BYTES} bytes`;
    }
  }
  return null;
}

// Parse JSONL text. Blank lines are skipped. Returns valid items with their
// 1-based line numbers, and failures with line numbers and generic reasons.
export function parseJsonl(text) {
  const items = [];
  const failures = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    if (raw.trim() === "") return;
    let item;
    try {
      item = JSON.parse(raw);
    } catch {
      failures.push({ line, error: "invalid JSON" });
      return;
    }
    const err = validateItem(item);
    if (err) failures.push({ line, error: err });
    else items.push({ line, item });
  });
  return { items, failures };
}

function safeCountLabel(value, secret) {
  return secret && value.includes(secret) ? "(redacted)" : value;
}

export function summarize(items, secret = "") {
  const bySourceType = Object.create(null);
  const byLanguage = Object.create(null);
  for (const { item } of items) {
    bySourceType[item.sourceType] = (bySourceType[item.sourceType] ?? 0) + 1;
    const lang = safeCountLabel(item.language ?? "(none)", secret);
    byLanguage[lang] = (byLanguage[lang] ?? 0) + 1;
  }
  return { bySourceType, byLanguage };
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function countsLines(title, counts) {
  const keys = Object.keys(counts).sort();
  return [`${title}:`, ...keys.map((k) => `  ${k}: ${counts[k]}`)];
}

function isImportResponse(value, batchLength) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  if (
    !Number.isInteger(value.created) ||
    value.created < 0 ||
    !Number.isInteger(value.skipped) ||
    value.skipped < 0 ||
    !Array.isArray(value.ids) ||
    value.ids.length !== value.created ||
    !value.ids.every((id) => typeof id === "string") ||
    !Array.isArray(value.errors)
  ) {
    return false;
  }
  const indexes = new Set();
  for (const error of value.errors) {
    if (
      typeof error !== "object" ||
      error === null ||
      !Number.isInteger(error.index) ||
      error.index < 0 ||
      error.index >= batchLength ||
      indexes.has(error.index)
    ) {
      return false;
    }
    indexes.add(error.index);
  }
  // A response that accounts for fewer items would silently lose input lines.
  return value.created + value.skipped + value.errors.length >= batchLength;
}

// Everything with side effects is injected so tests can prove what happens
// (or doesn't) on the network. Returns the process exit code.
export async function run({ argv, env, fetchImpl, readFileImpl, out, err }) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    err(`distill-import: ${e.message}`);
    return 2;
  }
  if (opts.help) {
    out(HELP);
    return 0;
  }
  if (!opts.project || !opts.file) {
    err("distill-import: --project <id> and an input file are required (see --help).");
    return 2;
  }

  let text;
  try {
    text = await readFileImpl(opts.file, "utf8");
  } catch {
    err("distill-import: cannot read input file.");
    return 2;
  }
  const { items, failures } = parseJsonl(text);
  const failed = [...failures];

  if (opts.dryRun) {
    const { bySourceType, byLanguage } = summarize(items, env.DISTILL_IMPORT_TOKEN ?? "");
    out(`dry-run: ${items.length} valid, ${failed.length} invalid (no network call made)`);
    out(countsLines("sourceType", bySourceType).join("\n"));
    out(countsLines("language", byLanguage).join("\n"));
    for (const f of failed) out(`line ${f.line}: ${f.error}`);
    return failed.length > 0 ? 1 : 0;
  }

  const baseUrl = env.DISTILL_URL;
  const token = env.DISTILL_IMPORT_TOKEN;
  if (!baseUrl || !token) {
    err("distill-import: DISTILL_URL and DISTILL_IMPORT_TOKEN must be set.");
    return 2;
  }
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    err("distill-import: DISTILL_URL must be a valid http(s) URL.");
    return 2;
  }
  if (
    (parsedBaseUrl.protocol !== "http:" && parsedBaseUrl.protocol !== "https:") ||
    parsedBaseUrl.username ||
    parsedBaseUrl.password
  ) {
    err("distill-import: DISTILL_URL must be an http(s) URL without credentials.");
    return 2;
  }
  const basePath = parsedBaseUrl.pathname.replace(/\/+$/, "");
  const url = `${parsedBaseUrl.origin}${basePath}/api/materials/import`;

  let created = 0;
  let skipped = 0;
  const batches = chunk(items, opts.batchSize);
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    let res;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        redirect: "error",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: opts.project,
          createMissingContexts: opts.createMissingContexts,
          materials: batch.map((b) => b.item),
        }),
      });
    } catch {
      for (const b of batch) failed.push({ line: b.line, error: "network error" });
      continue;
    }
    if (!res.ok) {
      const reason = `server returned ${res.status}`;
      for (const b of batch) failed.push({ line: b.line, error: reason });
      if (res.status === 401 || res.status === 404) {
        // Retrying other batches is pointless; count the unsent lines as failed.
        for (const rest of batches.slice(bi + 1)) {
          for (const b of rest) failed.push({ line: b.line, error: "not sent" });
        }
        break;
      }
      continue;
    }
    let data;
    try {
      data = await res.json();
    } catch {
      for (const b of batch) failed.push({ line: b.line, error: "unreadable server response" });
      continue;
    }
    if (!isImportResponse(data, batch.length)) {
      for (const b of batch) failed.push({ line: b.line, error: "invalid server response" });
      continue;
    }
    created += data.created;
    skipped += data.skipped;
    for (const e of data.errors) {
      const b = batch[e.index];
      failed.push({ line: b.line, error: "server rejected item" });
    }
  }

  failed.sort((a, b) => a.line - b.line);
  out(`created: ${created}`);
  out(`skipped: ${skipped}`);
  out(`failed: ${failed.length}`);
  for (const f of failed) out(`line ${f.line}: ${f.error}`);
  return failed.length > 0 ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run({
    argv: process.argv.slice(2),
    env: process.env,
    fetchImpl: fetch,
    readFileImpl: readFile,
    out: (s) => console.log(s),
    err: (s) => console.error(s),
  }).then(
    (code) => process.exit(code),
    () => {
      console.error("distill-import: unexpected error.");
      process.exit(1);
    },
  );
}
