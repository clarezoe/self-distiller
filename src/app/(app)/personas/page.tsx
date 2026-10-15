import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProject } from "@/lib/services/projects";
import { listPersonas } from "@/lib/services/interviewer-personas";
import { PersonasClient } from "./personas-client";

export default async function PersonasPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("personas");

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

  const personas = await listPersonas(project.id);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-500">{t("subtitle")}</p>
      </header>
      <PersonasClient
        projectId={project.id}
        initialPersonas={personas.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          relationship: p.relationship,
          voiceProfile: p.voiceProfile,
          voiceDistilledAt: p.voiceDistilledAt ? p.voiceDistilledAt.toISOString() : null,
          voiceSampleChars: p.voiceSampleChars,
        }))}
      />
    </div>
  );
}
