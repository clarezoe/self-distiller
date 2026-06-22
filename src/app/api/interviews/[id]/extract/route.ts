import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getInterviewForUser } from "@/lib/services/interviews";
import { extractInterview } from "@/lib/self-model/interview";

// POST /api/interviews/:id/extract (PRD §18.6) → extraction report + update proposal,
// stored on the Interview row and returned to the client for review.
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
    const report = await extractInterview(user.id, interview.projectId, interview.id);
    return NextResponse.json({ report }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
