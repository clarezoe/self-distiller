import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { createPersona, listPersonas } from "@/lib/services/interviewer-personas";

const createSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(2000),
  relationship: z.string().max(80).optional(),
});

// GET /api/interviewer-personas?projectId=... — list the project's named personas.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  try {
    await getProjectForUser(user.id, projectId);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const personas = await listPersonas(projectId);
  return NextResponse.json({ personas });
}

// POST /api/interviewer-personas — create a named, reusable interviewer persona.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await getProjectForUser(user.id, parsed.data.projectId);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const persona = await createPersona(parsed.data.projectId, {
      name: parsed.data.name,
      description: parsed.data.description,
      relationship: parsed.data.relationship,
    });
    return NextResponse.json({ persona }, { status: 201 });
  } catch (e) {
    // Unique [projectId, name] collision → 409 (Prisma P2002).
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A persona with this name already exists." }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : "Failed to create persona";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
