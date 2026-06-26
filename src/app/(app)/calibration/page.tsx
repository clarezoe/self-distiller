import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProject } from "@/lib/services/projects";
import { listCombinations } from "@/lib/services/contexts";
import { listClientCalibrations } from "@/lib/services/calibrations";
import { getActiveModel } from "@/lib/self-model/version";
import { CalibrationClient } from "./calibration-client";

export default async function CalibrationPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("calibration");
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

  const [combinations, calibrations, activeModel] = await Promise.all([
    listCombinations(project.id),
    listClientCalibrations(project.id),
    getActiveModel(project.id),
  ]);

  const past = calibrations.filter((c) => c.hiddenRevealed);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{t("headerTitle")}</h1>
        <p className="text-sm text-neutral-500">{t("subtitle")}</p>
      </header>

      <CalibrationClient
        projectId={project.id}
        combinations={combinations.map((c) => ({ id: c.id, name: c.name }))}
        hasModel={!!activeModel}
      />

      <section className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">{t("pastCalibrations", { count: past.length })}</h2>
        {past.length === 0 ? (
          <p className="text-sm text-neutral-500">{tCommon("noneCompleted")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {past.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className="truncate text-neutral-600 dark:text-neutral-300">{c.scenario}</span>
                <span className="ml-auto shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
                  {c.userDecision ?? t("noDecision")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
