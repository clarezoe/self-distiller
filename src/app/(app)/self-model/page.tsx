import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProject } from "@/lib/services/projects";
import { listEvidence } from "@/lib/services/evidence";
import { getActiveModel, modelRowToJson } from "@/lib/self-model/version";
import {
  JsonValue,
  isEmptyValue,
  humanizeKey,
  setJsonViewLabels,
  type EvidenceMap,
} from "./json-view";

const linkBtn =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900";
const card = "space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800";

// A section whose body is a single open-ended JSON value (core_self, current_state, boundaries).
function ValueSection({
  title,
  value,
  map,
  empty,
}: {
  title: string;
  value: unknown;
  map: EvidenceMap;
  empty: string;
}) {
  const isEmpty = isEmptyValue(value);
  return (
    <section className={card}>
      <h2 className="font-medium">{title}</h2>
      {isEmpty ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <JsonValue value={value} map={map} />
      )}
    </section>
  );
}

// A section backed by a context-keyed map (language/role/relationship/scene models).
// Each entry's key (zh, boss, close_friend, …) is a heading; its value renders tolerantly.
function MapSection({
  title,
  record,
  map,
}: {
  title: string;
  record: Record<string, unknown>;
  map: EvidenceMap;
}) {
  const entries = Object.entries(record ?? {}).filter(([, v]) => !isEmptyValue(v));
  if (entries.length === 0) return null;
  return (
    <section className={card}>
      <h2 className="font-medium">{title}</h2>
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="space-y-1 border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0 dark:border-neutral-900"
        >
          <p className="font-medium">{humanizeKey(key)}</p>
          <JsonValue value={value} map={map} />
        </div>
      ))}
    </section>
  );
}

export default async function SelfModelPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("selfModel");

  const project = await getActiveProject(user.id);
  if (!project) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-500">{t("createProjectFirst")}</p>
      </div>
    );
  }

  const row = await getActiveModel(project.id);
  if (!row) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-500">
          {t.rich("noModel", { b: (chunks) => <span className="font-medium">{chunks}</span> })}
        </p>
      </div>
    );
  }

  // Inject locale-aware labels into the pure JSON renderer for this request.
  setJsonViewLabels({
    evidence: t("evidence"),
    confidence: t("confidence", { value: "" }).trim(),
    yes: t("yes"),
    no: t("no"),
  });

  const model = modelRowToJson(row);
  const evidence = await listEvidence(project.id);
  const evidenceById: EvidenceMap = new Map(evidence.map((e) => [e.id, e]));
  const exportBase = `/api/self-model/export?projectId=${project.id}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t("headerTitle", { version: model.version })}</h1>
          <p className="text-sm text-neutral-500">{t("activeVersion", { project: project.name })}</p>
        </div>
        <div className="flex gap-2">
          <a className={linkBtn} href={`${exportBase}&format=markdown`}>{t("exportMarkdown")}</a>
          <a className={linkBtn} href={`${exportBase}&format=json`}>{t("exportJson")}</a>
        </div>
      </header>

      <ValueSection
        title={t("coreSelf")}
        value={model.core_self}
        map={evidenceById}
        empty={t("coreSelfEmpty")}
      />

      <MapSection title={t("languageModels")} record={model.language_models} map={evidenceById} />
      <MapSection title={t("roleModels")} record={model.role_models} map={evidenceById} />
      <MapSection title={t("relationshipModels")} record={model.relationship_models} map={evidenceById} />
      <MapSection title={t("sceneModels")} record={model.scene_models} map={evidenceById} />

      {!isEmptyValue(model.current_state) ? (
        <ValueSection
          title={t("currentState")}
          value={model.current_state}
          map={evidenceById}
          empty={t("currentStateEmpty")}
        />
      ) : null}

      <ValueSection
        title={t("boundaries")}
        value={model.boundaries}
        map={evidenceById}
        empty={t("boundariesEmpty")}
      />

      {model.unknowns.length > 0 ? (
        <section className={card}>
          <h2 className="font-medium">{t("unknowns")}</h2>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {model.unknowns.map((u, i) => (
              <li key={i}>{typeof u === "string" ? u : JSON.stringify(u)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
