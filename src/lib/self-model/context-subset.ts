// Build the selected Self Model subset + a human-readable context summary from a
// ContextCombination (PRD §13.5 Persona Router spirit, §14.1/§14.2 inputs). Feeds both the
// hidden-answer and comparator prompts so they only see what's relevant to the chosen context.
//
// PURE: no IO. Callers resolve the combination + its Context rows + the active Self Model JSON,
// then pass plain data in. This keeps it unit-testable and provider-free.

import type { SelfModelJson } from "./schema";

// A resolved context dimension: the type bucket plus the user-defined name (e.g. "Chinese",
// "Close friend", "Comforting"). `name` is matched against the Self Model's dynamic keys.
export type SelectedContext = {
  type: "language" | "role" | "relationship" | "scene";
  name: string;
};

export type ContextSelection = {
  combinationName?: string;
  contexts: SelectedContext[];
};

// Section in the Self Model JSON that each context type maps to.
const TYPE_TO_SECTION: Record<SelectedContext["type"], keyof SelfModelJson> = {
  language: "language_models",
  role: "role_models",
  relationship: "relationship_models",
  scene: "scene_models",
};

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

// Find the best matching dynamic key in a section map for a context name.
// Tries exact, normalized ("Close friend" → "close_friend"), then a contains match.
function matchKey(section: Record<string, unknown> | undefined, name: string): string | null {
  if (!section) return null;
  const keys = Object.keys(section);
  if (keys.length === 0) return null;
  if (keys.includes(name)) return name;
  const norm = normalizeKey(name);
  const exactNorm = keys.find((k) => normalizeKey(k) === norm);
  if (exactNorm) return exactNorm;
  const contains = keys.find((k) => {
    const nk = normalizeKey(k);
    return nk.includes(norm) || norm.includes(nk);
  });
  return contains ?? null;
}

// Build the subset of the Self Model relevant to the selected contexts. Always includes
// boundaries + a trimmed core_self (the model's stable traits/dislikes are always relevant);
// for each selected context, pulls only the matching entry from its section.
export function buildSelfModelSubset(
  model: SelfModelJson | null | undefined,
  selection: ContextSelection,
): Record<string, unknown> {
  const subset: Record<string, unknown> = {};
  if (!model) return subset;

  if (model.core_self && Object.keys(model.core_self).length > 0) {
    subset.core_self = model.core_self;
  }
  if (model.boundaries && Object.keys(model.boundaries).length > 0) {
    subset.boundaries = model.boundaries;
  }

  for (const ctx of selection.contexts) {
    const sectionKey = TYPE_TO_SECTION[ctx.type];
    const section = model[sectionKey] as Record<string, unknown> | undefined;
    const key = matchKey(section, ctx.name);
    if (key && section) {
      const bucket = (subset[sectionKey] as Record<string, unknown> | undefined) ?? {};
      bucket[key] = section[key];
      subset[sectionKey] = bucket;
    }
  }

  return subset;
}

// One-line-per-dimension human-readable summary for the prompt's "Context:" block.
export function buildContextSummary(selection: ContextSelection): string {
  if (selection.contexts.length === 0) {
    return "No specific context selected — predict the user's general voice.";
  }
  const lines = selection.contexts.map((c) => `- ${c.type}: ${c.name}`);
  if (selection.combinationName) {
    lines.unshift(`Combination: ${selection.combinationName}`);
  }
  return lines.join("\n");
}
