import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getCombinationSelection } from "@/lib/services/contexts";
import {
  getCalibrationForUser,
  setUserAnswer,
  setComparison,
  redactCalibration,
  type CalibrationRow,
} from "@/lib/services/calibrations";
import { compareCalibration } from "@/lib/self-model/calibration";
import type { ContextSelection } from "@/lib/self-model/context-subset";

const schema = z.object({
  userAnswer: z.string().min(1),
});

// POST /api/calibrations/:id/user-answer (PRD §18.8) — the user submits their REAL answer.
// Only AFTER this is set is it safe to reveal the hidden answer (PRD §23.9). We then run the
// comparator and return the revealed calibration: both answers + difference report + proposal.
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

  if (row.userAnswer != null) {
    return NextResponse.json({ error: "Answer already submitted." }, { status: 409 });
  }

  // Rebuild the context selection used at creation time so the comparator sees the same subset.
  let selection: ContextSelection = { contexts: [] };
  if (row.contextCombinationId) {
    try {
      const { combination, contexts } = await getCombinationSelection(user.id, row.contextCombinationId);
      selection = { combinationName: combination.name, contexts };
    } catch {
      // Combination since deleted — fall back to a general comparison.
      selection = { contexts: [] };
    }
  }

  try {
    // Persist the user answer first — this flips the redaction gate to "revealed".
    await setUserAnswer(row.id, parsed.data.userAnswer);

    const report = await compareCalibration(user.id, row.projectId, selection, {
      scenario: row.scenario,
      incomingMessage: row.incomingMessage,
      hiddenAgentAnswer: row.hiddenAgentAnswer,
      userAnswer: parsed.data.userAnswer,
    });

    const updated = await setComparison(row.id, report, report.update_proposal);

    // Now revealed (userAnswer set): includes both answers + report + proposal.
    return NextResponse.json(redactCalibration(updated as CalibrationRow), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Comparison failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
