import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { createContext, listContexts } from "@/lib/services/contexts";
import type { ContextType } from "@/generated/prisma/client";

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
  return NextResponse.json(await listContexts(projectId));
}

const createSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(["language", "role", "relationship", "scene"]),
  name: z.string().min(1),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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

  const context = await createContext(parsed.data.projectId, {
    type: parsed.data.type as ContextType,
    name: parsed.data.name,
    description: parsed.data.description,
    metadata: parsed.data.metadata,
  });
  return NextResponse.json(context, { status: 201 });
}
