import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { recordFeedback } from "@/lib/services/tasks";

const schema = z.object({
  project_id: z.string().min(1),
  likeness_score: z.number().optional(),
  usefulness_score: z.number().optional(),
  comments: z.string().optional(),
  labels: z.array(z.string()).optional(),
  // "save as training sample" → create a RawMaterial (sourceType task_feedback) (PRD §6.5, §9.4).
  save_as_training_sample: z.boolean().optional(),
});

// POST /api/tasks/:id/feedback — store feedback on the TaskOutput; optionally save as a training
// sample for future distillation.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await recordFeedback(
      user.id,
      parsed.data.project_id,
      id,
      {
        likeness_score: parsed.data.likeness_score,
        usefulness_score: parsed.data.usefulness_score,
        comments: parsed.data.comments,
        labels: parsed.data.labels,
      },
      { saveAsTrainingSample: parsed.data.save_as_training_sample },
    );
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to record feedback";
    const status = message === "Task not found" || message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
