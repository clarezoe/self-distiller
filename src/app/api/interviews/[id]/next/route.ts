import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getInterviewForUser } from "@/lib/services/interviews";
import { nextInterviewTurn } from "@/lib/self-model/interview";

// POST /api/interviews/:id/next — generate the next interviewer turn only (retry path).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let interview;
  try {
    interview = await getInterviewForUser(user.id, id);
  } catch {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  try {
    const result = await nextInterviewTurn(user.id, interview.projectId, id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate the next turn";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
