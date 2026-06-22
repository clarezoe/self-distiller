import { getCurrentUser } from "@/lib/auth";
import { getActiveProject } from "@/lib/services/projects";
import { listContexts } from "@/lib/services/contexts";
import { getActiveModel } from "@/lib/self-model/version";
import { listTasks, TASK_TYPES } from "@/lib/services/tasks";
import { TasksClient } from "./tasks-client";

const TASK_TYPE_LABELS: Record<string, string> = {
  chat_reply: "Chat reply",
  copywriting: "Copywriting",
  video_script: "Video script",
  course: "Course content",
  email: "Email",
  sales_reply: "Sales reply",
  rewrite: "Rewrite in my style",
  decision_support: "Decision support",
};

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const project = await getActiveProject(user.id);
  if (!project) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="text-sm text-neutral-500">
          Create a project first (see <span className="font-medium">Contexts</span>), then generate drafts here.
        </p>
      </div>
    );
  }

  const [contexts, activeModel, past] = await Promise.all([
    listContexts(project.id),
    getActiveModel(project.id),
    listTasks(project.id),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="text-sm text-neutral-500">
          Use the trained Self Model to draft replies, copy, scripts, and emails in the right context.
          Draft Mode only — nothing is ever sent for you.
        </p>
      </header>

      <TasksClient
        projectId={project.id}
        taskTypes={TASK_TYPES.map((t) => ({ value: t, label: TASK_TYPE_LABELS[t] ?? t }))}
        contexts={contexts.map((c) => ({ id: c.id, type: c.type, name: c.name }))}
        hasModel={!!activeModel}
      />

      <section className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">Recent drafts ({past.length})</h2>
        {past.length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {past.slice(0, 20).map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
                  {TASK_TYPE_LABELS[t.taskType] ?? t.taskType}
                </span>
                <span className="truncate text-neutral-600 dark:text-neutral-300">{t.input}</span>
                {t.feedback ? (
                  <span className="ml-auto shrink-0 text-xs text-green-600 dark:text-green-400">rated</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
