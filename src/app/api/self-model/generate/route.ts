import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { getEvidenceByIds } from "@/lib/services/evidence";
import { generateInitialModel } from "@/lib/self-model/generate";
import { createVersion } from "@/lib/self-model/version";

const schema = z.object({
  projectId: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
});

// POST /api/self-model/generate — accepted evidence → new immutable Self Model version.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let project;
  try {
    project = await getProjectForUser(user.id, parsed.data.projectId);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Ownership-scoped fetch — forged/foreign ids are silently dropped.
  const evidence = await getEvidenceByIds(project.id, parsed.data.evidenceIds);
  if (evidence.length === 0) {
    return NextResponse.json({ error: "No matching evidence for this project" }, { status: 400 });
  }

  try {
    const json = await generateInitialModel(
      user.id,
      project.id,
      evidence.map((e) => ({
        id: e.id,
        claim: e.claim,
        evidenceText: e.evidenceText,
        signalType: e.signalType,
        confidence: e.confidence,
        stability: e.stability,
      })),
      { goal: project.goal },
    );

    const model = await createVersion(project.id, json, {
      sourceType: "import",
      sourceId: evidence.map((e) => e.id).join(","),
      updateSummary: `Generated Self Model from ${evidence.length} evidence item(s)`,
      affectedPaths: affectedPaths(json),
    });

    return NextResponse.json({ id: model.id, version: model.version }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function affectedPaths(json: {
  language_models: object;
  role_models: object;
  relationship_models: object;
  scene_models: object;
}): string[] {
  const paths: string[] = ["core_self"];
  for (const [k, key] of [
    ["language_models", json.language_models],
    ["role_models", json.role_models],
    ["relationship_models", json.relationship_models],
    ["scene_models", json.scene_models],
  ] as const) {
    if (Object.keys(key).length > 0) paths.push(k);
  }
  return paths;
}
