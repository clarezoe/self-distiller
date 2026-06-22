"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";
const btnCls =
  "rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900";
const btnSecondary =
  "rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

type ContextOption = { id: string; type: string; name: string };

type TaskTypeOption = { value: string; label: string };

type BoundaryWarning = { category: string; reason: string; message: string };

type GeneratedTask = {
  id: string;
  taskType: string;
  input: string;
  output: string;
  boundaryWarning: BoundaryWarning | null;
  routerWarnings: string[];
  createdAt: string;
};

// §6.5 labels surfaced as toggles.
const LABELS: { value: string; label: string }[] = [
  { value: "sounds_like_me", label: "Sounds like me" },
  { value: "not_like_me", label: "Doesn't sound like me" },
  { value: "too_long", label: "Too long" },
  { value: "too_short", label: "Too short" },
  { value: "too_soft", label: "Too soft" },
  { value: "too_harsh", label: "Too harsh" },
  { value: "too_ai_like", label: "Too AI-like" },
  { value: "language_too_perfect", label: "Language too perfect" },
  { value: "too_many_preserved_mistakes", label: "Too many preserved mistakes" },
  { value: "too_corrected", label: "Too corrected" },
  { value: "wrong_relationship_tone", label: "Wrong relationship tone" },
  { value: "wrong_emotional_tone", label: "Wrong emotional tone" },
  { value: "wrong_intention", label: "Wrong intention" },
];

const DIMENSION_ORDER = ["language", "role", "relationship", "scene"] as const;

export function TasksClient({
  projectId,
  taskTypes,
  contexts,
  hasModel,
}: {
  projectId: string;
  taskTypes: TaskTypeOption[];
  contexts: ContextOption[];
  hasModel: boolean;
}) {
  const router = useRouter();
  const [taskType, setTaskType] = useState(taskTypes[0]?.value ?? "chat_reply");
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});

  const [task, setTask] = useState<GeneratedTask | null>(null);
  const [busy, setBusy] = useState<null | "generate" | "feedback">(null);
  const [error, setError] = useState<string | null>(null);

  // Feedback state.
  const [likeness, setLikeness] = useState<number | "">("");
  const [usefulness, setUsefulness] = useState<number | "">("");
  const [labels, setLabels] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [saveSample, setSaveSample] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function pick(type: string, id: string) {
    setSelected((s) => ({ ...s, [type]: id }));
  }

  function toggleLabel(v: string) {
    setLabels((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  }

  async function generate() {
    setError(null);
    setFeedbackDone(null);
    setBusy("generate");
    try {
      const context_ids = Object.values(selected).filter(Boolean);
      const res = await fetch("/api/tasks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          task_type: taskType,
          input: input.trim(),
          context_ids,
          mode: "draft",
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to generate draft"));
      const data = (await res.json()) as GeneratedTask;
      setTask(data);
      // reset feedback for the new draft
      setLikeness("");
      setUsefulness("");
      setLabels([]);
      setComments("");
      setSaveSample(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function sendFeedback() {
    if (!task) return;
    setError(null);
    setFeedbackDone(null);
    setBusy("feedback");
    try {
      const res = await fetch(`/api/tasks/${task.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          likeness_score: likeness === "" ? undefined : likeness,
          usefulness_score: usefulness === "" ? undefined : usefulness,
          labels,
          comments: comments.trim() || undefined,
          save_as_training_sample: saveSample,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to record feedback"));
      const data = (await res.json()) as { trainingSampleId: string | null };
      setFeedbackDone(
        data.trainingSampleId
          ? "Feedback saved. Output stored as a training sample."
          : "Feedback saved.",
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setTask(null);
    setError(null);
    setFeedbackDone(null);
  }

  const contextsByType = (type: string) => contexts.filter((c) => c.type === type);

  // ---- Generate view ----
  if (!task) {
    return (
      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">New draft</h2>
        {!hasModel ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40">
            No Self Model yet — drafts will be generic until you generate v0.1 (Import) and train it.
          </p>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">Task type</span>
          <select className={inputCls} value={taskType} onChange={(e) => setTaskType(e.target.value)}>
            {taskTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="block text-sm text-neutral-500">Context (manual selection)</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {DIMENSION_ORDER.map((type) => (
              <label key={type} className="block text-sm">
                <span className="mb-1 block text-xs text-neutral-400 capitalize">{type}</span>
                <select
                  className={inputCls}
                  value={selected[type] ?? ""}
                  onChange={(e) => pick(type, e.target.value)}
                >
                  <option value="">— {type} (optional) —</option>
                  {contextsByType(type).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">Task input</span>
          <textarea
            className={`${inputCls} min-h-28`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. A friend says: I really feel like a failure lately."
          />
        </label>

        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">Mode: Draft</span>
          <span>Drafts only — nothing is ever sent for you.</span>
        </div>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
        ) : null}

        <button className={btnCls} onClick={generate} disabled={busy !== null || !input.trim()}>
          {busy === "generate" ? "Generating draft…" : "Generate draft"}
        </button>
      </section>
    );
  }

  // ---- Result view ----
  const blocked = task.boundaryWarning !== null;
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-medium">Draft</h2>
          <button className={btnSecondary} onClick={reset} disabled={busy !== null}>
            New draft
          </button>
        </div>

        {blocked ? (
          <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-800 dark:bg-red-950/40">
            <p className="font-medium text-red-700 dark:text-red-300">Sensitive topic — please take over</p>
            <p className="text-red-700 dark:text-red-300">{task.boundaryWarning?.message}</p>
            {task.boundaryWarning?.reason ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {task.boundaryWarning.category}: {task.boundaryWarning.reason}
              </p>
            ) : null}
            <p className="text-xs text-red-600 dark:text-red-400">
              No send-ready draft is shown. Write this reply yourself.
            </p>
          </div>
        ) : (
          <>
            {task.routerWarnings.length > 0 ? (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/40">
                {task.routerWarnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            ) : null}
            <div className="whitespace-pre-wrap rounded-lg border border-neutral-200 px-3 py-3 text-sm dark:border-neutral-700">
              {task.output}
            </div>
            <p className="text-xs text-neutral-400">
              Draft only — review and send it yourself. The system never sends on your behalf.
            </p>
          </>
        )}
      </section>

      {blocked ? null : (
      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">Feedback</h2>

        <div className="flex flex-wrap gap-2">
          {LABELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => toggleLabel(l.value)}
              className={
                labels.includes(l.value)
                  ? "rounded-full bg-neutral-900 px-3 py-1 text-xs text-white dark:bg-white dark:text-neutral-900"
                  : "rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              }
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-500">Likeness (1-5)</span>
            <select
              className={inputCls}
              value={likeness}
              onChange={(e) => setLikeness(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-500">Usefulness (1-5)</span>
            <select
              className={inputCls}
              value={usefulness}
              onChange={(e) => setUsefulness(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">Comments (optional)</span>
          <textarea
            className={`${inputCls} min-h-20`}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={saveSample} onChange={(e) => setSaveSample(e.target.checked)} />
          <span>Save this output as a training sample</span>
        </label>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
        ) : null}
        {feedbackDone ? (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40">{feedbackDone}</p>
        ) : null}

        <button className={btnCls} onClick={sendFeedback} disabled={busy !== null}>
          {busy === "feedback" ? "Saving…" : "Save feedback"}
        </button>
      </section>
      )}
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
