// Interview Planner prompt (PRD §13.2).
// Plans a role-based interview that actively SAMPLES the user — every interview has a
// concrete sampling goal and elicits behavior, not abstract self-description.

import type { JsonSchema, LlmMessage } from "@/lib/llm/types";

// Strict-mode compatible (OpenAI Structured Outputs): every property is listed in
// `required`, every object sets additionalProperties:false, and no unsupported
// keywords (minItems/...) are used. "5-10 turns" is enforced by the prompt + a
// runtime check, not by the schema.
export const INTERVIEW_PLAN_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    goal: { type: "string" },
    interviewer_persona: { type: "string" },
    turns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          purpose: { type: "string" },
        },
        required: ["text", "purpose"],
        additionalProperties: false,
      },
    },
    expected_signals: { type: "array", items: { type: "string" } },
  },
  required: ["goal", "interviewer_persona", "turns", "expected_signals"],
  additionalProperties: false,
};

export type InterviewPlan = {
  goal: string;
  interviewer_persona: string;
  turns: Array<{ text: string; purpose: string }>;
  expected_signals: string[];
};

export type PlannerSelfModelSubset = {
  unknowns?: string[];
  suggested_interviews?: Array<{ goal: string; interviewer_persona?: string; target_context?: string }>;
  core_self?: Record<string, unknown>;
};

const INTERVIEW_TYPE_HINTS: Record<string, string> = {
  daily: "Light daily-life sampling: collect facts, preferences, background through natural conversation.",
  information: "Collect concrete facts, preferences, and background.",
  role: "Sample how the user behaves IN a specific role (boss/parent/teacher/etc.) by role-playing the counterpart.",
  relationship: "Sample how the user communicates with a specific type of person; role-play that relationship.",
  language: "Sample expression patterns in a specific language; elicit real phrasing, not translation.",
  conflict: "Sample how the user pushes back, refuses, or handles frustration. Apply gentle but real friction.",
  stress: "Sample how the user explains, compresses, defends, or revises thoughts under pressure or challenge.",
  creative: "Sample how the user forms ideas, tells stories, and explains products.",
};

const SYSTEM = `You plan a role-based interview to actively SAMPLE how a user expresses themselves, reacts, and decides.

Hard rules (PRD §13.2):
- Every interview MUST have ONE concrete sampling goal. No vague "what kind of person are you" questions.
- Questions must elicit user BEHAVIOR, not abstract self-description. Prefer simulated real interactions:
  e.g. "I'm your subordinate. I missed the deadline and didn't tell you in advance. What do you say to me?"
  over "How do you handle delays as a boss?".
- The interviewer ADOPTS the given persona and stays in character (subordinate, close friend, child, customer, skeptic, formal interviewer, future-self, etc.).
- Produce 5-10 turns. Each turn is what the INTERVIEWER says to the user (a question or a simulated message the user must respond to). Each turn also states its sampling "purpose".
- Target the model's known unknowns and the requested target context (language/role/relationship/scene).
- If the user corrects the interviewer during the real interview, that is a high-value signal — but you only plan the interviewer side here.
- "expected_signals": the specific patterns this interview should reveal (tone, directness, reply length, comfort style, correction behavior, language quirks, etc.).`;

export function buildInterviewPlannerMessages(input: {
  type: string;
  interviewerPersona: string;
  goal?: string;
  targetContexts?: string[];
  modelSubset?: PlannerSelfModelSubset;
  previousGoals?: string[];
}): LlmMessage[] {
  const typeHint = INTERVIEW_TYPE_HINTS[input.type] ?? "Sample the requested context.";
  const unknowns = input.modelSubset?.unknowns ?? [];
  const suggested = input.modelSubset?.suggested_interviews ?? [];

  const contextBlock =
    input.targetContexts && input.targetContexts.length > 0
      ? `Target context(s): ${input.targetContexts.join(", ")}`
      : "Target context: not specified — keep the sampling focused regardless.";

  const unknownsBlock = unknowns.length > 0 ? `Known model unknowns to target:\n- ${unknowns.join("\n- ")}` : null;
  const suggestedBlock =
    suggested.length > 0
      ? `Previously suggested interviews:\n- ${suggested.map((s) => s.goal).join("\n- ")}`
      : null;
  const previousBlock =
    input.previousGoals && input.previousGoals.length > 0
      ? `Already-run interview goals (avoid duplicating, build on them):\n- ${input.previousGoals.join("\n- ")}`
      : null;

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Interview type: ${input.type} — ${typeHint}`,
        `Interviewer persona: ${input.interviewerPersona}`,
        input.goal ? `Requested goal: ${input.goal}` : "No explicit goal given — derive one concrete sampling goal.",
        contextBlock,
        unknownsBlock,
        suggestedBlock,
        previousBlock,
        "\nReturn the interview plan as structured JSON: a single concrete goal, the persona, 5-10 interviewer turns (each with text + purpose), and expected_signals.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}
