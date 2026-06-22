import { prisma } from "@/lib/db";
import { InterviewType } from "@/generated/prisma/client";

export const INTERVIEW_TYPES = [
  InterviewType.daily,
  InterviewType.information,
  InterviewType.role,
  InterviewType.language,
  InterviewType.relationship,
  InterviewType.stress,
  InterviewType.conflict,
  InterviewType.creative,
] as const;

export function isInterviewType(value: string): value is InterviewType {
  return (Object.values(InterviewType) as string[]).includes(value);
}

export type TranscriptTurn = {
  speaker: "agent" | "user";
  text: string;
  timestamp: string;
};

function toTranscript(value: unknown): TranscriptTurn[] {
  if (!Array.isArray(value)) return [];
  return value as TranscriptTurn[];
}

export function listInterviews(projectId: string) {
  return prisma.interview.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createInterview(
  projectId: string,
  data: {
    type: InterviewType;
    interviewerPersona: string;
    targetContextIds?: string[];
    goal: string;
    transcript?: TranscriptTurn[];
  },
) {
  return prisma.interview.create({
    data: {
      projectId,
      type: data.type,
      interviewerPersona: data.interviewerPersona,
      targetContextIds: data.targetContextIds ?? [],
      goal: data.goal,
      transcript: (data.transcript ?? []) as object,
    },
  });
}

// Ownership: an interview is reachable only via a project the user owns.
export async function getInterviewForUser(userId: string, interviewId: string) {
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, project: { userId } },
  });
  if (!interview) throw new Error("Interview not found");
  return interview;
}

// Append one turn to the transcript Json (read-modify-write; transcripts are short).
export async function appendTurn(interviewId: string, turn: TranscriptTurn) {
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview) throw new Error("Interview not found");
  const transcript = toTranscript(interview.transcript);
  transcript.push(turn);
  return prisma.interview.update({
    where: { id: interviewId },
    data: { transcript: transcript as object },
  });
}

export function setExtractionReport(interviewId: string, report: unknown) {
  return prisma.interview.update({
    where: { id: interviewId },
    data: {
      extractionReport: JSON.parse(JSON.stringify(report ?? {})) as object,
    },
  });
}

export function getTranscript(interview: { transcript: unknown }): TranscriptTurn[] {
  return toTranscript(interview.transcript);
}
