import { runAgent } from "@/lib/llm";
import { getActiveModel, modelRowToJson } from "./version";
import {
  buildSelfModelSubset,
  buildContextSummary,
  type ContextSelection,
} from "./context-subset";
import { buildBlindHiddenAnswerMessages } from "@/lib/prompts/blind-hidden-answer";
import {
  buildBlindComparatorMessages,
  BLIND_COMPARISON_SCHEMA,
  type BlindComparisonResult,
} from "@/lib/prompts/blind-comparator";
import type { SelfModelJson } from "./schema";
import type { LlmMessage } from "@/lib/llm/types";

// Resolve the active model JSON + the {subset, summary} for a context selection. Pure-ish
// glue around getActiveModel; callers pass an already-resolved ContextSelection.
async function resolveContext(projectId: string, selection: ContextSelection) {
  const active = await getActiveModel(projectId);
  const model: SelfModelJson | null = active ? modelRowToJson(active) : null;
  return {
    model,
    subset: buildSelfModelSubset(model, selection),
    summary: buildContextSummary(selection),
  };
}

// Optionally generate a calibration scenario when the user didn't supply one (PRD §19.3 —
// "system generates a scenario"). Uses the comparator role only for routing; returns plain text.
export async function generateScenario(
  userId: string,
  projectId: string,
  selection: ContextSelection,
): Promise<string> {
  const { summary } = await resolveContext(projectId, selection);
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: `You write ONE realistic incoming message/scenario to test how a user would reply in a given context.
Keep it short and natural — something a real person in that relationship/role would actually send.
Match the context's language. Do NOT include any reply or commentary. Return ONLY the scenario text.`,
    },
    {
      role: "user",
      content: `Context:\n${summary}\n\nWrite one realistic incoming message the user would have to respond to. Return ONLY that message.`,
    },
  ];

  const result = await runAgent<unknown>({
    userId,
    projectId,
    agentRole: "blind_hidden",
    messages,
    temperature: 0.9,
  });

  const text = result.text?.trim();
  if (!text) throw new Error("Could not generate a scenario. Try again or provide one.");
  return text;
}

// Generate the HIDDEN predicted reply (PRD §14.1). The returned text is stored server-side as
// BlindCalibration.hiddenAgentAnswer and MUST NOT be returned to the client before the user
// submits their own answer (PRD §23.9). No schema — the agent returns the reply text.
export async function generateHiddenAnswer(
  userId: string,
  projectId: string,
  selection: ContextSelection,
  scenario: string,
  incomingMessage?: string | null,
): Promise<string> {
  const { subset, summary } = await resolveContext(projectId, selection);

  const messages = buildBlindHiddenAnswerMessages({
    contextSummary: summary,
    selfModelSubset: subset,
    scenario,
    incomingMessage,
  });

  const result = await runAgent<unknown>({
    userId,
    projectId,
    agentRole: "blind_hidden",
    messages,
    temperature: 0.7,
  });

  const text = result.text?.trim();
  if (!text) {
    throw new Error("Hidden-answer generation returned no text. Try again or check the model/credential.");
  }
  return text;
}

// Compare the hidden agent answer vs the user's real answer (PRD §14.2). Safe to call only
// AFTER the user has answered. Returns the structured difference report + update proposal.
export async function compareCalibration(
  userId: string,
  projectId: string,
  selection: ContextSelection,
  input: {
    scenario: string;
    incomingMessage?: string | null;
    hiddenAgentAnswer: string;
    userAnswer: string;
  },
): Promise<BlindComparisonResult> {
  const { subset, summary } = await resolveContext(projectId, selection);

  const messages = buildBlindComparatorMessages({
    contextSummary: summary,
    selfModelSubset: subset,
    scenario: input.scenario,
    incomingMessage: input.incomingMessage,
    hiddenAgentAnswer: input.hiddenAgentAnswer,
    userAnswer: input.userAnswer,
  });

  const result = await runAgent<BlindComparisonResult>({
    userId,
    projectId,
    agentRole: "blind_comparator",
    messages,
    // strict:false — update_proposal carries open-ended `values` (a partial §12 fragment with
    // user-defined context keys), which OpenAI strict mode forbids.
    schema: { name: "blind_comparison", schema: BLIND_COMPARISON_SCHEMA, strict: false },
  });

  const report = result.parsed;
  if (!report || !report.update_proposal) {
    throw new Error("Comparator returned no structured report. Try again or check the model/credential.");
  }
  return report;
}
