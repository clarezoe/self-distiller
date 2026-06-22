// Blind Calibration — Hidden Answer prompt (PRD §14.1, §13.4).
// Predicts how the USER would actually reply in the selected context. NOT an ideal
// assistant answer; do not over-polish. Uses only the selected Self Model subset and
// respects the chosen language / role / relationship / scene / polish level.
//
// The output of this agent is the BlindCalibration.hiddenAgentAnswer — it must be
// stored server-side and NEVER returned to the client before the user submits their
// own answer (PRD §23.9). This prompt has no schema: the model returns the reply text.

import type { LlmMessage } from "@/lib/llm/types";

const SYSTEM = `You are generating a HIDDEN predicted reply for the user in a blind calibration test.

Goal: predict how THIS user would actually respond in the given context — not an ideal assistant answer.

Hard rules (PRD §14.1):
- Do NOT generate the "best" or most helpful answer. Generate what the user would likely say.
- Do NOT over-polish. Preserve the user's real habits: their typical length, directness, tone,
  relationship distance, sentence shape, emoji/filler use, and any reasonable imperfections.
- Use ONLY the provided Self Model subset for this context. Do not invent traits not supported by it.
- Respect the selected language, role, relationship, scene, and polish level.
  If the model has no signal for some dimension, stay neutral rather than inventing a personality.
- Reply in the context's language.
- Return ONLY the predicted user reply text — no preamble, no quotes, no explanation, no labels.`;

export function buildBlindHiddenAnswerMessages(input: {
  contextSummary: string;
  selfModelSubset: unknown;
  scenario: string;
  incomingMessage?: string | null;
}): LlmMessage[] {
  const modelBlock = JSON.stringify(input.selfModelSubset ?? {}, null, 2);
  const incoming = input.incomingMessage?.trim()
    ? `Incoming message:\n"""\n${input.incomingMessage.trim()}\n"""`
    : "No separate incoming message — respond to the scenario directly.";

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        "Context:",
        input.contextSummary,
        "",
        "Self Model subset (only what is known for this context):",
        "```json",
        modelBlock,
        "```",
        "",
        "Scenario:",
        '"""',
        input.scenario,
        '"""',
        "",
        incoming,
        "",
        "Return ONLY the predicted user reply.",
      ].join("\n"),
    },
  ];
}
