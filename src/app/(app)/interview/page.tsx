import { getCurrentUser } from "@/lib/auth";
import { getActiveProject } from "@/lib/services/projects";
import { listContexts } from "@/lib/services/contexts";
import { INTERVIEW_TYPES, listInterviews } from "@/lib/services/interviews";
import { getActiveModel } from "@/lib/self-model/version";
import { InterviewClient } from "./interview-client";

export default async function InterviewPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const project = await getActiveProject(user.id);
  if (!project) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">Interview Studio</h1>
        <p className="text-sm text-neutral-500">
          Create a project first (see <span className="font-medium">Contexts</span>), then run interviews here.
        </p>
      </div>
    );
  }

  const [contexts, interviews, activeModel] = await Promise.all([
    listContexts(project.id),
    listInterviews(project.id),
    getActiveModel(project.id),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Interview Studio</h1>
        <p className="text-sm text-neutral-500">
          Run a role-based interview that actively samples how you speak, then extract a model update.
        </p>
      </header>

      <InterviewClient
        projectId={project.id}
        interviewTypes={[...INTERVIEW_TYPES]}
        contexts={contexts.map((c) => ({ id: c.id, type: c.type, name: c.name }))}
        hasModel={!!activeModel}
      />

      <section className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">Past interviews ({interviews.length})</h2>
        {interviews.length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {interviews.map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {i.type}
                </span>
                <span className="text-xs text-neutral-400">{i.interviewerPersona}</span>
                {i.language ? (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    {i.language}
                  </span>
                ) : null}
                <span className="truncate text-neutral-500">{i.goal}</span>
                <span className="ml-auto shrink-0 text-xs text-neutral-400">
                  {i.extractionReport ? "extracted" : "no report"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
