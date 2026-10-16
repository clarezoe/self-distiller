// Jev quality gate for interview turns: request builder + pure evaluation.

import type { JevNoulQuestion } from "./client";

export const GATE_QUESTIONS = ["responds", "in_character", "not_repeat"] as const;
export type GateQuestion = (typeof GATE_QUESTIONS)[number];

export const GATE_THRESHOLD = 0.5;
export const COVERAGE_THRESHOLD = 0.7;
export const MAX_GATE_TURNS = 12;

const BASE_QUESTIONS: Record<GateQuestion, JevNoulQuestion> = {
  responds: {
    type: "noul",
    instructions:
      "Does `candidate_next_interviewer_message` respond to or acknowledge what the user actually said in their LAST message (including answering any question the user asked), rather than ignoring it?",
  },
  in_character: {
    type: "noul",
    instructions:
      "Is `candidate_next_interviewer_message` written in `interview_language` and does it sound like `interviewer_persona` talking in a chat?",
  },
  not_repeat: {
    type: "noul",
    instructions:
      "Does `candidate_next_interviewer_message` avoid repeating a question the interviewer already asked in `transcript`?",
  },
};

export type GateRequestInput = {
  language?: string;
  persona: string;
  personaDescription?: string;
  goal: string;
  transcript: Array<{ speaker: "agent" | "user"; text: string }>;
  candidate: string;
  plannedTurns?: Array<{ purpose: string }>;
  coveredIndexes: Set<number>;
};

export function buildGateRequest(input: GateRequestInput): {
  state: Record<string, unknown>;
  questions: Record<string, JevNoulQuestion>;
} {
  const desc = input.personaDescription?.trim();
  const unmet = (input.plannedTurns ?? [])
    .map((p, index) => ({ index, purpose: p.purpose }))
    .filter((p) => !input.coveredIndexes.has(p.index));

  const questions: Record<string, JevNoulQuestion> = { ...BASE_QUESTIONS };
  for (const p of unmet) {
    questions[`covered_${p.index}`] = {
      type: "noul",
      instructions: `Has the transcript plus \`candidate_next_interviewer_message\` already elicited the user's behaviour for planned purpose: ${p.purpose}`,
    };
  }

  return {
    state: {
      interview_language: input.language?.trim() || "same as the conversation",
      interviewer_persona: desc ? `${input.persona} (${desc})` : input.persona,
      goal: input.goal,
      transcript: input.transcript.slice(-MAX_GATE_TURNS).map((t) => ({
        speaker: t.speaker === "agent" ? "interviewer" : "user",
        text: t.text,
      })),
      candidate_next_interviewer_message: input.candidate,
      planned_purposes: unmet,
    },
    questions,
  };
}

export type GateResult = { pass: boolean; failed: GateQuestion[]; minScore: number };

export function evaluateGate(answers: Record<string, number>, threshold = GATE_THRESHOLD): GateResult {
  const failed: GateQuestion[] = [];
  let minScore = 1;
  for (const q of GATE_QUESTIONS) {
    const v = answers[q];
    const score = typeof v === "number" ? v : 0;
    if (score < minScore) minScore = score;
    if (score < threshold) failed.push(q);
  }
  return { pass: failed.length === 0, failed, minScore };
}

// Indexes whose `covered_<i>` answer meets the coverage threshold.
export function coveredFromAnswers(answers: Record<string, number>, threshold = COVERAGE_THRESHOLD): number[] {
  const out: number[] = [];
  for (const [k, v] of Object.entries(answers)) {
    const m = /^covered_(\d+)$/.exec(k);
    if (m && v >= threshold) out.push(Number(m[1]));
  }
  return out.sort((a, b) => a - b);
}

const FAIL_NOTES: Record<GateQuestion, (language?: string) => string> = {
  responds: () => "Your previous draft ignored what the user just said. Respond to it first.",
  in_character: (language) =>
    `Write in ${language?.trim() || "the interview language"} and in this persona's casual voice.`,
  not_repeat: () => "Do not repeat a question already asked.",
};

export function regenerationNote(failed: GateQuestion[], language?: string): string {
  return failed.map((f) => FAIL_NOTES[f](language)).join(" ");
}
