import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { deletePersona } from "@/lib/services/interviewer-personas";

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
