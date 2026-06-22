import { getCurrentUser } from "@/lib/auth";
import { getActiveProject } from "@/lib/services/projects";
import { listContexts } from "@/lib/services/contexts";
import { MATERIAL_SOURCES, listMaterials } from "@/lib/services/materials";
import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const project = await getActiveProject(user.id);
  if (!project) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="text-sm text-neutral-500">
          Create a project first (see <span className="font-medium">Contexts</span>), then import materials here.
        </p>
      </div>
    );
  }

  const [contexts, materials] = await Promise.all([
    listContexts(project.id),
    listMaterials(project.id),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Import</h1>
        <p className="text-sm text-neutral-500">
          Paste or upload historical materials, extract evidence, and generate Self Model v0.1.
        </p>
      </header>

      <ImportClient
        projectId={project.id}
        sourceTypes={[...MATERIAL_SOURCES]}
        contexts={contexts.map((c) => ({ id: c.id, type: c.type, name: c.name }))}
      />

      <section className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">Imported materials ({materials.length})</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-neutral-500">None yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {materials.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {m.sourceType}
                </span>
                {m.language ? <span className="text-xs text-neutral-400">{m.language}</span> : null}
                <span className="truncate text-neutral-500">{m.content.slice(0, 80)}</span>
                <span className="ml-auto shrink-0 text-xs text-neutral-400">
                  {m.evidenceItems.length} evidence
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
