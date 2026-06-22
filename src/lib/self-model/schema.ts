// Self Model structure (PRD §12). Stored as JSONB columns on SelfModel, displayed as Markdown.
// `SelfModelJson` is the canonical shape; the per-column DB layout mirrors these keys.

import type { JsonSchema } from "@/lib/llm/types";

export type LanguageModel = {
  voice_summary?: string;
  sentence_patterns?: string[];
  tone_patterns?: string[];
  common_words?: string[];
  avoid?: string[];
  professional_style?: string;
  casual_style?: string;
  current_level?: string;
  common_mistakes?: string[];
  improvement_trend?: string;
  polish_policy?: Record<string, number>;
  confidence?: number;
};

export type RoleModel = {
  style_summary?: string;
  feedback_style?: string;
  conflict_style?: string;
  task_assignment_style?: string;
  comfort_style?: string;
  worry_style?: string;
  discipline_style?: string;
  boundaries?: string[];
  evidence_ids?: string[];
};

export type RelationshipModel = {
  style_summary?: string;
  humor?: string;
  comfort_style?: string;
  reply_length?: string;
  emoji_policy?: string;
  sensitive_boundaries?: string[];
  evidence_ids?: string[];
};

export type SceneModel = {
  default_intent?: string;
  typical_structure?: string[];
  avoid?: string[];
};

export type CoreSelf = {
  identity?: string[];
  values?: string[];
  long_term_preferences?: string[];
  decision_patterns?: string[];
  communication_boundaries?: string[];
  stable_dislikes?: string[];
};

export type CurrentState = {
  recent_changes?: string[];
  temporary_mood_patterns?: string[];
  language_progress?: string[];
};

export type Boundaries = {
  must_not_invent?: string[];
  requires_user_confirmation?: string[];
  sensitive_topics?: string[];
};

export type SuggestedInterview = {
  goal: string;
  interviewer_persona?: string;
  target_context?: string;
};

export type SelfModelJson = {
  version: string;
  core_self: CoreSelf;
  language_models: Record<string, LanguageModel>;
  role_models: Record<string, RoleModel>;
  relationship_models: Record<string, RelationshipModel>;
  scene_models: Record<string, SceneModel>;
  current_state: CurrentState;
  boundaries: Boundaries;
  unknowns: string[];
  suggested_interviews?: SuggestedInterview[];
};

const stringArray = { type: "array", items: { type: "string" } } as const;

// JSON Schema for structured LLM output of a generated Self Model.
// `additionalProperties: true` on the per-context maps because keys (zh/en/sv, boss/mother, …)
// are user-defined and composable (PRD §23.8 — do not hardcode contexts).
export const SELF_MODEL_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    version: { type: "string" },
    core_self: {
      type: "object",
      properties: {
        identity: stringArray,
        values: stringArray,
        long_term_preferences: stringArray,
        decision_patterns: stringArray,
        communication_boundaries: stringArray,
        stable_dislikes: stringArray,
      },
      additionalProperties: false,
    },
    language_models: { type: "object", additionalProperties: true },
    role_models: { type: "object", additionalProperties: true },
    relationship_models: { type: "object", additionalProperties: true },
    scene_models: { type: "object", additionalProperties: true },
    current_state: {
      type: "object",
      properties: {
        recent_changes: stringArray,
        temporary_mood_patterns: stringArray,
        language_progress: stringArray,
      },
      additionalProperties: false,
    },
    boundaries: {
      type: "object",
      properties: {
        must_not_invent: stringArray,
        requires_user_confirmation: stringArray,
        sensitive_topics: stringArray,
      },
      additionalProperties: false,
    },
    unknowns: stringArray,
    suggested_interviews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          goal: { type: "string" },
          interviewer_persona: { type: "string" },
          target_context: { type: "string" },
        },
        required: ["goal"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "core_self",
    "language_models",
    "role_models",
    "relationship_models",
    "scene_models",
    "current_state",
    "boundaries",
    "unknowns",
  ],
  additionalProperties: false,
};

// Empty/normalized Self Model — used as a base and to coerce partial LLM output.
export function emptySelfModel(version = "0.1"): SelfModelJson {
  return {
    version,
    core_self: {},
    language_models: {},
    role_models: {},
    relationship_models: {},
    scene_models: {},
    current_state: {},
    boundaries: {},
    unknowns: [],
    suggested_interviews: [],
  };
}

// Coerce a possibly-partial LLM result into a complete SelfModelJson with the given version.
export function normalizeSelfModel(
  raw: Partial<SelfModelJson> | null | undefined,
  version: string,
): SelfModelJson {
  const base = emptySelfModel(version);
  if (!raw || typeof raw !== "object") return base;
  return {
    version,
    core_self: { ...base.core_self, ...(raw.core_self ?? {}) },
    language_models: { ...(raw.language_models ?? {}) },
    role_models: { ...(raw.role_models ?? {}) },
    relationship_models: { ...(raw.relationship_models ?? {}) },
    scene_models: { ...(raw.scene_models ?? {}) },
    current_state: { ...base.current_state, ...(raw.current_state ?? {}) },
    boundaries: { ...base.boundaries, ...(raw.boundaries ?? {}) },
    unknowns: Array.isArray(raw.unknowns) ? raw.unknowns : [],
    suggested_interviews: Array.isArray(raw.suggested_interviews)
      ? raw.suggested_interviews
      : [],
  };
}
