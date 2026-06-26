import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProject } from "@/lib/services/projects";
import { listContexts } from "@/lib/services/contexts";
import { getActiveModel } from "@/lib/self-model/version";
import { listTasks, TASK_TYPES } from "@/lib/services/tasks";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("tasks");
  const tCommon = await getTranslations("common");
  // Resolve a task-type label from the `tasks.types` namespace, falling back to
  // the raw key for any type not yet translated.
  const typeLabel = (key: string) =>
    t.has(`types.${key}`) ? t(`types.${key}`) : key;

  const project = await getActiveProject(user.id);
  if (!project) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-500">
          {t.rich("createProjectFirst", { b: (chunks) => <span className="font-medium">{chunks}</span> })}
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
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-500">{t("subtitle")}</p>
      </header>

      <TasksClient
        projectId={project.id}
        taskTypes={TASK_TYPES.map((tt) => ({ value: tt, label: typeLabel(tt) }))}
        contexts={contexts.map((c) => ({ id: c.id, type: c.type, name: c.name }))}
        hasModel={!!activeModel}
      />

      <section className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">{t("recentDrafts", { count: past.length })}</h2>
        {past.length === 0 ? (
          <p className="text-sm text-neutral-500">{tCommon("none")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {past.slice(0, 20).map((task) => (
              <li key={task.id} className="flex items-center gap-2">
                <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
                  {typeLabel(task.taskType)}
                </span>
                <span className="truncate text-neutral-600 dark:text-neutral-300">{task.input}</span>
                {task.feedback ? (
                  <span className="ml-auto shrink-0 text-xs text-green-600 dark:text-green-400">{t("rated")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
