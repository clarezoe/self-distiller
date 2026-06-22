import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getInterviewForUser } from "@/lib/services/interviews";
import { getActiveModel, modelRowToJson, createVersion } from "@/lib/self-model/version";
import { applyProposal, resolveAffectedPaths, type UpdateProposalLike } from "@/lib/self-model/apply";
import { emptySelfModel } from "@/lib/self-model/schema";

// POST /api/interviews/:id/apply — user approves the stored extraction proposal.
// Merges it into the active Self Model (applyProposal, pure) and persists a NEW
// immutable version + user-approved ModelUpdate (sourceType=interview). Invariant
// (PRD §23): proposals only; a version is created solely on this explicit approval,
// and the proposal is read from the server-stored extraction report — never the client.
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

  const report = interview.extractionReport as { update_proposal?: UpdateProposalLike } | null;
  const proposal = report?.update_proposal;
  if (!proposal) {
    return NextResponse.json(
      { error: "No extraction report yet. Run extract before applying." },
      { status: 400 },
    );
  }

  try {
    const active = await getActiveModel(interview.projectId);
    const current = active ? modelRowToJson(active) : emptySelfModel();
    const merged = applyProposal(current, proposal);

    const model = await createVersion(interview.projectId, merged, {
      sourceType: "interview",
      sourceId: interview.id,
      updateSummary:
        (typeof proposal.summary === "string" && proposal.summary) ||
        `Interview update (${interview.type})`,
      affectedPaths: resolveAffectedPaths(proposal),
    });

    return NextResponse.json({ id: model.id, version: model.version }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Apply failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
