import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMaterialForUser } from "@/lib/services/materials";
import { analyzeMaterial } from "@/lib/self-model/generate";

// POST /api/materials/:id/analyze (PRD §18.4) → classification + persisted evidence items.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let material;
  try {
    material = await getMaterialForUser(user.id, id);
  } catch {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }

  try {
    const result = await analyzeMaterial(user.id, material.projectId, material.id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
