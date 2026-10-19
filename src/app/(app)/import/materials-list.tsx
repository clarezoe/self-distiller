"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { safeHttpUrl } from "@/lib/import/source-metadata";

type MaterialRow = {
  id: string;
  sourceType: string;
  language: string | null;
  preview: string;
  evidenceCount: number;
  contextIds: string[];
  sourceMetadata: Record<string, unknown>;
};

type RelationshipOption = { id: string; name: string };

const selectCls =
  "min-h-[44px] rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";
const btnSecondary =
  "min-h-[44px] rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

export function MaterialsList({
  projectId,
  materials,
  relationships,
}: {
  projectId: string;
  materials: MaterialRow[];
  relationships: RelationshipOption[];
}) {
  const router = useRouter();
  const t = useTranslations("import");
  const tCommon = useTranslations("common");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkValue, setBulkValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const nameById = new Map(relationships.map((r) => [r.id, r.name]));

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(t("errUpdateFailed"));
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  function setOne(id: string, value: string) {
    return call(`/api/materials/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ contextIds: value ? [value] : [] }),
    });
  }

  async function applyBulk() {
    await call("/api/materials", {
      method: "PATCH",
      body: JSON.stringify({
        projectId,
        materialIds: selected,
        contextIds: bulkValue ? [bulkValue] : [],
      }),
    });
    setSelected([]);
  }

  function remove(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    return call(`/api/materials/${id}`, { method: "DELETE" });
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">{t("oldImportsNote")}</p>
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
      ) : null}

      {relationships.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              setSelected(selected.length === materials.length ? [] : materials.map((m) => m.id))
            }
          >
            {selected.length === materials.length ? t("selectNone") : t("selectAll")}
          </button>
          <select className={selectCls} value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
            <option value="">{t("clearRelationship")}</option>
            {relationships.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={btnSecondary}
            disabled={busy || selected.length === 0}
            onClick={applyBulk}
          >
            {t("setRelationshipFor", { count: selected.length })}
          </button>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">{t("noRelationshipsHint")}</p>
      )}

      <ul className="space-y-3 text-sm">
        {materials.map((m) => {
          const current = m.contextIds.find((id) => nameById.has(id)) ?? "";
          return (
            <li key={m.id} className="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <label className="flex min-h-[44px] min-w-[44px] items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={selected.includes(m.id)}
                    onChange={() => toggle(m.id)}
                    aria-label={t("selectMaterial")}
                  />
                </label>
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {m.sourceType}
                </span>
                {m.language ? <span className="text-xs text-neutral-400">{m.language}</span> : null}
                {current ? (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                    {nameById.get(current)}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-400">{t("noRelationship")}</span>
                )}
                <span className="ml-auto shrink-0 text-xs text-neutral-400">
                  {t("evidence", { count: m.evidenceCount })}
                </span>
              </div>
              <p className="break-words text-neutral-500">{m.preview}</p>
              {Object.keys(m.sourceMetadata).length > 0 ? (
                <details className="text-xs text-neutral-500">
                  <summary className="cursor-pointer">{t("sourceMetadataLabel")}</summary>
                  {[m.sourceMetadata.url, m.sourceMetadata.sourceUrl].map((raw, i) => {
                    const href = safeHttpUrl(raw);
                    return href ? (
                      <a
                        key={i}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="block break-all text-blue-600 underline dark:text-blue-400"
                      >
                        {href}
                      </a>
                    ) : null;
                  })}
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded bg-neutral-50 p-2 dark:bg-neutral-900">
                    {JSON.stringify(m.sourceMetadata, null, 2)}
                  </pre>
                </details>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {relationships.length > 0 ? (
                  <select
                    className={selectCls}
                    value={current}
                    disabled={busy}
                    aria-label={t("relationshipLabel")}
                    onChange={(e) => setOne(m.id, e.target.value)}
                  >
                    <option value="">{t("noRelationship")}</option>
                    {relationships.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button type="button" className={btnSecondary} disabled={busy} onClick={() => remove(m.id)}>
                  {t("deleteMaterial")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
