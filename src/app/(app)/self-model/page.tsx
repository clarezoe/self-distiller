import { getCurrentUser } from "@/lib/auth";
import { getActiveProject } from "@/lib/services/projects";
import { listEvidence } from "@/lib/services/evidence";
import { getActiveModel, modelRowToJson } from "@/lib/self-model/version";
import type {
  LanguageModel,
  RelationshipModel,
  RoleModel,
  SceneModel,
} from "@/lib/self-model/schema";

const linkBtn =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900";
const card = "space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800";

function List({ label, items }: { label: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p className="text-sm">
      <span className="text-neutral-400">{label}: </span>
      {value}
    </p>
  );
}

export default async function SelfModelPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const project = await getActiveProject(user.id);
  if (!project) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">Self Model</h1>
        <p className="text-sm text-neutral-500">Create a project first, then import materials to generate a model.</p>
      </div>
    );
  }

  const row = await getActiveModel(project.id);
  if (!row) {
    return (
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-semibold">Self Model</h1>
        <p className="text-sm text-neutral-500">
          No Self Model yet. Go to <span className="font-medium">Import</span>, add materials, accept extracted evidence, and generate v0.1.
        </p>
      </div>
    );
  }

  const model = modelRowToJson(row);
  const evidence = await listEvidence(project.id);
  const evidenceById = new Map(evidence.map((e) => [e.id, e]));
  const exportBase = `/api/self-model/export?projectId=${project.id}`;

  const c = model.core_self;
  const lang = Object.entries(model.language_models) as [string, LanguageModel][];
  const roles = Object.entries(model.role_models) as [string, RoleModel][];
  const rels = Object.entries(model.relationship_models) as [string, RelationshipModel][];
  const scenes = Object.entries(model.scene_models) as [string, SceneModel][];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Self Model v{model.version}</h1>
          <p className="text-sm text-neutral-500">{project.name} · active version</p>
        </div>
        <div className="flex gap-2">
          <a className={linkBtn} href={`${exportBase}&format=markdown`}>Export Markdown</a>
          <a className={linkBtn} href={`${exportBase}&format=json`}>Export JSON</a>
        </div>
      </header>

      <section className={card}>
        <h2 className="font-medium">Core Self</h2>
        <List label="Identity" items={c.identity} />
        <List label="Values" items={c.values} />
        <List label="Long-term preferences" items={c.long_term_preferences} />
        <List label="Decision patterns" items={c.decision_patterns} />
        <List label="Communication boundaries" items={c.communication_boundaries} />
        <List label="Stable dislikes" items={c.stable_dislikes} />
      </section>

      {lang.length > 0 ? (
        <section className={card}>
          <h2 className="font-medium">Language Models</h2>
          {lang.map(([key, lm]) => (
            <div key={key} className="space-y-1 border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0 dark:border-neutral-900">
              <p className="font-medium">{key}</p>
              <Field label="Voice" value={lm.voice_summary} />
              <Field label="Current level" value={lm.current_level} />
              <Field label="Improvement trend" value={lm.improvement_trend} />
              <List label="Tone patterns" items={lm.tone_patterns} />
              <List label="Common mistakes" items={lm.common_mistakes} />
              <List label="Avoid" items={lm.avoid} />
              {typeof lm.confidence === "number" ? (
                <p className="text-xs text-neutral-400">confidence {lm.confidence}</p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {roles.length > 0 ? (
        <section className={card}>
          <h2 className="font-medium">Role Models</h2>
          {roles.map(([key, rm]) => (
            <div key={key} className="space-y-1 border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0 dark:border-neutral-900">
              <p className="font-medium">{key}</p>
              <Field label="Style" value={rm.style_summary} />
              <Field label="Feedback style" value={rm.feedback_style} />
              <Field label="Conflict style" value={rm.conflict_style} />
              <List label="Boundaries" items={rm.boundaries} />
              <EvidenceLinks ids={rm.evidence_ids} map={evidenceById} />
            </div>
          ))}
        </section>
      ) : null}

      {rels.length > 0 ? (
        <section className={card}>
          <h2 className="font-medium">Relationship Models</h2>
          {rels.map(([key, rm]) => (
            <div key={key} className="space-y-1 border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0 dark:border-neutral-900">
              <p className="font-medium">{key}</p>
              <Field label="Style" value={rm.style_summary} />
              <Field label="Humor" value={rm.humor} />
              <Field label="Comfort style" value={rm.comfort_style} />
              <Field label="Reply length" value={rm.reply_length} />
              <Field label="Emoji policy" value={rm.emoji_policy} />
              <List label="Sensitive boundaries" items={rm.sensitive_boundaries} />
              <EvidenceLinks ids={rm.evidence_ids} map={evidenceById} />
            </div>
          ))}
        </section>
      ) : null}

      {scenes.length > 0 ? (
        <section className={card}>
          <h2 className="font-medium">Scene Models</h2>
          {scenes.map(([key, sm]) => (
            <div key={key} className="space-y-1 border-t border-neutral-100 pt-3 first:border-t-0 first:pt-0 dark:border-neutral-900">
              <p className="font-medium">{key}</p>
              <Field label="Default intent" value={sm.default_intent} />
              <List label="Typical structure" items={sm.typical_structure} />
              <List label="Avoid" items={sm.avoid} />
            </div>
          ))}
        </section>
      ) : null}

      <section className={card}>
        <h2 className="font-medium">Boundaries</h2>
        <List label="Must not invent" items={model.boundaries.must_not_invent} />
        <List label="Requires user confirmation" items={model.boundaries.requires_user_confirmation} />
        <List label="Sensitive topics" items={model.boundaries.sensitive_topics} />
        {!model.boundaries.must_not_invent?.length &&
        !model.boundaries.requires_user_confirmation?.length &&
        !model.boundaries.sensitive_topics?.length ? (
          <p className="text-sm text-neutral-500">None recorded.</p>
        ) : null}
      </section>

      {model.unknowns.length > 0 ? (
        <section className={card}>
          <h2 className="font-medium">Unknowns</h2>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {model.unknowns.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function EvidenceLinks({
  ids,
  map,
}: {
  ids?: string[];
  map: Map<string, { claim: string }>;
}) {
  if (!ids || ids.length === 0) return null;
  const known = ids.filter((id) => map.has(id));
  if (known.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Evidence</p>
      <ul className="mt-1 space-y-0.5 text-xs text-neutral-500">
        {known.map((id) => (
          <li key={id} title={id}>
            {map.get(id)?.claim}
          </li>
        ))}
      </ul>
    </div>
  );
}
