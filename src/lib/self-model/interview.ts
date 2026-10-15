import { runAgent } from "@/lib/llm";
import { getActiveModel, modelRowToJson } from "./version";
import {
  buildInterviewPlannerMessages,
  INTERVIEW_PLAN_SCHEMA,
  type InterviewPlan,
  type PlannerSelfModelSubset,
} from "@/lib/prompts/interview-planner";
import {
  buildInterviewTurnMessages,
  INTERVIEW_TURN_SCHEMA,
  type InterviewTurnResult,
} from "@/lib/prompts/interview-turn";
import {
  buildInterviewExtractorMessages,
  INTERVIEW_EXTRACTION_SCHEMA,
  type InterviewExtractionResult,
} from "@/lib/prompts/interview-extractor";
import {
  getInterviewForUser,
  appendTurn,
  getTranscript,
  listInterviews,
  setExtractionReport,
} from "@/lib/services/interviews";
import { getPersonaVoiceProfile } from "@/lib/services/interviewer-personas";
import type { TranscriptTurn } from "@/lib/services/interviews";
import type { InterviewType } from "@/generated/prisma/client";

// Plan a role-based interview (LLM, PRD §13.2). Returns the structured plan; the caller
// persists an Interview row (goal + persona + transcript seeded with the first agent turn).
export async function planInterview(
  userId: string,
  projectId: string,
  input: {
    type: InterviewType;
    interviewerPersona: string;
    interviewerPersonaDescription?: string;
    // Saved persona id: its distilled voice profile (if any) is looked up here, scoped by project.
    interviewerPersonaId?: string;
    targetContextIds?: string[];
    language?: string;
    goal?: string;
  },
): Promise<InterviewPlan> {
  const [active, previous, voiceProfile] = await Promise.all([
    getActiveModel(projectId),
    listInterviews(projectId),
    input.interviewerPersonaId ? getPersonaVoiceProfile(projectId, input.interviewerPersonaId) : Promise.resolve(null),
  ]);

  const modelSubset: PlannerSelfModelSubset | undefined = active
    ? (() => {
        const json = modelRowToJson(active);
        return {
          unknowns: json.unknowns,
          suggested_interviews: json.suggested_interviews,
          core_self: json.core_self as Record<string, unknown>,
        };
      })()
    : undefined;

  const messages = buildInterviewPlannerMessages({
    type: input.type,
    interviewerPersona: input.interviewerPersona,
    interviewerPersonaDescription: input.interviewerPersonaDescription,
    interviewerVoiceProfile: voiceProfile ?? undefined,
    goal: input.goal,
    targetContexts: input.targetContextIds,
    language: input.language,
    modelSubset,
    previousGoals: previous.map((i) => i.goal),
  });

  const result = await runAgent<InterviewPlan>({
    userId,
    projectId,
    agentRole: "interview_planner",
    messages,
    schema: { name: "interview_plan", schema: INTERVIEW_PLAN_SCHEMA },
  });

  const plan = result.parsed;
  if (!plan || !Array.isArray(plan.turns) || plan.turns.length === 0) {
    throw new Error("Planner returned no structured turns. Try again or check the model/credential.");
  }
  return plan;
}

// Extract an interview (LLM, PRD §13.3, §14.3) → store report + proposal on the Interview row.
export async function extractInterview(
  userId: string,
  projectId: string,
  interviewId: string,
): Promise<InterviewExtractionResult> {
  const interview = await getInterviewForUser(userId, interviewId);
  if (interview.projectId !== projectId) throw new Error("Interview not found");

  const transcript = getTranscript(interview);
  if (transcript.length === 0) {
    throw new Error("Interview has no transcript to extract from.");
  }

  const messages = buildInterviewExtractorMessages({
    goal: interview.goal,
    interviewerPersona: interview.interviewerPersona,
    type: interview.type,
    targetContexts: interview.targetContextIds,
    language: interview.language ?? undefined,
    transcript: transcript.map((t) => ({ speaker: t.speaker, text: t.text })),
  });

  const result = await runAgent<InterviewExtractionResult>({
    userId,
    projectId,
    agentRole: "interview_extractor",
    messages,
    // strict:false — update_proposal carries open-ended `values` (a partial §12 fragment
    // with user-defined context keys), which OpenAI strict mode forbids.
    schema: { name: "interview_extraction", schema: INTERVIEW_EXTRACTION_SCHEMA, strict: false },
  });

  const report = result.parsed;
  if (!report || !report.update_proposal) {
    throw new Error("Extractor returned no structured report. Try again or check the model/credential.");
  }

  await setExtractionReport(interviewId, report);
  return report;
}

// Generate the next interviewer turn from the real conversation (LLM). The stored plan is only
// a guide; interviews without a plan fall back to transcript + goal.
export async function nextInterviewTurn(
  userId: string,
  projectId: string,
  interviewId: string,
): Promise<{ transcript: TranscriptTurn[]; done: boolean }> {
  const interview = await getInterviewForUser(userId, interviewId);
  if (interview.projectId !== projectId) throw new Error("Interview not found");

  const transcript = getTranscript(interview);
  const plan = interview.plan as Partial<InterviewPlan> | null;
  const plannedTurns = Array.isArray(plan?.turns) ? plan.turns : undefined;
  const voiceProfile = interview.interviewerPersonaId
    ? await getPersonaVoiceProfile(projectId, interview.interviewerPersonaId)
    : null;

  const messages = buildInterviewTurnMessages({
    goal: interview.goal,
    type: interview.type,
    interviewerPersona: interview.interviewerPersona,
    interviewerPersonaDescription: interview.interviewerPersonaDescription ?? undefined,
    interviewerVoiceProfile: voiceProfile ?? undefined,
    language: interview.language ?? undefined,
    targetContexts: interview.targetContextIds,
    expectedSignals: Array.isArray(plan?.expected_signals) ? plan.expected_signals : undefined,
    plannedTurns,
    transcript,
  });

  const result = await runAgent<InterviewTurnResult>({
    userId,
    projectId,
    agentRole: "interview_turn",
    messages,
    schema: { name: "interview_turn", schema: INTERVIEW_TURN_SCHEMA },
  });

  const turn = result.parsed;
  if (!turn || typeof turn.text !== "string" || !turn.text.trim()) {
    throw new Error("Interviewer returned no next turn. Try again or check the model/credential.");
  }

  const idx = turn.covers_planned_index;
  const updated = await appendTurn(interviewId, {
    speaker: "agent",
    text: turn.text.trim(),
    timestamp: new Date().toISOString(),
    plannedIndex: typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null,
  });
  return { transcript: getTranscript(updated), done: Boolean(turn.should_end) };
}
