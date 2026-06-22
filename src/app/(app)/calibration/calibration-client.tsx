"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";
const btnCls =
  "rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900";
const btnSecondary =
  "rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

type Combination = { id: string; name: string };

type Difference = {
  dimension: string;
  agent?: string;
  user?: string;
  note: string;
};

type UpdateProposal = {
  summary?: string;
  affected_paths?: string[];
  values?: Record<string, unknown>;
  confidence?: number;
};

type ComparisonReport = {
  summary?: string;
  differences?: Difference[];
  update_proposal?: UpdateProposal;
  affected_paths?: string[];
  confidence?: number;
  scope?: string;
};

// Mirror of the server's ClientCalibration (redacted shape). hiddenAgentAnswer is null until
// the user has answered — the client never receives the prediction beforehand (PRD §23.9).
type ClientCalibration = {
  id: string;
  scenario: string;
  incomingMessage: string | null;
  userAnswer: string | null;
  hiddenAgentAnswer: string | null;
  comparisonReport: ComparisonReport | null;
  updateProposal: UpdateProposal | null;
  userDecision: string | null;
  hiddenRevealed: boolean;
};

export function CalibrationClient({
  projectId,
  combinations,
  hasModel,
}: {
  projectId: string;
  combinations: Combination[];
  hasModel: boolean;
}) {
  const router = useRouter();
  const [combinationId, setCombinationId] = useState("");
  const [scenarioInput, setScenarioInput] = useState("");
  const [incomingInput, setIncomingInput] = useState("");

  const [cal, setCal] = useState<ClientCalibration | null>(null);
  const [answer, setAnswer] = useState("");
  const [editingValues, setEditingValues] = useState<string | null>(null);

  const [busy, setBusy] = useState<null | "create" | "submit" | "apply">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function create() {
    setError(null);
    setDone(null);
    setBusy("create");
    try {
      const res = await fetch("/api/calibrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          contextCombinationId: combinationId || undefined,
          scenario: scenarioInput.trim() || undefined,
          incomingMessage: incomingInput.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to create calibration"));
      const data = (await res.json()) as ClientCalibration;
      setCal(data);
      setAnswer("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function submitAnswer() {
    if (!cal || !answer.trim()) return;
    setError(null);
    setBusy("submit");
    try {
      const res = await fetch(`/api/calibrations/${cal.id}/user-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAnswer: answer.trim() }),
      });
      if (!res.ok) throw new Error(await readError(res, "Comparison failed"));
      const data = (await res.json()) as ClientCalibration;
      setCal(data);
      setEditingValues(JSON.stringify(data.updateProposal?.values ?? {}, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: "accepted" | "partially_accepted" | "rejected" | "edited") {
    if (!cal) return;
    setError(null);
    setDone(null);
    setBusy("apply");
    try {
      let editedProposal: UpdateProposal | undefined;
      if (decision === "edited") {
        let values: Record<string, unknown>;
        try {
          values = JSON.parse(editingValues ?? "{}");
        } catch {
          throw new Error("Edited values are not valid JSON.");
        }
        editedProposal = {
          summary: cal.updateProposal?.summary,
          affected_paths: cal.updateProposal?.affected_paths,
          values,
        };
      }
      const res = await fetch(`/api/calibrations/${cal.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, editedProposal }),
      });
      if (!res.ok) throw new Error(await readError(res, "Apply failed"));
      const data = (await res.json()) as { applied: boolean; version?: string };
      setDone(
        data.applied
          ? `Self Model v${data.version} created from this calibration.`
          : "Decision recorded. No model change.",
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setCal(null);
    setAnswer("");
    setEditingValues(null);
    setError(null);
    setDone(null);
  }

  // ---- Setup view ----
  if (!cal) {
    return (
      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">New blind calibration</h2>
        {!hasModel ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40">
            No Self Model yet. The prediction will be generic until you generate v0.1 (Import) and run interviews.
          </p>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">Context combination (optional)</span>
          <select className={inputCls} value={combinationId} onChange={(e) => setCombinationId(e.target.value)}>
            <option value="">— general (no combination) —</option>
            {combinations.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">Scenario (optional — the system generates one if blank)</span>
          <textarea
            className={`${inputCls} min-h-20`}
            value={scenarioInput}
            onChange={(e) => setScenarioInput(e.target.value)}
            placeholder="e.g. A close friend says they feel like a failure lately."
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">Incoming message (optional)</span>
          <input
            className={inputCls}
            value={incomingInput}
            onChange={(e) => setIncomingInput(e.target.value)}
            placeholder="The exact message you'd be replying to (if separate from the scenario)"
          />
        </label>

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
        ) : null}

        <button className={btnCls} onClick={create} disabled={busy !== null}>
          {busy === "create" ? "Generating scenario + hidden answer…" : "Start calibration"}
        </button>
        <p className="text-xs text-neutral-400">
          The agent writes its predicted reply now, but it stays hidden until after you answer.
        </p>
      </section>
    );
  }

  // ---- Answer view (hidden answer NOT yet revealed) ----
  if (!cal.hiddenRevealed) {
    return (
      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-medium">Your turn</h2>
          <button className={btnSecondary} onClick={reset} disabled={busy !== null}>
            New calibration
          </button>
        </div>

        <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">
          <p className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">Scenario</p>
          {cal.scenario}
        </div>
        {cal.incomingMessage ? (
          <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">
            <p className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">Incoming message</p>
            {cal.incomingMessage}
          </div>
        ) : null}

        <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/40">
          The agent has already written a hidden prediction. Write what you would <em>really</em> reply — it stays
          blind until you submit.
        </p>

        <textarea
          className={`${inputCls} min-h-28`}
          placeholder="Reply as you really would…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
        ) : null}

        <button className={btnCls} onClick={submitAnswer} disabled={busy !== null || !answer.trim()}>
          {busy === "submit" ? "Comparing…" : "Submit & reveal comparison"}
        </button>
      </section>
    );
  }

  // ---- Reveal view (both answers + difference report + proposal) ----
  const report = cal.comparisonReport;
  const proposal = cal.updateProposal;
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-medium">Comparison</h2>
          <button className={btnSecondary} onClick={reset} disabled={busy !== null}>
            New calibration
          </button>
        </div>

        <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">
          <p className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">Scenario</p>
          {cal.scenario}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
            <p className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">Agent prediction</p>
            {cal.hiddenAgentAnswer}
          </div>
          <div className="rounded-lg border border-neutral-900 px-3 py-2 text-sm dark:border-white">
            <p className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">Your real answer</p>
            {cal.userAnswer}
          </div>
        </div>

        {report?.summary ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{report.summary}</p>
        ) : null}
        {report?.scope ? (
          <span className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
            scope: {report.scope}
          </span>
        ) : null}

        {report?.differences && report.differences.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Differences</p>
            <ul className="space-y-2 text-sm">
              {report.differences.map((d, i) => (
                <li key={i} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                  <p className="text-xs font-medium text-neutral-500">{d.dimension}</p>
                  {d.agent ? <p className="text-xs">agent: {d.agent}</p> : null}
                  {d.user ? <p className="text-xs">you: {d.user}</p> : null}
                  <p className="mt-1">{d.note}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {proposal ? (
        <section className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Proposed update</span>
            {typeof proposal.confidence === "number" ? (
              <span className="text-xs text-neutral-400">confidence {proposal.confidence}</span>
            ) : null}
          </div>
          {proposal.summary ? <p className="text-sm">{proposal.summary}</p> : null}
          {proposal.affected_paths && proposal.affected_paths.length > 0 ? (
            <p className="text-xs text-neutral-400">Affects: {proposal.affected_paths.join(", ")}</p>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-neutral-500">
              Update values (edit before accepting to apply your own version)
            </span>
            <textarea
              className={`${inputCls} min-h-40 font-mono text-xs`}
              value={editingValues ?? JSON.stringify(proposal.values ?? {}, null, 2)}
              onChange={(e) => setEditingValues(e.target.value)}
            />
          </label>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
          ) : null}
          {done ? (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40">{done}</p>
          ) : null}

          {cal.userDecision ? (
            <p className="text-xs text-neutral-400">Decision recorded: {cal.userDecision}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button className={btnCls} onClick={() => decide("accepted")} disabled={busy !== null}>
                {busy === "apply" ? "Applying…" : "Accept → new version"}
              </button>
              <button className={btnSecondary} onClick={() => decide("partially_accepted")} disabled={busy !== null}>
                Partially accept
              </button>
              <button className={btnSecondary} onClick={() => decide("edited")} disabled={busy !== null}>
                Apply edited
              </button>
              <button className={btnSecondary} onClick={() => decide("rejected")} disabled={busy !== null}>
                Reject
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
          ) : null}
          {done ? (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40">{done}</p>
          ) : null}
        </>
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
