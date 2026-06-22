import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { generateTask, TASK_TYPES } from "@/lib/services/tasks";
import type { TaskType } from "@/generated/prisma/client";

// PRD §18.10 body shape (snake_case): project_id, task_type, input, context_ids, mode.
const schema = z.object({
  project_id: z.string().min(1),
  task_type: z.enum(TASK_TYPES as unknown as [string, ...string[]]),
  input: z.string().min(1),
  context_ids: z.array(z.string()).default([]),
  // MVP is Draft Mode only (PRD §16.1) — the only accepted mode.
  mode: z.literal("draft").default("draft"),
});

// POST /api/tasks/generate (PRD §18.10) — generate a draft using the active Self Model + the
// manually selected context. Draft Mode only; sensitive scenarios return a boundary warning so
// the UI shows a takeover notice instead of presenting a send-ready draft (PRD §16.3).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await getProjectForUser(user.id, parsed.data.project_id);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const result = await generateTask(user.id, parsed.data.project_id, {
      taskType: parsed.data.task_type as TaskType,
      input: parsed.data.input,
      contextIds: parsed.data.context_ids,
      mode: "draft",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
