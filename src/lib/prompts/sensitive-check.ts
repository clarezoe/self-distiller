// Sensitive-topic check prompt (PRD §16.3, §13.6, §23.11).
// Classifies whether a task scenario hits a sensitive category that must force user
// takeover. If sensitive, the service surfaces a boundary warning and the UI shows a
// "please take over" notice INSTEAD of presenting the draft as send-ready (Draft Mode, §16.1).
//
// Structured output (strict-mode compatible: every property required,
// additionalProperties:false, no unsupported keywords).

import type { JsonSchema, LlmMessage } from "@/lib/llm/types";

// The §16.3 sensitive categories the system must stop on (plus "none").
export const SENSITIVE_CATEGORIES = [
  "none",
  "breakup_divorce",
  "self_harm_or_harm",
  "medical",
  "legal",
  "financial_or_large_transaction",
  "hiring_or_firing",
  "sexual",
  "violence",
  "identity_deception",
] as const;

export type SensitiveCategory = (typeof SENSITIVE_CATEGORIES)[number];

export const SENSITIVE_CHECK_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    sensitive: { type: "boolean" },
    category: { type: "string", enum: [...SENSITIVE_CATEGORIES] },
    reason: { type: "string" },
  },
  required: ["sensitive", "category", "reason"],
  additionalProperties: false,
};

export type SensitiveCheckResult = {
  sensitive: boolean;
  category: SensitiveCategory;
  reason: string;
};

const SYSTEM = `You screen a user task for sensitive content before any reply is drafted (PRD §16.3).

The system only ever produces DRAFTS for the user to review and send themselves — it never sends
anything automatically. For certain high-stakes topics the user must take over personally rather than
lean on a draft. Your job is ONLY to detect those topics.

Mark "sensitive": true if the task involves any of these categories, and set "category" accordingly:
- breakup_divorce — breakups, divorce, or serious relationship conflict / ending.
- self_harm_or_harm — self-harm, suicidal ideation, or harm to others.
- medical — medical advice, diagnosis, treatment, medication decisions.
- legal — legal commitments, contracts, legal advice.
- financial_or_large_transaction — financial commitments, investments, large transactions, loans.
- hiring_or_firing — hiring, firing, or other major employment decisions.
- sexual — sexual content or solicitation.
- violence — violent threats or planning.
- identity_deception — impersonation, pretending to be someone else, deception about identity.

If none apply, set "sensitive": false and "category": "none".
Casual mention is enough context — when in doubt about a genuinely high-stakes topic, mark it sensitive.
Do NOT mark ordinary emotional support, venting, or everyday work/relationship talk as sensitive.
Give a one-sentence "reason".`;

export function buildSensitiveCheckMessages(input: {
  taskType: string;
  input: string;
  contextSummary: string;
}): LlmMessage[] {
  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Task type: ${input.taskType}`,
        "",
        "Context:",
        input.contextSummary,
        "",
        "Task input (the message/brief the user wants a draft for):",
        '"""',
        input.input,
        '"""',
        "",
        "Classify sensitivity as JSON.",
      ].join("\n"),
    },
  ];
}
