import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProject } from "@/lib/services/projects";
import { listContexts } from "@/lib/services/contexts";
import { MATERIAL_SOURCES, listMaterials } from "@/lib/services/materials";
import { ImportClient } from "./import-client";
import { GoogleChatImportClient } from "./google-chat-client";
import { MaterialsList } from "./materials-list";

export default async function ImportPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("import");
  const tCommon = await getTranslations("common");

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

  const [contexts, materials] = await Promise.all([
    listContexts(project.id),
    listMaterials(project.id),
  ]);

  const relationships = contexts
    .filter((c) => c.type === "relationship")
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-500">{t("subtitle")}</p>
      </header>

      <ImportClient
        projectId={project.id}
        sourceTypes={[...MATERIAL_SOURCES]}
        contexts={contexts.map((c) => ({ id: c.id, type: c.type, name: c.name }))}
      />

      <GoogleChatImportClient projectId={project.id} relationships={relationships} />

      <section className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">{t("importedMaterials", { count: materials.length })}</h2>
        {materials.length === 0 ? (
          <p className="text-sm text-neutral-500">{tCommon("none")}</p>
        ) : (
          <MaterialsList
            projectId={project.id}
            relationships={relationships}
            materials={materials.map((m) => ({
              id: m.id,
              sourceType: m.sourceType,
              language: m.language,
              preview: m.content.slice(0, 120),
              evidenceCount: m.evidenceItems.length,
              contextIds: m.contextIds,
              sourceMetadata:
                m.sourceMetadata && typeof m.sourceMetadata === "object" && !Array.isArray(m.sourceMetadata)
                  ? (m.sourceMetadata as Record<string, unknown>)
                  : {},
            }))}
          />
        )}
      </section>
    </div>
  );
}
