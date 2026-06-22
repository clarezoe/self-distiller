import { prisma } from "@/lib/db";
import { MaterialSource, TaskType } from "@/generated/prisma/client";
import { getProjectForUser } from "./projects";
import { getContextsByIds } from "./contexts";
import {
  resolveOutputContext,
  checkSensitive,
  routePersona,
  generateOutput,
} from "@/lib/self-model/output";
import type { ContextSelection } from "@/lib/self-model/context-subset";
import type { SensitiveCategory } from "@/lib/prompts/sensitive-check";

export const TASK_TYPES = [
  TaskType.chat_reply,
  TaskType.copywriting,
  TaskType.video_script,
  TaskType.course,
  TaskType.email,
  TaskType.sales_reply,
  TaskType.rewrite,
  TaskType.decision_support,
] as const;

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}

// §6.5 feedback labels the user can attach to an output.
export const FEEDBACK_LABELS = [
  "sounds_like_me",
  "not_like_me",
  "too_long",
  "too_short",
  "too_soft",
  "too_harsh",
  "too_ai_like",
  "language_too_perfect",
  "too_many_preserved_mistakes",
  "too_corrected",
  "wrong_relationship_tone",
  "wrong_emotional_tone",
  "wrong_intention",
] as const;

const ALLOWED_LABELS = new Set<string>(FEEDBACK_LABELS);

// PURE: dedupe + keep only known §6.5 labels, normalizing casing/spacing/hyphens.
// Unit-tested. Unknown labels are dropped (the UI only offers the known set).
export function normalizeFeedbackLabels(labels: unknown): string[] {
  if (!Array.isArray(labels)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of labels) {
    if (typeof raw !== "string") continue;
    const norm = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (!ALLOWED_LABELS.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

export type TaskFeedback = {
  likeness_score?: number;
  usefulness_score?: number;
  comments?: string;
  labels?: string[];
};

// PURE: coerce scores to 1-5 integers, clamp, drop empties; normalize labels. Unit-tested.
export function normalizeFeedback(input: TaskFeedback): TaskFeedback {
  const out: TaskFeedback = {};
  const score = (n: unknown): number | undefined => {
    if (typeof n !== "number" || Number.isNaN(n)) return undefined;
    return Math.max(1, Math.min(5, Math.round(n)));
  };
  const likeness = score(input.likeness_score);
  const usefulness = score(input.usefulness_score);
  if (likeness !== undefined) out.likeness_score = likeness;
  if (usefulness !== undefined) out.usefulness_score = usefulness;
  const comments = typeof input.comments === "string" ? input.comments.trim() : "";
  if (comments) out.comments = comments;
  const labels = normalizeFeedbackLabels(input.labels);
  if (labels.length) out.labels = labels;
  return out;
}

function toJson(value: unknown): object {
  return JSON.parse(JSON.stringify(value ?? {})) as object;
}

export type TaskRow = {
  id: string;
  projectId: string;
  taskType: TaskType;
  input: string;
  contextIds: string[];
  output: string;
  feedback: unknown;
  createdAt: Date;
};

export type GeneratedTask = {
  id: string;
  taskType: TaskType;
  input: string;
  output: string;
  // Present only when the scenario hit a §16.3 sensitive category → user must take over.
  boundaryWarning: {
    category: SensitiveCategory;
    reason: string;
    message: string;
  } | null;
  // Persona-router boundary cautions (non-blocking) drawn from the model's boundaries.
  routerWarnings: string[];
  createdAt: string;
};

// Build a ContextSelection from selected Context ids (ownership-scoped at the project).
async function selectionFromContextIds(
  projectId: string,
  contextIds: string[],
): Promise<ContextSelection> {
  if (contextIds.length === 0) return { contexts: [] };
  const rows = await getContextsByIds(projectId, contextIds);
  return {
    contexts: rows.map((c) => ({
      type: c.type as "language" | "role" | "relationship" | "scene",
      name: c.name,
    })),
  };
}

// Generate a draft using the active Self Model + selected context (PRD §9.4, §13.5/6, §16.3).
// Order: assemble subset → SENSITIVE check (§16.3) → persona route → output generator → persist.
// Mode is always "draft" in the MVP (PRD §16.1) — nothing is ever sent.
export async function generateTask(
  userId: string,
  projectId: string,
  input: {
    taskType: TaskType;
    input: string;
    contextIds: string[];
    // Always "draft" in MVP; kept for the §18.10 body shape.
    mode?: "draft";
  },
): Promise<GeneratedTask> {
  await getProjectForUser(userId, projectId);

  const selection = await selectionFromContextIds(projectId, input.contextIds);
  const { subset, summary } = await resolveOutputContext(projectId, selection);

  // 1) Sensitive-topic screen FIRST (PRD §16.3). On a hit we STOP here: we never generate
  // or persist a send-ready draft, and we return no draft text — the user must take over.
  // Enforced server-side (not just hidden in the UI) so the draft never reaches the client.
  const sensitive = await checkSensitive(userId, projectId, {
    taskType: input.taskType,
    input: input.input,
    contextSummary: summary,
  });

  if (sensitive.sensitive && sensitive.category !== "none") {
    const row = await prisma.taskOutput.create({
      data: {
        projectId,
        taskType: input.taskType,
        input: input.input,
        contextIds: input.contextIds,
        // No draft is generated for a sensitive scenario; the column is non-null.
        output: "",
      },
    });
    return {
      id: row.id,
      taskType: row.taskType,
      input: row.input,
      output: "",
      boundaryWarning: {
        category: sensitive.category,
        reason: sensitive.reason,
        message:
          "This looks like a sensitive topic. Please take over and reply yourself — no draft is provided.",
      },
      routerWarnings: [],
      createdAt: row.createdAt.toISOString(),
    };
  }

  // 2) Persona routing (polish level + boundary warnings).
  const route = await routePersona(userId, projectId, {
    taskType: input.taskType,
    mode: "draft",
    contextSummary: summary,
    selfModelSubset: subset,
    taskInput: input.input,
  });

  // 3) Generate the draft.
  const output = await generateOutput(userId, projectId, {
    taskType: input.taskType,
    mode: "draft",
    polishLevel: route.polish_level,
    contextSummary: summary,
    selfModelSubset: subset,
    taskInput: input.input,
    routerNotes: route.notes,
  });

  const row = await prisma.taskOutput.create({
    data: {
      projectId,
      taskType: input.taskType,
      input: input.input,
      contextIds: input.contextIds,
      output,
    },
  });

  return {
    id: row.id,
    taskType: row.taskType,
    input: row.input,
    output: row.output,
    boundaryWarning: null,
    routerWarnings: route.boundary_warnings ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTasks(projectId: string) {
  return prisma.taskOutput.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

// Ownership: a task output is reachable only via a project the user owns.
export async function getTaskForUser(userId: string, taskId: string): Promise<TaskRow> {
  const row = await prisma.taskOutput.findFirst({
    where: { id: taskId, project: { userId } },
  });
  if (!row) throw new Error("Task not found");
  return row as TaskRow;
}

// Record feedback on a TaskOutput (PRD §6.5). Optionally "save as training sample" → create a
// RawMaterial (sourceType task_feedback) for future distillation, carrying the same context ids.
export async function recordFeedback(
  userId: string,
  projectId: string,
  taskId: string,
  feedback: TaskFeedback,
  opts?: { saveAsTrainingSample?: boolean },
): Promise<{ feedback: TaskFeedback; trainingSampleId: string | null }> {
  await getProjectForUser(userId, projectId);
  const task = await getTaskForUser(userId, taskId);
  if (task.projectId !== projectId) throw new Error("Task not found");

  const normalized = normalizeFeedback(feedback);

  await prisma.taskOutput.update({
    where: { id: task.id },
    data: { feedback: toJson(normalized) },
  });

  let trainingSampleId: string | null = null;
  // Only save a training sample when there is actual draft content. A sensitive scenario
  // (PRD §16.3) persists an empty output and produces no draft, so it must never become a
  // training sample.
  if (opts?.saveAsTrainingSample && task.output.trim()) {
    const material = await prisma.rawMaterial.create({
      data: {
        projectId,
        sourceType: MaterialSource.task_feedback,
        content: task.output,
        contextIds: task.contextIds,
        sourceMetadata: toJson({
          taskOutputId: task.id,
          taskType: task.taskType,
          input: task.input,
          feedback: normalized,
        }),
      },
    });
    trainingSampleId = material.id;
  }

  return { feedback: normalized, trainingSampleId };
}
