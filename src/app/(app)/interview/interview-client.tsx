"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const inputCls =
  "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950";
const btnCls =
  "rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900";
const btnSecondary =
  "rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900";

// Persona suggestions (PRD §6.2 interviewer personas). Free text allowed.
const PERSONA_SUGGESTIONS = [
  "close friend",
  "product coach",
  "skeptical interviewer",
  "subordinate",
  "child",
  "customer",
  "student",
  "partner",
  "formal interviewer",
  "future self",
];

type ContextOption = { id: string; type: string; name: string };
type Turn = { speaker: "agent" | "user"; text: string; timestamp: string };
type PlannedTurn = { text: string; purpose: string };

type StartResult = {
  id: string;
  goal: string;
  interviewerPersona: string;
  language: string | null;
  plannedTurns: PlannedTurn[];
  expectedSignals: string[];
  transcript: Turn[];
};

// Fallback interview languages when the project has defined no language-type contexts.
const DEFAULT_LANGUAGES = ["zh", "en", "sv"];

type UpdateProposal = {
  summary?: string;
  update_level?: string;
  affected_paths?: string[];
  values?: Record<string, unknown>;
  confidence?: number;
  evidence_needed?: boolean;
};

type ExtractionReport = {
  summary?: string;
  explicit_facts?: string[];
  preferences?: string[];
  tone_patterns?: string[];
  reaction_patterns?: string[];
  correction_behavior?: string[];
  role_specific_behavior?: string[];
  relationship_specific_behavior?: string[];
  language_specific_behavior?: string[];
  evidence_quotes?: Array<{ claim: string; quote: string; confidence?: number }>;
  update_proposal: UpdateProposal;
};

export function InterviewClient({
  projectId,
  interviewTypes,
  contexts,
  hasModel,
}: {
  projectId: string;
  interviewTypes: string[];
  contexts: ContextOption[];
  hasModel: boolean;
}) {
  const router = useRouter();
  // Language the interview is CONDUCTED in. Options come from the project's language-type
  // contexts (so the user picks among languages they've defined); fall back to a built-in
  // list. This is the interview's OWN language, independent of UI locale.
  const languageOptions = (() => {
    const fromContexts = contexts.filter((c) => c.type === "language").map((c) => c.name);
    return fromContexts.length > 0 ? fromContexts : DEFAULT_LANGUAGES;
  })();

  const [type, setType] = useState(interviewTypes[0] ?? "relationship");
  const [persona, setPersona] = useState(PERSONA_SUGGESTIONS[0]);
  const [goal, setGoal] = useState("");
  const [language, setLanguage] = useState(languageOptions[0] ?? "");
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);

  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [interviewGoal, setInterviewGoal] = useState<string>("");
  const [interviewLanguage, setInterviewLanguage] = useState<string | null>(null);
  const [plannedTurns, setPlannedTurns] = useState<PlannedTurn[]>([]);
  const [expectedSignals, setExpectedSignals] = useState<string[]>([]);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [reply, setReply] = useState("");
  const [report, setReport] = useState<ExtractionReport | null>(null);

  const [busy, setBusy] = useState<null | "start" | "send" | "extract" | "apply">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // The next un-asked planned interviewer turn (turn 0 is seeded at start).
  const askedAgentTurns = transcript.filter((t) => t.speaker === "agent").length;
  const nextPlanned = plannedTurns[askedAgentTurns] ?? null;

  function toggleContext(id: string) {
    setSelectedContexts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function start() {
    setError(null);
    setDone(null);
    setBusy("start");
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          type,
          interviewerPersona: persona,
          targetContextIds: selectedContexts,
          language: language.trim() || undefined,
          goal: goal || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Failed to start interview"));
      const data = (await res.json()) as StartResult;
      setInterviewId(data.id);
      setInterviewGoal(data.goal);
      setInterviewLanguage(data.language);
      setPlannedTurns(data.plannedTurns);
      setExpectedSignals(data.expectedSignals ?? []);
      setTranscript(data.transcript);
      setReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function appendTurn(speaker: "agent" | "user", text: string) {
    if (!interviewId) return;
    const res = await fetch(`/api/interviews/${interviewId}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speaker, text }),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to append turn"));
    const data = (await res.json()) as { transcript: Turn[] };
    setTranscript(data.transcript);
  }

  async function sendReply() {
    if (!reply.trim() || !interviewId) return;
    setError(null);
    setBusy("send");
    try {
      // Persist the user's reply, then advance the interviewer with the next planned turn.
      await appendTurn("user", reply.trim());
      setReply("");
      const upcoming = plannedTurns[askedAgentTurns + 1] ?? null;
      if (upcoming) {
        await appendTurn("agent", upcoming.text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function extract() {
    if (!interviewId) return;
    setError(null);
    setDone(null);
    setBusy("extract");
    try {
      const res = await fetch(`/api/interviews/${interviewId}/extract`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Extraction failed"));
      const data = (await res.json()) as { report: ExtractionReport };
      setReport(data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!interviewId) return;
    setError(null);
    setDone(null);
    setBusy("apply");
    try {
      const res = await fetch(`/api/interviews/${interviewId}/apply`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Apply failed"));
      const data = (await res.json()) as { version: string };
      setDone(`Self Model v${data.version} created from this interview.`);
      setReport(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setInterviewId(null);
    setInterviewGoal("");
    setInterviewLanguage(null);
    setPlannedTurns([]);
    setExpectedSignals([]);
    setTranscript([]);
    setReply("");
    setReport(null);
    setError(null);
    setDone(null);
  }

  // ---- Setup view (no interview started) ----
  if (!interviewId) {
    return (
      <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="font-medium">Plan an interview</h2>
        {!hasModel ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40">
            No Self Model yet. The planner still works, but interviews improve most after generating v0.1 in Import.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">Interview type</span>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              {interviewTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-500">Interviewer persona</span>
            <input
              className={inputCls}
              list="persona-suggestions"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="e.g. subordinate, close friend"
            />
            <datalist id="persona-suggestions">
              {PERSONA_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
        </div>

        <label className="block text-sm sm:max-w-xs">
          <span className="mb-1 block text-neutral-500">Interview language (the language the interview is conducted in)</span>
          <input
            className={inputCls}
            list="interview-language-options"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="e.g. zh, en, sv"
          />
          <datalist id="interview-language-options">
            {languageOptions.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-500">Goal (optional — planner derives one if blank)</span>
          <input
            className={inputCls}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. how I comfort a close friend who feels like a failure"
          />
        </label>

        {contexts.length > 0 ? (
          <div className="space-y-1">
            <span className="text-sm text-neutral-500">Target context(s) (optional)</span>
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

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
        ) : null}

        <button className={btnCls} onClick={start} disabled={busy !== null || !persona.trim()}>
          {busy === "start" ? "Planning interview… (a few seconds)" : "Start interview"}
        </button>
      </section>
    );
  }

  // ---- Interview / chat view ----
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">{interviewGoal}</h2>
            <p className="text-xs text-neutral-400">
              Persona: {persona} · {type}
              {interviewLanguage ? ` · ${interviewLanguage}` : ""}
            </p>
          </div>
          <button className={btnSecondary} onClick={reset} disabled={busy !== null}>
            New interview
          </button>
        </div>
        {expectedSignals.length > 0 ? (
          <p className="text-xs text-neutral-400">Sampling: {expectedSignals.join(", ")}</p>
        ) : null}

        <div className="space-y-3">
          {transcript.map((t, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                t.speaker === "agent"
                  ? "bg-neutral-100 dark:bg-neutral-800"
                  : "ml-auto bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              }`}
            >
              <p className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">
                {t.speaker === "agent" ? persona : "you"}
              </p>
              {t.text}
            </div>
          ))}
        </div>

        {!report ? (
          <div className="space-y-2">
            <textarea
              className={`${inputCls} min-h-24`}
              placeholder="Reply as you really would…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button className={btnCls} onClick={sendReply} disabled={busy !== null || !reply.trim()}>
                {busy === "send" ? "Sending…" : "Send reply"}
              </button>
              <button className={btnSecondary} onClick={extract} disabled={busy !== null || transcript.length < 2}>
                {busy === "extract" ? "Extracting report…" : "End interview & extract"}
              </button>
              {nextPlanned ? (
                <span className="text-xs text-neutral-400">Next: {nextPlanned.purpose}</span>
              ) : (
                <span className="text-xs text-neutral-400">All planned turns used — extract when ready.</span>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p>
      ) : null}
      {done ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40">{done}</p>
      ) : null}

      {report ? (
        <ReportView report={report} onApply={apply} onReject={reset} busy={busy} />
      ) : null}
    </div>
  );
}

function ReportView({
  report,
  onApply,
  onReject,
  busy,
}: {
  report: ExtractionReport;
  onApply: () => void;
  onReject: () => void;
  busy: string | null;
}) {
  const p = report.update_proposal;
  return (
    <section className="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="font-medium">Extraction report</h2>
      {report.summary ? <p className="text-sm text-neutral-600 dark:text-neutral-300">{report.summary}</p> : null}

      <Group label="Tone patterns" items={report.tone_patterns} />
      <Group label="Reaction patterns" items={report.reaction_patterns} />
      <Group label="Correction behavior (high-value)" items={report.correction_behavior} />
      <Group label="Role-specific behavior" items={report.role_specific_behavior} />
      <Group label="Relationship-specific behavior" items={report.relationship_specific_behavior} />
      <Group label="Language-specific behavior" items={report.language_specific_behavior} />
      <Group label="Explicit facts" items={report.explicit_facts} />
      <Group label="Preferences" items={report.preferences} />

      {report.evidence_quotes && report.evidence_quotes.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Evidence quotes</p>
          <ul className="mt-1 space-y-1 text-sm">
            {report.evidence_quotes.map((q, i) => (
              <li key={i}>
                <span className="text-neutral-500">{q.claim}: </span>
                <span className="italic">“{q.quote}”</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">Proposed update</span>
          {p.update_level ? (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">{p.update_level}</span>
          ) : null}
          {typeof p.confidence === "number" ? (
            <span className="text-xs text-neutral-400">confidence {p.confidence}</span>
          ) : null}
          {p.evidence_needed ? (
            <span className="text-xs text-amber-600">needs more evidence</span>
          ) : null}
        </div>
        {p.summary ? <p className="text-sm">{p.summary}</p> : null}
        {p.affected_paths && p.affected_paths.length > 0 ? (
          <p className="text-xs text-neutral-400">Affects: {p.affected_paths.join(", ")}</p>
        ) : null}
        <pre className="max-h-60 overflow-auto rounded bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
          {JSON.stringify(p.values ?? {}, null, 2)}
        </pre>
      </div>

      <div className="flex gap-3">
        <button
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          onClick={onApply}
          disabled={busy !== null}
        >
          {busy === "apply" ? "Applying…" : "Accept → new Self Model version"}
        </button>
        <button
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          onClick={onReject}
          disabled={busy !== null}
        >
          Reject
        </button>
      </div>
    </section>
  );
}

function Group({ label, items }: { label: string; items?: string[] }) {
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
