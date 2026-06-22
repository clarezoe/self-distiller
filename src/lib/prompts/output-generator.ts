// Output Generator prompt (PRD §13.6, §14, §16.1).
// Produces what the USER would likely say/write in the selected context — NOT the best AI
// answer. Plain-text completion (no schema): the model returns only the draft. Respects the
// routed polish level (simulate vs polished) and, for non-native languages, controls grammar
// correction by polish level rather than auto-perfecting the user.
//
// Draft Mode only: the output is always a draft for the user to review and send themselves.

import type { LlmMessage } from "@/lib/llm/types";

// Per-task-type guidance so the generator produces the right artifact shape.
const TASK_GUIDANCE: Record<string, string> = {
  chat_reply: "Write a chat reply the user would actually send. Match their real message length and rhythm.",
  copywriting: "Write copy in the user's voice — their hooks, sentence shapes, and the things they avoid.",
  video_script: "Write a video script in the user's spoken style and pacing.",
  course: "Write course content in the user's teaching voice and structure.",
  email: "Write an email in the user's email style for this relationship/role.",
  sales_reply: "Write a sales/customer reply the way this user converts, in their tone.",
  rewrite: "Rewrite the provided text in the user's voice without changing its meaning.",
  decision_support: "Respond the way the user reasons through this kind of decision — their framing and priorities.",
};

const SYSTEM = `You generate a DRAFT in the user's own voice (PRD §13.6).

Hard rules:
- Do NOT produce the "best" or most helpful assistant answer. Produce what THIS user would likely
  say or write in the given context — including their typical length, directness, structure, tone,
  relationship distance, and reasonable imperfections.
- Use ONLY the provided Self Model subset for this context. Do not invent traits it does not support.
  Where a dimension has no signal, stay neutral instead of inventing a personality.
- Respect the polish level:
  - Low (0-1, "simulate"): preserve the user's real habits, short forms, filler, emoji, and any
    non-native-language traces. Do not clean them up.
  - Higher (2-4, "polished"): allow moderate improvement, but keep it recognizably the user.
  - For a non-native language, control grammar correction by the polish level and any polish_policy
    in the model. Do not always mimic mistakes, and do not turn the user into a perfect native speaker.
- Reply in the context's language.
- This is a DRAFT for the user to review and send themselves. Never claim it was sent.
- Return ONLY the draft text — no preamble, no labels, no explanation, no surrounding quotes.`;

export function buildOutputGeneratorMessages(input: {
  taskType: string;
  mode: string;
  polishLevel: number;
  contextSummary: string;
  selfModelSubset: unknown;
  taskInput: string;
  routerNotes?: string;
}): LlmMessage[] {
  const modelBlock = JSON.stringify(input.selfModelSubset ?? {}, null, 2);
  const guidance = TASK_GUIDANCE[input.taskType] ?? "Write in the user's voice for this task.";
  const notes = input.routerNotes?.trim() ? `Routing notes: ${input.routerNotes.trim()}` : null;

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Task type: ${input.taskType} — ${guidance}`,
        `Mode: ${input.mode}`,
        `Polish level: ${input.polishLevel} (0 = simulate the user exactly, 4 = polished)`,
        notes,
        "",
        "Context:",
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
        "Return ONLY the draft the user would write.",
      ]
        .filter((l) => l !== null)
        .join("\n"),
    },
  ];
}
