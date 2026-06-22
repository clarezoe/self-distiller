// Task Output agents (PRD §13.5, §13.6, §16.3, §6.5, §9.4) — Phase 5.
// Thin glue around runAgent, mirroring src/lib/self-model/calibration.ts. Resolves the active
// Self Model + context subset, then runs:
//   - checkSensitive  → boundary screen (PRD §16.3) BEFORE drafting.
//   - routePersona    → polish level + boundary warnings + coverage (PRD §13.5).
//   - generateOutput  → the draft text in the user's voice (PRD §13.6). Draft Mode only.

import { runAgent } from "@/lib/llm";
import { getActiveModel, modelRowToJson } from "./version";
import {
  buildSelfModelSubset,
  buildContextSummary,
  type ContextSelection,
} from "./context-subset";
import {
  buildSensitiveCheckMessages,
  SENSITIVE_CHECK_SCHEMA,
  type SensitiveCheckResult,
} from "@/lib/prompts/sensitive-check";
import {
  buildPersonaRouterMessages,
  PERSONA_ROUTE_SCHEMA,
  type PersonaRoute,
} from "@/lib/prompts/persona-router";
import { buildOutputGeneratorMessages } from "@/lib/prompts/output-generator";
import type { SelfModelJson } from "./schema";

// Resolve the active model JSON + the {subset, summary} for a context selection.
// Mirrors calibration.ts so the same subset assembly feeds the output agents.
export async function resolveOutputContext(projectId: string, selection: ContextSelection) {
  const active = await getActiveModel(projectId);
  const model: SelfModelJson | null = active ? modelRowToJson(active) : null;
  return {
    model,
    subset: buildSelfModelSubset(model, selection),
    summary: buildContextSummary(selection),
  };
}

// Sensitive-topic screen (PRD §16.3). Structured. Run BEFORE generating a draft so the caller can
// surface a takeover notice instead of a send-ready draft. Defensive default: if the model returns
// nothing parseable, treat as non-sensitive (it never auto-sends anyway — the user reviews).
export async function checkSensitive(
  userId: string,
  projectId: string,
  input: { taskType: string; input: string; contextSummary: string },
): Promise<SensitiveCheckResult> {
  const messages = buildSensitiveCheckMessages(input);
  const result = await runAgent<SensitiveCheckResult>({
    userId,
    projectId,
    agentRole: "persona_router",
    messages,
    schema: { name: "sensitive_check", schema: SENSITIVE_CHECK_SCHEMA },
    temperature: 0,
  });
  const parsed = result.parsed;
  if (!parsed || typeof parsed.sensitive !== "boolean") {
    return { sensitive: false, category: "none", reason: "" };
  }
  return parsed;
}

// Persona Router (PRD §13.5). Structured, strict:false (subset has dynamic context keys).
// Validates the selection, recommends a polish level, flags boundary warnings + coverage.
export async function routePersona(
  userId: string,
  projectId: string,
  input: {
    taskType: string;
    mode: string;
    contextSummary: string;
    selfModelSubset: unknown;
    taskInput: string;
  },
): Promise<PersonaRoute> {
  const messages = buildPersonaRouterMessages(input);
  const result = await runAgent<PersonaRoute>({
    userId,
    projectId,
    agentRole: "persona_router",
    messages,
    schema: { name: "persona_route", schema: PERSONA_ROUTE_SCHEMA, strict: false },
    temperature: 0.2,
  });
  const parsed = result.parsed;
  // Sensible default polish if routing fails: 1 (mostly simulate the user).
  if (!parsed || typeof parsed.polish_level !== "number") {
    return { polish_level: 1 };
  }
  return parsed;
}

// Output Generator (PRD §13.6). Plain-text completion (no schema) — returns the draft. Draft Mode
// only; the draft is never auto-sent.
export async function generateOutput(
  userId: string,
  projectId: string,
  input: {
    taskType: string;
    mode: string;
    polishLevel: number;
    contextSummary: string;
    selfModelSubset: unknown;
    taskInput: string;
    routerNotes?: string;
  },
): Promise<string> {
  const messages = buildOutputGeneratorMessages(input);
  const result = await runAgent<unknown>({
    userId,
    projectId,
    agentRole: "output_generator",
    messages,
    temperature: 0.7,
  });
  const text = result.text?.trim();
  if (!text) {
    throw new Error("Output generation returned no text. Try again or check the model/credential.");
  }
  return text;
}
