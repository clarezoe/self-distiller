"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { voiceEvidenceLevel } from "@/lib/prompts/persona-voice-distiller";
import { btnSecondary, inputCls, readError, type Persona } from "./shared";
import { VoiceControls } from "./voice-controls";

const btnPrimary =
  "min-h-11 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900";

export function PersonasClient({
  projectId,
  initialPersonas,
}: {
  projectId: string;
  initialPersonas: Persona[];
}) {
  const t = useTranslations("personas");
  const tCommon = useTranslations("common");
  const [personas, setPersonas] = useState<Persona[]>(initialPersonas);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replace = (p: Persona) => setPersonas((prev) => prev.map((x) => (x.id === p.id ? p : x)));

  async function add() {
    if (!name.trim() || !description.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/interviewer-personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          description: description.trim(),
          relationship: relationship.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, t("errCreate")));
      const data = (await res.json()) as { persona: Persona };
      setPersonas((prev) => [data.persona, ...prev]);
      setName("");
      setRelationship("");
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Persona): Promise<string | null> {
    if (!window.confirm(t("confirmDelete", { name: p.name }))) return null;
    try {
      const res = await fetch(`/api/interviewer-personas/${p.id}?projectId=${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res, t("errDelete")));
      setPersonas((prev) => prev.filter((x) => x.id !== p.id));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : tCommon("somethingWrong");
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3 rounded-xl border border-neutral-200 p-4 md:p-5 dark:border-neutral-800">
        <h2 className="font-medium">{t("newPersona")}</h2>
        {personas.length === 0 ? <p className="text-sm text-neutral-500">{t("noPersonas")}</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={`${inputCls} min-h-11`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
          <input
            className={`${inputCls} min-h-11`}
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder={t("relationshipPlaceholder")}
          />
        </div>
        <textarea
          className={`${inputCls} min-h-20`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("descriptionPlaceholder")}
        />
        {error ? (
          <p className="break-words rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
        ) : null}
        <button type="button" className={btnPrimary} onClick={add} disabled={busy || !name.trim() || !description.trim()}>
          {busy ? t("saving") : t("add")}
        </button>
      </section>

      {personas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-medium">{t("count", { count: personas.length })}</h2>
          <ul className="space-y-3">
            {personas.map((p) => (
              <PersonaCard key={p.id} persona={p} projectId={projectId} onUpdated={replace} onDelete={remove} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PersonaCard({
  persona: p,
  projectId,
  onUpdated,
  onDelete,
}: {
  persona: Persona;
  projectId: string;
  onUpdated: (p: Persona) => void;
  onDelete: (p: Persona) => Promise<string | null>;
}) {
  const t = useTranslations("personas");
  const tI = useTranslations("interview");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [relationship, setRelationship] = useState(p.relationship ?? "");
  const [description, setDescription] = useState(p.description);
  const [pending, setPending] = useState<null | "save" | "delete">(null);
  const [err, setErr] = useState<string | null>(null);

  function startEdit() {
    setName(p.name);
    setRelationship(p.relationship ?? "");
    setDescription(p.description);
    setErr(null);
    setEditing(true);
  }

  async function save() {
    setErr(null);
    setPending("save");
    try {
      const res = await fetch(`/api/interviewer-personas/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          description: description.trim(),
          relationship: relationship.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, t("errUpdate")));
      const data = (await res.json()) as { persona: Persona };
      onUpdated({ ...p, name: data.persona.name, description: data.persona.description, relationship: data.persona.relationship });
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setPending(null);
    }
  }

  async function del() {
    setPending("delete");
    const message = await onDelete(p);
    if (message) setErr(message);
    setPending(null);
  }

  const level = voiceEvidenceLevel(p.voiceSampleChars);
  const busy = pending !== null;

  return (
    <li className="space-y-3 rounded-xl border border-neutral-200 p-4 md:p-5 dark:border-neutral-800">
      {editing ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={`${inputCls} min-h-11`} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} />
            <input
              className={`${inputCls} min-h-11`}
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder={t("relationshipPlaceholder")}
            />
          </div>
          <textarea
            className={`${inputCls} min-h-20`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("descriptionPlaceholder")}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={save} disabled={busy || !name.trim() || !description.trim()}>
              {pending === "save" ? t("saving") : t("save")}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setEditing(false)} disabled={busy}>
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <p className="break-words font-medium">
            {p.name}
            {p.relationship ? (
              <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-normal text-neutral-500 dark:bg-neutral-800">
                {p.relationship}
              </span>
            ) : null}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-500">{p.description}</p>
          <p className="mt-1 text-xs text-neutral-400">
            {p.voiceProfile
              ? `${tI("voiceDistilledOn", { date: p.voiceDistilledAt ? p.voiceDistilledAt.slice(0, 10) : "" })} · ${tI("voiceEvidence", { level: tI(`evidence_${level}`), chars: p.voiceSampleChars })}`
              : t("voiceNotDistilled")}
          </p>
        </div>
      )}

      <VoiceControls persona={p} projectId={projectId} onUpdated={onUpdated} disabled={busy} />

      {err ? <p className="break-words rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40">{err}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <Link href={`/interview?persona=${encodeURIComponent(p.id)}`} className={`${btnSecondary} inline-flex items-center`}>
          {t("startInterview")}
        </Link>
        {!editing ? (
          <button type="button" className={btnSecondary} onClick={startEdit} disabled={busy}>
            {t("edit")}
          </button>
        ) : null}
        <button
          type="button"
          className="min-h-11 px-2 text-sm text-red-600 hover:underline disabled:opacity-50"
          onClick={del}
          disabled={busy}
        >
          {t("delete")}
        </button>
      </div>
    </li>
  );
}
