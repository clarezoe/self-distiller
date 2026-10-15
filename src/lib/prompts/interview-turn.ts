// Interview Turn prompt: generates the NEXT interviewer message from the real conversation.
// The planner's turns are only a GUIDE; the reply must respond to what the user actually said.

import type { JsonSchema, LlmMessage } from "@/lib/llm/types";

export const INTERVIEW_TURN_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    text: { type: "string" },
    purpose: { type: "string" },
    covers_planned_index: { type: "integer" },
    should_end: { type: "boolean" },
  },
  required: ["text", "purpose", "covers_planned_index", "should_end"],
  additionalProperties: false,
};

export type InterviewTurnResult = {
  text: string;
  purpose: string;
  covers_planned_index: number; // -1 when no planned turn is covered
  should_end: boolean;
};

export type TurnTranscriptItem = {
  speaker: "agent" | "user";
  text: string;
  // Index into the plan's turns this agent turn covered (stored when generated).
  plannedIndex?: number | null;
};

export const MAX_AGENT_TURNS = 12;

// Planned-turn indexes already covered, from `plannedIndex` stored on agent turns.
export function coveredPlannedIndexes(transcript: TurnTranscriptItem[]): Set<number> {
  const covered = new Set<number>();
  for (const t of transcript) {
    if (t.speaker === "agent" && typeof t.plannedIndex === "number" && Number.isInteger(t.plannedIndex)) {
      covered.add(t.plannedIndex);
    }
  }
  return covered;
}

const SYSTEM = `You are the INTERVIEWER in a role-based interview that samples how a user expresses themselves, reacts, and decides. You write the interviewer's NEXT single message.

Rules:
- First respond to what the user ACTUALLY said in their last message: acknowledge, react, or follow up in character. Never ignore it.
- Then steer toward the next unmet sampling purpose from the plan (the plan is a guide, not a script; adapt it to the conversation).
- Natural conversation: ONE message, short like a real chat message from this persona. No lists, no meta commentary.
- Stay in the persona's voice and in the interview language.
- Never repeat a question that was already asked.
- If the user asked the interviewer something, answer briefly in character before continuing.
- If the user corrected the interviewer, accept the correction and adjust.
- Set "should_end" to true when the planned purposes are covered, or after about ${MAX_AGENT_TURNS} interviewer turns; then "text" is a natural closing line in character.
- "purpose": the sampling purpose of this message. "covers_planned_index": the index of the planned turn whose purpose this message serves, or -1 if none.`;

export function buildInterviewTurnMessages(input: {
  goal: string;
  type: string;
  interviewerPersona: string;
  interviewerPersonaDescription?: string;
  interviewerVoiceProfile?: string;
  language?: string;
  targetContexts?: string[];
  expectedSignals?: string[];
  plannedTurns?: Array<{ text: string; purpose: string }>;
  transcript: TurnTranscriptItem[];
}): LlmMessage[] {
  const language = input.language?.trim();
  const description = input.interviewerPersonaDescription?.trim();
  const voice = input.interviewerVoiceProfile?.trim();
  const covered = coveredPlannedIndexes(input.transcript);
  const planned = input.plannedTurns ?? [];
  const agentTurns = input.transcript.filter((t) => t.speaker === "agent").length;
  const lastUser = [...input.transcript].reverse().find((t) => t.speaker === "user");

  const personaBlock = description
    ? `Interviewer persona: ${input.interviewerPersona} — ${description}\nStay FULLY in character as this specific person: tone, vocabulary, directness, warmth.`
    : `Interviewer persona: ${input.interviewerPersona}`;
  const voiceBlock = voice
    ? `Interviewer's real speaking style (distilled from messages this person actually wrote):\n${voice}\nMatch this style: wording, message length, punctuation, emoji use, language mix. Do not copy example lines verbatim.`
    : null;
  const languageBlock = language
    ? `Interview language: ${language}. Write the "text" field ENTIRELY in ${language}.`
    : null;
  const contextBlock =
    input.targetContexts && input.targetContexts.length > 0
      ? `Target context(s): ${input.targetContexts.join(", ")}`
      : null;
  const signalsBlock =
    input.expectedSignals && input.expectedSignals.length > 0
      ? `Expected signals:\n- ${input.expectedSignals.join("\n- ")}`
      : null;
  const planBlock =
    planned.length > 0
      ? `Planned turns (GUIDE only):\n${planned
          .map((p, i) => `${i}. [${covered.has(i) ? "COVERED" : "unmet"}] purpose: ${p.purpose} | e.g. "${p.text}"`)
          .join("\n")}`
      : "No stored plan: steer by the goal alone.";
  const transcriptBlock = input.transcript
    .map((t) => `${t.speaker === "agent" ? input.interviewerPersona : "User"}: ${t.text}`)
    .join("\n");

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: [
        `Goal: ${input.goal}`,
        `Interview type: ${input.type}`,
        personaBlock,
        voiceBlock,
        languageBlock,
        contextBlock,
        signalsBlock,
        planBlock,
        `Interviewer turns so far: ${agentTurns}`,
        `\nTranscript so far:\n${transcriptBlock}`,
        lastUser ? `\nThe user's LAST message (respond to this first):\n${lastUser.text}` : null,
        "\nReturn the next interviewer message as structured JSON: text, purpose, covers_planned_index, should_end.",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}
