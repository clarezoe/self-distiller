import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { createInterview } from "@/lib/services/interviews";
import { planInterview } from "@/lib/self-model/interview";
import type { InterviewType } from "@/generated/prisma/client";

const createSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(["daily", "information", "role", "language", "relationship", "stress", "conflict", "creative"]),
  interviewerPersona: z.string().min(1),
  targetContextIds: z.array(z.string().min(1)).optional(),
  // Language the interview is CONDUCTED in (zh/en/sv/... or a free label). Independent of UI locale.
  language: z.string().min(1).max(64).optional(),
  goal: z.string().optional(),
});

// POST /api/interviews (PRD §18.5) — plan an interview (LLM) and persist it.
// The first interviewer turn seeds the transcript so the chat surface can start.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let project;
  try {
    project = await getProjectForUser(user.id, parsed.data.projectId);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const plan = await planInterview(user.id, project.id, {
      type: parsed.data.type as InterviewType,
      interviewerPersona: parsed.data.interviewerPersona,
      targetContextIds: parsed.data.targetContextIds,
      language: parsed.data.language,
      goal: parsed.data.goal,
    });

    const now = new Date().toISOString();
    const interview = await createInterview(project.id, {
      type: parsed.data.type as InterviewType,
      interviewerPersona: plan.interviewer_persona || parsed.data.interviewerPersona,
      targetContextIds: parsed.data.targetContextIds ?? [],
      language: parsed.data.language,
      goal: plan.goal,
      // Seed the transcript with the first planned interviewer turn.
      transcript: [{ speaker: "agent", text: plan.turns[0].text, timestamp: now }],
    });

    return NextResponse.json(
      {
        id: interview.id,
        goal: plan.goal,
        interviewerPersona: interview.interviewerPersona,
        language: interview.language,
        plannedTurns: plan.turns,
        expectedSignals: plan.expected_signals,
        transcript: interview.transcript,
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to plan interview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
