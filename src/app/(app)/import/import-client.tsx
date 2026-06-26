"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";
const btnCls =
  "rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900";
const btnSecondary =
  "rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

type ContextOption = { id: string; type: string; name: string };

type ExtractedEvidence = {
  id: string;
  claim: string;
  evidenceText: string;
  signalType: string;
  confidence: number;
  stability: string;
};

export function ImportClient({
  projectId,
  sourceTypes,
  contexts,
}: {
  projectId: string;
  sourceTypes: string[];
  contexts: ContextOption[];
}) {
  const router = useRouter();
  const t = useTranslations("import");
  const tCommon = useTranslations("common");
  const [content, setContent] = useState("");
  const [sourceType, setSourceType] = useState(sourceTypes[0] ?? "chat");
  const [language, setLanguage] = useState("");
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<ExtractedEvidence[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<null | "analyze" | "generate">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleContext(id: string) {
    setSelectedContexts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
  }

  async function analyze() {
    setError(null);
    setDone(null);
    if (!content.trim()) {
      setError(t("pasteFirst"));
      return;
    }
    setBusy("analyze");
    try {
      const createRes = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sourceType,
          content,
          language: language || undefined,
          contextIds: selectedContexts,
        }),
      });
      if (!createRes.ok) throw new Error(await readError(createRes, t("errFailedSaveMaterial")));
      const material = (await createRes.json()) as {
        id: string | null;
        created: number;
        skipped: number;
      };

      // Everything in this paste was already imported (content-hash dedup).
      // No new material exists to analyze — report the intentional skip instead
      // of calling analyze with a null id (which would 404 "Material not found").
      if (material.created === 0) {
        setDone(
          t("alreadyImported", {
            count: material.skipped,
            plural: material.skipped === 1 ? "" : "s",
          }),
        );
        return;
      }

      // A large paste/upload is split into several Analyze-able materials.
      // Tell the user so they understand one input became many; the Analyze
      // flow below still runs per-material (here, the first chunk).
      if (material.created > 1) {
        const dupNote =
          material.skipped > 0
            ? t("duplicateChunksNote", {
                count: material.skipped,
                plural: material.skipped === 1 ? "" : "s",
              })
            : "";
        setDone(
          t("createdManyChunks", { created: material.created, dupNote }),
        );
      }

      if (!material.id) {
        setError(t("noMaterialToAnalyze"));
        return;
      }
      const analyzeRes = await fetch(`/api/materials/${material.id}/analyze`, {
        method: "POST",
      });
      if (!analyzeRes.ok) throw new Error(await readError(analyzeRes, t("errAnalysisFailed")));
      const result = (await analyzeRes.json()) as { evidence: ExtractedEvidence[] };

      setEvidence(result.evidence);
      // Default: all accepted (per §19.1 checkbox default on).
      setAccepted(Object.fromEntries(result.evidence.map((e) => [e.id, true])));
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setError(null);
    setDone(null);
    const ids = evidence.filter((e) => accepted[e.id]).map((e) => e.id);
    if (ids.length === 0) {
      setError(t("acceptAtLeastOne"));
      return;
    }
    setBusy("generate");
    try {
      const res = await fetch("/api/self-model/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, evidenceIds: ids }),
      });
      if (!res.ok) throw new Error(await readError(res, t("errGenerationFailed")));
      const model = (await res.json()) as { version: string };
      setDone(t("modelCreated", { version: model.version }));
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setBusy(null);
    }
  }

  const acceptedCount = evidence.filter((e) => accepted[e.id]).length;

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">{t("addMaterial")}</h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">{t("sourceType")}</span>
            <select className={inputCls} value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {sourceTypes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">{t("language")}</span>
            <input className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)} placeholder={t("languagePlaceholder")} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">{t("uploadFile")}</span>
            <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={handleFile} className="block w-full text-sm" />
          </label>
        </div>

        {contexts.length > 0 ? (
          <div className="space-y-1">
            <span className="text-sm text-neutral-500">{t("relatedContexts")}</span>
            <div className="flex flex-wrap gap-2">
              {contexts.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                    selectedContexts.includes(c.id)
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                      : "border-neutral-300 dark:border-neutral-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedContexts.includes(c.id)}
                    onChange={() => toggleContext(c.id)}
                  />
                  <span className="opacity-70">{c.type}</span>
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <textarea
          className={`${inputCls} min-h-40 font-mono`}
          placeholder={t("contentPlaceholder")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        <div className="flex items-center gap-3">
          <button className={btnCls} onClick={analyze} disabled={busy !== null}>
            {busy === "analyze" ? t("analyzing") : t("analyze")}
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
      ) : null}
      {done ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40">{done}</p>
      ) : null}

      {evidence.length > 0 ? (
        <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{t("extractedEvidence", { count: evidence.length })}</h2>
            <span className="text-sm text-neutral-500">{t("accepted", { count: acceptedCount })}</span>
          </div>
          <ul className="space-y-3">
            {evidence.map((e) => (
              <li
                key={e.id}
                className="flex gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={accepted[e.id] ?? false}
                  onChange={() =>
                    setAccepted((prev) => ({ ...prev, [e.id]: !prev[e.id] }))
                  }
                />
                <div className="space-y-1">
                  <p className="font-medium">{e.claim}</p>
                  <p className="text-neutral-500">“{e.evidenceText}”</p>
                  <p className="flex flex-wrap gap-2 text-xs text-neutral-400">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">{e.signalType}</span>
                    <span>{t("confidence", { value: e.confidence })}</span>
                    <span>{t("stability", { value: e.stability })}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <button className={btnSecondary} onClick={generate} disabled={busy !== null || acceptedCount === 0}>
            {busy === "generate" ? t("generating") : t("generateFromAccepted")}
          </button>
        </section>
      ) : null}
    </div>
  );
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === "string") return data.error;
    if (data?.error) return JSON.stringify(data.error);
  } catch {
    // ignore
  }
  return fallback;
}
