// Render a Self Model (§12 JSON) as readable Markdown (PRD §10.6). Pure — unit-tested.
//
// The per-context maps (language/role/relationship/scene models) are open-ended (§23.8): values
// can be nested objects and arrays-of-objects, not just flat strings. So those sections are
// serialized with a generic recursive walker (`mdEntry`) that never emits `[object Object]`.
// Core Self / Current State / Boundaries are schema-constrained string arrays and keep their
// existing bullet layout.

import type { SelfModelJson } from "./schema";

function bullets(label: string, items?: string[]): string[] {
  if (!items || items.length === 0) return [];
  return [`**${label}:**`, ...items.map((i) => `- ${i}`), ""];
}

// snake_case / camelCase → "Snake case"
function humanize(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

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

function scalarText(value: unknown): string {
  return String(value);
}

function labelFor(key: string): string {
  if (key === "evidence_ids") return "Evidence";
  return humanize(key);
}

// Recursively serialize an open-ended JSON value to indented Markdown bullets.
function mdEntry(value: unknown, indent = 0): string[] {
  const pad = "  ".repeat(indent);

  if (isEmpty(value)) return [];

  if (isScalar(value)) {
    return [`${pad}- ${scalarText(value)}`];
  }

  if (Array.isArray(value)) {
    const items = value.filter((v) => !isEmpty(v));
    if (items.length === 0) return [];
    if (items.every(isScalar)) {
      return [`${pad}- ${items.map(scalarText).join(", ")}`];
    }
    return items.flatMap((v) => mdEntry(v, indent));
  }

  // object
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => !isEmpty(v),
  );
  const lines: string[] = [];
  for (const [key, v] of entries) {
    const label = labelFor(key);
    if (isScalar(v)) {
      lines.push(`${pad}- **${label}:** ${scalarText(v)}`);
    } else if (Array.isArray(v)) {
      const items = v.filter((x) => !isEmpty(x));
      if (items.length === 0) continue;
      if (items.every(isScalar)) {
        lines.push(`${pad}- **${label}:** ${items.map(scalarText).join(", ")}`);
      } else {
        lines.push(`${pad}- **${label}:**`);
        lines.push(...items.flatMap((x) => mdEntry(x, indent + 1)));
      }
    } else {
      lines.push(`${pad}- **${label}:**`);
      lines.push(...mdEntry(v, indent + 1));
    }
  }
  return lines;
}

// A keyed model map (language_models, role_models, …) → "### key" blocks.
function mapSection(
  title: string,
  record: Record<string, unknown> | undefined,
): string[] {
  const lines: string[] = [`## ${title}`, ""];
  const entries = Object.entries(record ?? {}).filter(([, v]) => !isEmpty(v));
  if (entries.length === 0) {
    lines.push("_None yet._", "");
    return lines;
  }
  for (const [key, value] of entries) {
    lines.push(`### ${key}`);
    lines.push(...mdEntry(value));
    lines.push("");
  }
  return lines;
}

export function toMarkdown(model: SelfModelJson): string {
  const lines: string[] = [];
  lines.push(`# Self Model v${model.version}`, "");

  // Core Self
  const c = model.core_self ?? {};
  const coreLines = [
    ...bullets("Identity", c.identity),
    ...bullets("Values", c.values),
    ...bullets("Long-term preferences", c.long_term_preferences),
    ...bullets("Decision patterns", c.decision_patterns),
    ...bullets("Communication boundaries", c.communication_boundaries),
    ...bullets("Stable dislikes", c.stable_dislikes),
  ];
  lines.push("## Core Self", "");
  lines.push(...(coreLines.length ? coreLines : ["_No core self captured yet._", ""]));

  // Open-ended context maps (tolerant recursive render).
  lines.push(...mapSection("Language Models", model.language_models));
  lines.push(...mapSection("Role Models", model.role_models));
  lines.push(...mapSection("Relationship Models", model.relationship_models));
  lines.push(...mapSection("Scene Models", model.scene_models));

  // Current state
  const cs = model.current_state ?? {};
  const csLines = [
    ...bullets("Recent changes", cs.recent_changes),
    ...bullets("Temporary mood patterns", cs.temporary_mood_patterns),
    ...bullets("Language progress", cs.language_progress),
  ];
  if (csLines.length) {
    lines.push("## Current State", "", ...csLines);
  }

  // Boundaries
  const b = model.boundaries ?? {};
  const bLines = [
    ...bullets("Must not invent", b.must_not_invent),
    ...bullets("Requires user confirmation", b.requires_user_confirmation),
    ...bullets("Sensitive topics", b.sensitive_topics),
  ];
  if (bLines.length) {
    lines.push("## Boundaries", "", ...bLines);
  }

  // Unknowns
  if (model.unknowns && model.unknowns.length) {
    lines.push("## Unknowns", "", ...model.unknowns.map((u) => `- ${u}`), "");
  }

  // Suggested interviews
  if (model.suggested_interviews && model.suggested_interviews.length) {
    lines.push("## Suggested Interviews", "");
    for (const s of model.suggested_interviews) {
      const meta = [s.interviewer_persona, s.target_context].filter(Boolean).join(" · ");
      lines.push(`- ${s.goal}${meta ? ` _(${meta})_` : ""}`);
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
