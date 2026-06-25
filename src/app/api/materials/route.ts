import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { createMaterials, listMaterials } from "@/lib/services/materials";
import type { MaterialSource } from "@/generated/prisma/client";

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
  return NextResponse.json(await listMaterials(projectId));
}

const createSchema = z.object({
  projectId: z.string().min(1),
  sourceType: z.enum([
    "chat",
    "copywriting",
    "email",
    "social_post",
    "diary",
    "course_script",
    "product_text",
    "sales_reply",
    "chatgpt_conversation",
    "other",
  ]),
  content: z.string().min(1),
  language: z.string().optional(),
  contextIds: z.array(z.string()).optional(),
  materialTime: z.string().optional(),
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

  const materials = await createMaterials(parsed.data.projectId, {
    sourceType: parsed.data.sourceType as MaterialSource,
    content: parsed.data.content,
    language: parsed.data.language,
    contextIds: parsed.data.contextIds,
    materialTime: parsed.data.materialTime ? new Date(parsed.data.materialTime) : null,
  });
  // Large pastes split into several materials; keep `id` (the first) for the
  // existing single-material Analyze flow, and report the full set + count.
  return NextResponse.json(
    {
      id: materials[0].id,
      created: materials.length,
      ids: materials.map((m) => m.id),
      materials,
    },
    { status: 201 },
  );
}
