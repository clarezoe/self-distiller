"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { voiceEvidenceLevel } from "@/lib/prompts/persona-voice-distiller";
import { btnSecondary, readError, VOICE_MAX, VOICE_MIN, type Persona } from "./shared";

// Per-persona voice distillation (GitHub #15). Samples live only in this component's state
// for the duration of the request; they are never stored client- or server-side.
export function VoiceControls({
  persona,
  projectId,
  onUpdated,
  disabled,
}: {
  persona: Persona;
  projectId: string;
  onUpdated: (p: Persona) => void;
  disabled: boolean;
}) {
  const t = useTranslations("interview");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [samples, setSamples] = useState("");
  const [mode, setMode] = useState<"add" | "replace">("replace");
  const [pending, setPending] = useState<null | "distill" | "clear">(null);
  const [err, setErr] = useState<string | null>(null);
  const trimmedLen = samples.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < VOICE_MIN;
  const canSubmit = trimmedLen >= VOICE_MIN && trimmedLen <= VOICE_MAX;
  const base = `/api/interviewer-personas/${persona.id}/distill`;

  async function distill() {
    setErr(null);
    setPending("distill");
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, samples, mode }),
      });
      if (!res.ok) throw new Error(await readError(res, t("errVoiceDistill")));
      const data = (await res.json()) as { persona: Persona };
      onUpdated({
        ...persona,
        voiceProfile: data.persona.voiceProfile,
        voiceDistilledAt: data.persona.voiceDistilledAt,
        voiceSampleChars: data.persona.voiceSampleChars,
      });
      setSamples("");
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setPending(null);
    }
  }

  async function clear() {
    setErr(null);
    setPending("clear");
    try {
      const res = await fetch(`${base}?projectId=${encodeURIComponent(projectId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, t("errVoiceClear")));
      onUpdated({ ...persona, voiceProfile: null, voiceDistilledAt: null, voiceSampleChars: 0 });
      setShowProfile(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : tCommon("somethingWrong"));
    } finally {
      setPending(null);
    }
  }

  const linkBtn = "min-h-11 pr-3 text-xs text-neutral-600 hover:underline disabled:opacity-50 dark:text-neutral-300";
  const busy = disabled || pending !== null;
  const level = voiceEvidenceLevel(persona.voiceSampleChars);
  const profileChars = persona.voiceSampleChars;
  // Live counter level: in add mode the new text counts on top of what is already distilled.
  const draftLevel = voiceEvidenceLevel(trimmedLen + (mode === "add" && persona.voiceProfile ? profileChars : 0));
  const openEditor = (m: "add" | "replace") => {
    if (editing && mode === m) {
      setEditing(false);
      return;
    }
    setMode(m);
    setEditing(true);
  };

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap items-center">
        {persona.voiceProfile ? (
          <>
            <span className="mr-3 text-xs text-green-700 dark:text-green-400">
              {t("voiceDistilledOn", { date: persona.voiceDistilledAt ? persona.voiceDistilledAt.slice(0, 10) : "" })}
              {" · "}
              {t("voiceEvidence", { level: t(`evidence_${level}`), chars: profileChars })}
            </span>
            <button type="button" className={linkBtn} onClick={() => setShowProfile((v) => !v)}>
              {showProfile ? t("hideVoiceProfile") : t("viewVoiceProfile")}
            </button>
            <button type="button" className={`${linkBtn} font-medium`} onClick={() => openEditor("add")} disabled={busy}>
              {t("addMoreMessages")}
            </button>
            <button type="button" className={linkBtn} onClick={() => openEditor("replace")} disabled={busy}>
              {t("reDistillVoice")}
            </button>
            <button type="button" className={`${linkBtn} text-red-600`} onClick={clear} disabled={busy}>
              {t("clearVoice")}
            </button>
          </>
        ) : (
          <button type="button" className={linkBtn} onClick={() => openEditor("replace")} disabled={busy}>
            {t("distillVoice")}
          </button>
        )}
      </div>

      {persona.voiceProfile && level !== "good" ? (
        <p className="text-xs text-amber-600">{t("voiceMoreHint")}</p>
      ) : null}

      {showProfile && persona.voiceProfile ? (
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs dark:bg-neutral-900">
          {persona.voiceProfile}
        </pre>
      ) : null}

      {editing ? (
        <div className="space-y-2">
          <label className="block text-xs">
            <span className="mb-1 block text-neutral-500">{t("voiceSamplesLabel")}</span>
            <textarea
              className="min-h-32 w-full rounded-md border border-neutral-300 px-3 py-2 text-base outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
              value={samples}
              maxLength={VOICE_MAX}
              onChange={(e) => setSamples(e.target.value)}
              placeholder={t("voiceSamplesPlaceholder")}
              disabled={pending !== null}
            />
          </label>
          <p className="text-xs text-neutral-400">{t("voiceSamplesHelp", { min: VOICE_MIN, max: VOICE_MAX })}</p>
          <p className="text-xs text-neutral-500">
            {t("voiceCounter", { count: trimmedLen })}
            {trimmedLen > 0 && draftLevel !== "good" ? ` — ${t("voiceMoreHint")}` : ""}
          </p>
          {tooShort ? <p className="text-xs text-amber-600">{t("voiceTooShort", { min: VOICE_MIN })}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${btnSecondary} min-h-11`} onClick={distill} disabled={busy || !canSubmit}>
              {pending === "distill" ? t("distillingVoice") : t("runDistill")}
            </button>
            <button
              type="button"
              className={`${btnSecondary} min-h-11`}
              onClick={() => {
                setEditing(false);
                setSamples("");
                setErr(null);
              }}
              disabled={pending !== null}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {err ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40">{err}</p> : null}
    </div>
  );
}
