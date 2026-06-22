// Persona Router prompt (PRD §13.5).
// In the MVP the user selects context manually; the router validates the selection, confirms
// which model dimensions actually have signal, recommends a polish level (0 = raw/simulate the
// user incl. reasonable imperfections … 4 = heavily polished), and surfaces any boundary
// warnings from the Self Model's boundaries. It does NOT write the draft — it only assembles
// the routing decision the output generator consumes.
//
// Structured output (strict:false — the input subset has user-defined dynamic context keys).

import type { JsonSchema, LlmMessage } from "@/lib/llm/types";

export const PERSONA_ROUTE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    // 0 = simulate the user exactly (preserve length, directness, quirks, reasonable
    // imperfections, non-native traces); 4 = polished. The router proposes; the user's
    // chosen mode (simulate vs polished) can override downstream.
    polish_level: { type: "number" },
    // Which selected dimensions the model actually has trained signal for.
    covered_dimensions: { type: "array", items: { type: "string" } },
    // Selected dimensions with little/no signal — the generator should stay neutral there.
    missing_dimensions: { type: "array", items: { type: "string" } },
    // Plain-language boundary cautions drawn from the model's boundaries / sensitive topics.
    boundary_warnings: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
  },
  required: ["polish_level"],
};

export type PersonaRoute = {
  polish_level: number;
  covered_dimensions?: string[];
  missing_dimensions?: string[];
  boundary_warnings?: string[];
  notes?: string;
};

const SYSTEM = `You are the Persona Router for a personal expression model (PRD §13.5).

The user has manually selected a context (language / role / relationship / scene) and a mode.
You do NOT write any reply. You produce a routing decision the draft generator will consume.

Given the selected context, the chosen mode, and the Self Model subset for that context:
- "polish_level": recommend 0-4. 0 = simulate the user exactly: keep their real length, directness,
  tone, sentence shape, emoji/filler habits, and reasonable imperfections (incl. non-native-language
  traces). 4 = heavily polished. If the user chose "simulate" mode, recommend a LOW level (0-1). If
  they chose "polished" mode, recommend a moderate level. For non-native-language contexts, respect
  any polish_policy in the model rather than auto-correcting the user into a native speaker.
- "covered_dimensions": the selected dimensions the model has real signal for.
- "missing_dimensions": selected dimensions with little/no signal — the generator must stay neutral
  there rather than invent a personality.
- "boundary_warnings": surface anything from the model's boundaries / sensitive_topics /
  requires_user_confirmation that is relevant to this task.
- "notes": one short line of routing guidance.

Return JSON only.`;

export function buildPersonaRouterMessages(input: {
  taskType: string;
  mode: string;
  contextSummary: string;
  selfModelSubset: unknown;
  taskInput: string;
}): LlmMessage[] {
  const modelBlock = JSON.stringify(input.selfModelSubset ?? {}, null, 2);
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Task type: ${input.taskType}`,
        `Mode: ${input.mode}`,
        "",
        "Selected context:",
        input.contextSummary,
        "",
        "Self Model subset for this context:",
        "```json",
        modelBlock,
        "```",
        "",
        "Task input:",
        '"""',
        input.taskInput,
        '"""',
        "",
        "Return the routing decision as JSON.",
      ].join("\n"),
    },
  ];
}
