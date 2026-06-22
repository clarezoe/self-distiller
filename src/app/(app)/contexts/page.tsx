import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createProject, getActiveProject, getProjectForUser } from "@/lib/services/projects";
import {
  CONTEXT_TYPES,
  createCombination,
  createContext,
  isContextType,
  listCombinations,
  listContexts,
} from "@/lib/services/contexts";

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";
const btnCls =
  "rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900";

export default async function ContextsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const userId = user.id;
  const project = await getActiveProject(userId);

  if (!project) {
    async function makeProject(formData: FormData) {
      "use server";
      const name = String(formData.get("name") ?? "").trim();
      const goal = String(formData.get("goal") ?? "").trim();
      if (!name || !goal) return;
      await createProject(userId, { name, goal });
      revalidatePath("/contexts");
    }
    return (
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Create your project</h1>
        <form action={makeProject} className="space-y-3">
          <input name="name" placeholder="Project name" className={inputCls} required />
          <input name="goal" placeholder="Main goal" className={inputCls} required />
          <button type="submit" className={btnCls}>Create project</button>
        </form>
      </div>
    );
  }

  const projectId = project.id;
  const [contexts, combinations] = await Promise.all([
    listContexts(projectId),
    listCombinations(projectId),
  ]);

  async function addContext(formData: FormData) {
    "use server";
    await getProjectForUser(userId, projectId);
    const type = String(formData.get("type") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!isContextType(type) || !name) return;
    await createContext(projectId, { type, name, description: description || undefined });
    revalidatePath("/contexts");
  }

  async function addCombination(formData: FormData) {
    "use server";
    await getProjectForUser(userId, projectId);
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    await createCombination(projectId, {
      name,
      description: String(formData.get("description") ?? "").trim() || undefined,
      languageContextId: String(formData.get("languageContextId") ?? "") || undefined,
      roleContextId: String(formData.get("roleContextId") ?? "") || undefined,
      relationshipContextId: String(formData.get("relationshipContextId") ?? "") || undefined,
      sceneContextId: String(formData.get("sceneContextId") ?? "") || undefined,
    });
    revalidatePath("/contexts");
  }

  const byType = (t: string) => contexts.filter((c) => c.type === t);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Contexts</h1>
        <p className="text-sm text-neutral-500">{project.name}</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="font-medium">Add a context</h2>
          <form action={addContext} className="space-y-3">
            <select name="type" className={inputCls} defaultValue="language">
              {CONTEXT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input name="name" placeholder="Name (e.g. Chinese, Close friend, Comforting)" className={inputCls} required />
            <input name="description" placeholder="Description (optional)" className={inputCls} />
            <button type="submit" className={btnCls}>Add context</button>
          </form>
        </div>

        <div className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="font-medium">Contexts ({contexts.length})</h2>
          {contexts.length === 0 ? (
            <p className="text-sm text-neutral-500">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {contexts.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {c.type}
                  </span>
                  <span>{c.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="font-medium">Build a combination</h2>
          <form action={addCombination} className="space-y-3">
            <input name="name" placeholder="Combination name" className={inputCls} required />
            {(
              [
                ["languageContextId", "language"],
                ["roleContextId", "role"],
                ["relationshipContextId", "relationship"],
                ["sceneContextId", "scene"],
              ] as const
            ).map(([field, type]) => (
              <select key={field} name={field} className={inputCls} defaultValue="">
                <option value="">— {type} (optional) —</option>
                {byType(type).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ))}
            <button type="submit" className={btnCls}>Create combination</button>
          </form>
        </div>

        <div className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="font-medium">Combinations ({combinations.length})</h2>
          {combinations.length === 0 ? (
            <p className="text-sm text-neutral-500">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {combinations.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <span>{c.name}</span>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
