import { runAgent } from "@/lib/llm";
import { getActiveModel, modelRowToJson } from "./version";
import {
  buildInterviewPlannerMessages,
  INTERVIEW_PLAN_SCHEMA,
  type InterviewPlan,
  type PlannerSelfModelSubset,
} from "@/lib/prompts/interview-planner";
import {
  buildInterviewExtractorMessages,
  INTERVIEW_EXTRACTION_SCHEMA,
  type InterviewExtractionResult,
} from "@/lib/prompts/interview-extractor";
import {
  getInterviewForUser,
  getTranscript,
  listInterviews,
  setExtractionReport,
} from "@/lib/services/interviews";
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
    targetContextIds?: string[];
    language?: string;
    goal?: string;
  },
): Promise<InterviewPlan> {
  const [active, previous] = await Promise.all([
    getActiveModel(projectId),
    listInterviews(projectId),
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
