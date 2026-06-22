// Deterministic Self Model merge (PRD §15.1, §23). PURE function — no IO, fully unit-tested.
// Shared by Interview (Phase 3) and Blind Calibration (Phase 4).
//
// `applyProposal(current, proposal)` merges a proposal's partial §12 fragment into the
// current Self Model WITHOUT blowing away unrelated sections. The proposal carries a
// `values` object shaped like a partial SelfModelJson (e.g. { relationship_models: { close_friend: {...} } });
// only the keys present in `values` are touched. The result is a NEW object (no mutation of inputs).

import {
  emptySelfModel,
  type SelfModelJson,
} from "./schema";

export type UpdateProposalLike = {
  summary?: string;
  affected_paths?: string[];
  values?: Record<string, unknown>;
};

// Top-level §12 sections that are maps of user-defined context keys.
const CONTEXT_MAP_SECTIONS = [
  "language_models",
  "role_models",
  "relationship_models",
  "scene_models",
] as const;

// Top-level §12 sections that are objects of string[] (and scalar) fields.
const OBJECT_SECTIONS = ["core_self", "current_state", "boundaries"] as const;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Merge a single field value. Arrays union (dedupe, preserve order). Objects recurse.
// Scalars overwrite (a proposal restates the field).
function mergeField(prev: unknown, next: unknown): unknown {
  if (Array.isArray(next)) {
    const prevArr = Array.isArray(prev) ? prev : [];
    const seen = new Set<string>();
    const out: unknown[] = [];
    for (const item of [...prevArr, ...next]) {
      const key = typeof item === "string" ? item : JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }
  if (isPlainObject(next)) {
    const base = isPlainObject(prev) ? prev : {};
    return mergeObjects(base, next);
  }
  // Scalar (string/number/boolean) — overwrite with the proposed value.
  return next;
}

function mergeObjects(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (v === undefined) continue;
    out[k] = mergeField(out[k], v);
  }
  return out;
}

// Deep-clone the current model so inputs are never mutated. JSON round-trip is safe
// because the Self Model is plain JSON.
function clone(model: SelfModelJson): SelfModelJson {
  return JSON.parse(JSON.stringify(model)) as SelfModelJson;
}

export function applyProposal(
  currentModelJson: SelfModelJson | null | undefined,
  proposal: UpdateProposalLike | null | undefined,
): SelfModelJson {
  const current = currentModelJson ? clone(currentModelJson) : emptySelfModel();
  const values = proposal?.values;
  if (!isPlainObject(values)) return current;

  const out = current as unknown as Record<string, unknown>;

  // Context-map sections: merge per user-defined key, never replacing sibling keys.
  for (const section of CONTEXT_MAP_SECTIONS) {
    const incoming = values[section];
    if (!isPlainObject(incoming)) continue;
    const existing = isPlainObject(out[section]) ? (out[section] as Record<string, unknown>) : {};
    const merged: Record<string, unknown> = { ...existing };
    for (const [ctxKey, ctxVal] of Object.entries(incoming)) {
      if (ctxVal === undefined) continue;
      merged[ctxKey] = mergeField(existing[ctxKey], ctxVal);
    }
    out[section] = merged;
  }

  // Object sections (core_self / current_state / boundaries): deep-merge fields.
  for (const section of OBJECT_SECTIONS) {
    const incoming = values[section];
    if (!isPlainObject(incoming)) continue;
    const existing = isPlainObject(out[section]) ? (out[section] as Record<string, unknown>) : {};
    out[section] = mergeObjects(existing, incoming);
  }

  // unknowns: array-union if the proposal restates it.
  if (Array.isArray(values.unknowns)) {
    out.unknowns = mergeField(out.unknowns, values.unknowns);
  }

  return out as unknown as SelfModelJson;
}

// Normalize/dedupe affected paths for the ModelUpdate record. Falls back to inferring
// touched top-level sections from `values` when the proposal omits affected_paths.
export function resolveAffectedPaths(proposal: UpdateProposalLike | null | undefined): string[] {
  const fromProposal = Array.isArray(proposal?.affected_paths)
    ? proposal!.affected_paths!.filter((p): p is string => typeof p === "string" && p.length > 0)
    : [];
  if (fromProposal.length > 0) return [...new Set(fromProposal)];

  const values = proposal?.values;
  if (!isPlainObject(values)) return [];
  return [...new Set(Object.keys(values))];
}
