import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { appendTurn, getInterviewForUser } from "@/lib/services/interviews";

const schema = z.object({
  speaker: z.enum(["agent", "user"]),
  text: z.string().min(1),
});

// POST /api/interviews/:id/turn — append one transcript turn (user reply or next agent prompt).
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

  try {
    await getInterviewForUser(user.id, id);
  } catch {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const updated = await appendTurn(id, {
    speaker: parsed.data.speaker,
    text: parsed.data.text,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ transcript: updated.transcript }, { status: 201 });
}
