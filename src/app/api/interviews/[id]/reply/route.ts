import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { appendTurn, getInterviewForUser } from "@/lib/services/interviews";
import { nextInterviewTurn } from "@/lib/self-model/interview";

const schema = z.object({ text: z.string().trim().min(1) });

// POST /api/interviews/:id/reply — save the user's reply, then generate the next interviewer
// turn from the real conversation. If the LLM fails the user turn is already saved (502);
// the client retries via POST /api/interviews/:id/next.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let interview;
  try {
    interview = await getInterviewForUser(user.id, id);
  } catch {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const saved = await appendTurn(id, {
    speaker: "user",
    text: parsed.data.text,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await nextInterviewTurn(user.id, interview.projectId, id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate the next turn";
    return NextResponse.json({ error: message, transcript: saved.transcript }, { status: 502 });
  }
}
