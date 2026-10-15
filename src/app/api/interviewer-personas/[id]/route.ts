import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { deletePersona, updatePersona } from "@/lib/services/interviewer-personas";

const patchSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().max(80).optional(),
  description: z.string().max(2000).optional(),
  relationship: z.string().max(80).nullable().optional(),
});

// PATCH /api/interviewer-personas/:id — edit name/description/relationship (merged with current).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await getProjectForUser(user.id, parsed.data.projectId);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const { projectId, ...patch } = parsed.data;
    const persona = await updatePersona(projectId, id, patch);
    return NextResponse.json({ persona });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A persona with this name already exists." }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : "Failed to update persona";
    return NextResponse.json({ error: message }, { status: message === "Persona not found" ? 404 : 400 });
  }
}

const deleteSchema = z.object({ projectId: z.string().min(1) });

// DELETE /api/interviewer-personas/:id?projectId=... — remove a persona the user owns.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const projectId = new URL(request.url).searchParams.get("projectId");
  const parsed = deleteSchema.safeParse({ projectId });
  if (!parsed.success) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  try {
    await getProjectForUser(user.id, parsed.data.projectId);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await deletePersona(parsed.data.projectId, id);
  return NextResponse.json({ ok: true });
}
