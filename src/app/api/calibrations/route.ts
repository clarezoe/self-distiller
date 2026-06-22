import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { getCombinationSelection } from "@/lib/services/contexts";
import { createCalibration, redactCalibration, type CalibrationRow } from "@/lib/services/calibrations";
import { generateHiddenAnswer, generateScenario } from "@/lib/self-model/calibration";
import type { ContextSelection } from "@/lib/self-model/context-subset";

const createSchema = z.object({
  projectId: z.string().min(1),
  contextCombinationId: z.string().min(1).optional(),
  scenario: z.string().optional(),
  incomingMessage: z.string().optional(),
});

// POST /api/calibrations (PRD §18.7) — create a blind calibration.
// 1) Resolve the (optional) context combination into a Self Model subset.
// 2) If no scenario is supplied, the system generates one.
// 3) The agent generates a HIDDEN predicted answer, stored server-side.
// CRITICAL (PRD §23.9): the response MUST NOT include hiddenAgentAnswer — it is redacted
// because no userAnswer exists yet.
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

  // Resolve the context selection (ownership re-checked inside getCombinationSelection).
  let selection: ContextSelection = { contexts: [] };
  let combinationId: string | null = null;
  if (parsed.data.contextCombinationId) {
    try {
      const { combination, contexts } = await getCombinationSelection(
        user.id,
        parsed.data.contextCombinationId,
      );
      if (combination.projectId !== project.id) throw new Error("mismatch");
      combinationId = combination.id;
      selection = { combinationName: combination.name, contexts };
    } catch {
      return NextResponse.json({ error: "Combination not found" }, { status: 404 });
    }
  }

  try {
    const scenario =
      parsed.data.scenario?.trim() ||
      (await generateScenario(user.id, project.id, selection));

    const hiddenAgentAnswer = await generateHiddenAnswer(
      user.id,
      project.id,
      selection,
      scenario,
      parsed.data.incomingMessage,
    );

    const row = await createCalibration(project.id, {
      contextCombinationId: combinationId,
      scenario,
      incomingMessage: parsed.data.incomingMessage,
      hiddenAgentAnswer,
    });

    // Redacted: hiddenAgentAnswer is stripped because userAnswer is still null.
    return NextResponse.json(redactCalibration(row as CalibrationRow), { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create calibration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
