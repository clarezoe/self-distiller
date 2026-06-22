import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getCalibrationForUser, setDecision, type CalibrationRow } from "@/lib/services/calibrations";
import { getActiveModel, modelRowToJson, createVersion } from "@/lib/self-model/version";
import { applyProposal, resolveAffectedPaths, type UpdateProposalLike } from "@/lib/self-model/apply";
import { emptySelfModel } from "@/lib/self-model/schema";
import type { CalibrationDecision } from "@/generated/prisma/client";

const schema = z.object({
  decision: z.enum(["accepted", "partially_accepted", "rejected", "edited"]),
  // Only honored for "edited": the user-edited proposal to merge instead of the stored one.
  editedProposal: z
    .object({
      summary: z.string().optional(),
      affected_paths: z.array(z.string()).optional(),
      values: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

// POST /api/calibrations/:id/apply — record the user's decision.
// accepted / partially_accepted / edited → merge the proposal (applyProposal, pure) into the
// active Self Model and persist a NEW immutable version + user-approved ModelUpdate
// (sourceType=blind_calibration). rejected → record the decision only, no version.
// Invariant (PRD §23): proposals only; a version is created solely on this explicit approval.
// The proposal is read from the SERVER-stored comparison report — never trusted from the client
// (except the explicit edited override on the "edited" path).
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

  let row: CalibrationRow;
  try {
    row = await getCalibrationForUser(user.id, id);
  } catch {
    return NextResponse.json({ error: "Calibration not found" }, { status: 404 });
  }

  if (row.userAnswer == null) {
    return NextResponse.json(
      { error: "Submit your answer before applying a decision." },
      { status: 400 },
    );
  }

  const decision = parsed.data.decision as CalibrationDecision;

  try {
    await setDecision(row.id, decision);

    // Reject: record the decision only — no model change (PRD §19.3).
    if (decision === "rejected") {
      return NextResponse.json({ decision, applied: false }, { status: 200 });
    }

    // Pick the proposal: edited override (edited path) or the server-stored proposal.
    const stored = (row.updateProposal as UpdateProposalLike | null) ?? null;
    const proposal: UpdateProposalLike | null =
      decision === "edited" && parsed.data.editedProposal
        ? (parsed.data.editedProposal as UpdateProposalLike)
        : stored;

    if (!proposal || !proposal.values) {
      return NextResponse.json(
        { error: "No update proposal to apply. Submit your answer first." },
        { status: 400 },
      );
    }

    const active = await getActiveModel(row.projectId);
    const current = active ? modelRowToJson(active) : emptySelfModel();
    const merged = applyProposal(current, proposal);

    const model = await createVersion(row.projectId, merged, {
      sourceType: "blind_calibration",
      sourceId: row.id,
      updateSummary:
        (typeof proposal.summary === "string" && proposal.summary) || "Blind calibration update",
      affectedPaths: resolveAffectedPaths(proposal),
    });

    return NextResponse.json(
      { decision, applied: true, id: model.id, version: model.version },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Apply failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
