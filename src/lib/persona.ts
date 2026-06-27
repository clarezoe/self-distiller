// Persona export (GitHub #11 + #12, multi-user in #13). Exposes a user's active
// Self Model to external agents (Claude Code, Codex, MCP) as an agent-ready
// system prompt or the structured §12 JSON. Token-gated (per-user persona token,
// or env PERSONA_API_TOKEN for the owner — back-compat), not session-gated.
//
// `toSystemPrompt`, `parseBearer`, `hashPersonaToken`, and `personaETag` are PURE
// (no IO) and unit-tested. `resolvePersonaUser` / `getPersonaForUser` touch the DB.

import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { getActiveModel, modelRowToJson } from "@/lib/self-model/version";
import { getActiveProject } from "@/lib/services/projects";
import type { SelfModelJson } from "@/lib/self-model/schema";

// ---------------------------------------------------------------------------
// Per-user persona resolution (GitHub #13)
// ---------------------------------------------------------------------------

export type ActivePersona = {
  modelJson: SelfModelJson;
  version: string;
  createdAt: Date;
};

// The bootstrap owner: used only for the env-token back-compat path below.
async function getOwnerUserId(): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { role: "owner" },
    orderBy: { createdAt: "asc" },
  });
  if (owner) return owner.id;

  const email = process.env.OWNER_EMAIL;
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) return byEmail.id;
  }

  const any = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  return any?.id ?? null;
}

// Resolve a specific user's active project → its active SelfModel as §12 JSON.
export async function getPersonaForUser(userId: string): Promise<ActivePersona | null> {
  const project = await getActiveProject(userId);
  if (!project) return null;

  const row = await getActiveModel(project.id);
  if (!row) return null;

  return {
    modelJson: modelRowToJson(row),
    version: row.version,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Per-user persona token (sha256 at rest). PURE helpers are unit-tested.
// ---------------------------------------------------------------------------

const BEARER = "Bearer ";

// Parse a raw Bearer token out of an Authorization header. Returns null when the
// header is missing or not a non-empty Bearer.
export function parseBearer(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith(BEARER)) return null;
  const token = authHeader.slice(BEARER.length).trim();
  return token.length > 0 ? token : null;
}

// SHA-256 (hex) of a persona token. Stored on User.personaTokenHash; the
// plaintext is shown once and never persisted/logged.
export function hashPersonaToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// Constant-time compare of a raw provided token against env PERSONA_API_TOKEN
// (back-compat). Length leak is acceptable; the token is high-entropy.
function matchesEnvToken(provided: string): boolean {
  const expected = process.env.PERSONA_API_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Resolve the userId an Authorization header authenticates as, or null:
//  1. Bearer == env PERSONA_API_TOKEN  → the bootstrap owner (back-compat).
//  2. sha256(Bearer) == a User.personaTokenHash → that user.
// Otherwise null.
export async function resolvePersonaUser(authHeader: string | null): Promise<string | null> {
  const token = parseBearer(authHeader);
  if (!token) return null;

  // Back-compat: the existing live env token resolves to the owner.
  if (matchesEnvToken(token)) {
    return getOwnerUserId();
  }

  const hash = hashPersonaToken(token);
  const user = await prisma.user.findFirst({
    where: { personaTokenHash: hash },
    select: { id: true },
  });
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Weak ETag from {version, createdAt} for cheap caching / 304s
// ---------------------------------------------------------------------------

export function personaETag(meta: { version: string; createdAt: Date }): string {
  return `W/"v${meta.version}-${meta.createdAt.getTime()}"`;
}

// ---------------------------------------------------------------------------
// toSystemPrompt — PURE. Render the §12 model as an agent-ready system prompt.
// The per-context maps (language/role/relationship/scene) are open-ended (§23.8):
// values can be nested objects / arrays-of-objects. Serialize recursively so the
// output never contains "[object Object]".
// ---------------------------------------------------------------------------

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.every(isEmpty);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isEmpty);
  }
  return false;
}

function isScalar(value: unknown): value is string | number | boolean {
  const t = typeof value;
  return t === "string" || t === "number" || t === "boolean";
}

function humanize(key: string): string {
  if (key === "evidence_ids") return "Evidence";
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// Recursively serialize an open-ended JSON value to indented Markdown bullets.
function renderValue(value: unknown, indent = 0): string[] {
  const pad = "  ".repeat(indent);
  if (isEmpty(value)) return [];

  if (isScalar(value)) return [`${pad}- ${String(value)}`];

  if (Array.isArray(value)) {
    const items = value.filter((v) => !isEmpty(v));
    if (items.length === 0) return [];
    if (items.every(isScalar)) {
      return [`${pad}- ${items.map((v) => String(v)).join(", ")}`];
    }
    return items.flatMap((v) => renderValue(v, indent));
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => !isEmpty(v),
  );
  const lines: string[] = [];
  for (const [key, v] of entries) {
    const label = humanize(key);
    if (isScalar(v)) {
      lines.push(`${pad}- **${label}:** ${String(v)}`);
    } else if (Array.isArray(v)) {
      const items = v.filter((x) => !isEmpty(x));
      if (items.length === 0) continue;
      if (items.every(isScalar)) {
        lines.push(`${pad}- **${label}:** ${items.map((x) => String(x)).join(", ")}`);
      } else {
        lines.push(`${pad}- **${label}:**`);
        lines.push(...items.flatMap((x) => renderValue(x, indent + 1)));
      }
    } else {
      lines.push(`${pad}- **${label}:**`);
      lines.push(...renderValue(v, indent + 1));
    }
  }
  return lines;
}

function bulletList(label: string, items?: string[]): string[] {
  const clean = (items ?? []).filter((i) => i && i.trim() !== "");
  if (clean.length === 0) return [];
  return [`**${label}:**`, ...clean.map((i) => `- ${i}`), ""];
}

// A keyed context map → "### key" blocks under a section heading. Returns [] when empty.
function contextSection(
  title: string,
  intro: string,
  record: Record<string, unknown> | undefined,
): string[] {
  const entries = Object.entries(record ?? {}).filter(([, v]) => !isEmpty(v));
  if (entries.length === 0) return [];
  const lines: string[] = [`## ${title}`, intro, ""];
  for (const [key, value] of entries) {
    lines.push(`### ${key}`);
    lines.push(...renderValue(value));
    lines.push("");
  }
  return lines;
}

export function toSystemPrompt(model: SelfModelJson): string {
  const core = model.core_self ?? {};
  const identity = (core.identity ?? []).filter((i) => i && i.trim() !== "");

  const lines: string[] = [];

  // Header + framing
  lines.push("# Persona: write AS this person", "");
  const who =
    identity.length > 0
      ? `You ARE ${identity.join(", ")}.`
      : "You ARE the specific person this persona models.";
  lines.push(
    `${who} When you produce a reply, message, or piece of writing, write it exactly as THEY would write it — their language, tone, length, directness, and habits — not as a helpful AI assistant. Do not sound like a generic chatbot. Do not over-explain or over-polish unless their style calls for it. The goal is that someone who knows them would not notice the difference.`,
    "",
  );

  // Core self
  const coreLines = [
    ...bulletList("Values", core.values),
    ...bulletList("Long-term preferences", core.long_term_preferences),
    ...bulletList("Decision patterns", core.decision_patterns),
    ...bulletList("Communication boundaries", core.communication_boundaries),
    ...bulletList("Stable dislikes", core.stable_dislikes),
  ];
  if (coreLines.length > 0) {
    lines.push("## Who you are", "");
    lines.push(...coreLines);
  }

  // Open-ended context maps
  lines.push(
    ...contextSection(
      "How you write per language",
      "Match the voice, sentence patterns, and quirks for the active language. Preserve non-native traces unless a polish policy says otherwise.",
      model.language_models,
    ),
  );
  lines.push(
    ...contextSection(
      "How you behave in each role",
      "When acting in one of these roles, follow its style.",
      model.role_models,
    ),
  );
  lines.push(
    ...contextSection(
      "How you communicate in each relationship",
      "Adjust closeness, length, and tone to the relationship.",
      model.relationship_models,
    ),
  );
  lines.push(
    ...contextSection(
      "How you handle each scene",
      "Follow the typical intent and structure for the active scenario.",
      model.scene_models,
    ),
  );

  // Current state (temporary)
  const cs = model.current_state ?? {};
  const csLines = [
    ...bulletList("Recent changes", cs.recent_changes),
    ...bulletList("Temporary mood patterns", cs.temporary_mood_patterns),
    ...bulletList("Language progress", cs.language_progress),
  ];
  if (csLines.length > 0) {
    lines.push(
      "## Current state (temporary — do not treat as permanent traits)",
      "",
      ...csLines,
    );
  }

  // Boundaries (hard)
  const b = model.boundaries ?? {};
  const bLines = [
    ...bulletList("Never invent", b.must_not_invent),
    ...bulletList("Require the user's confirmation before", b.requires_user_confirmation),
    ...bulletList("Sensitive topics — stop and hand back to the user", b.sensitive_topics),
  ];
  if (bLines.length > 0) {
    lines.push("## Hard boundaries (never violate)", "", ...bLines);
  }

  // Closing rules
  lines.push(
    "## Always",
    "",
    "- Write as the user, not as an assistant.",
    "- Match their length, directness, and emotional tone for the active context.",
    "- Preserve their language quirks; do not auto-correct non-native writing unless their polish policy says so.",
    "- This is draft mode: produce the message, never send it or act on the user's behalf.",
    "- On any sensitive or high-stakes topic, stop and hand control back to the real user.",
    "",
  );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
