import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import {
  clearPersonaVoice,
  distillPersonaVoice,
  parseDistillMode,
  validateVoiceSamples,
} from "@/lib/services/interviewer-personas";

const distillSchema = z.object({
  projectId: z.string().min(1),
  samples: z.string(),
  mode: z.unknown().optional(),
});

async function ownedProject(userId: string, projectId: string) {
  try {
    await getProjectForUser(userId, projectId);
    return true;
  } catch {
    return false;
  }
}

// POST /api/interviewer-personas/:id/distill { projectId, samples } — distill the persona's
// speaking style from pasted messages. Raw samples are used once and never stored or logged.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = distillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "projectId and samples required" }, { status: 400 });
  }
  if (!(await ownedProject(user.id, parsed.data.projectId))) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const mode = parseDistillMode(parsed.data.mode);
  if (!mode.ok) return NextResponse.json({ error: mode.error }, { status: 400 });

  const validated = validateVoiceSamples(parsed.data.samples);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  try {
    const persona = await distillPersonaVoice(parsed.data.projectId, id, validated.value, user.id, mode.value);
    return NextResponse.json({ persona });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to distill voice";
    return NextResponse.json({ error: message }, { status: message === "Persona not found" ? 404 : 500 });
  }
}

// DELETE /api/interviewer-personas/:id/distill?projectId=... — clear the voice profile.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (!(await ownedProject(user.id, projectId))) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const persona = await clearPersonaVoice(projectId, id);
    return NextResponse.json({ persona });
  } catch {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }
}
