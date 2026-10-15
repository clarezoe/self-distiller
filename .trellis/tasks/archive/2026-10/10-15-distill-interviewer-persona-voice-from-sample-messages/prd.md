# Distill interviewer persona voice from sample messages

Partial delivery of GitHub #15. User (2026-10-15): "interview 里的 persona 是不是也要蒸馏一下，不然你怎么知道这个人怎么说话？"

## Decision record (Jev, 2026-10-15)

- Approach choice: `paste_samples` 0.96, `from_imported_chats` 0.03, `both_now` 0.01, `do_nothing` 0.00 (confidence 0.95).
- Scores (0-4): paste_samples 3.25, from_imported_chats 1.29, both_now 1.43, do_nothing 0.15. Choice and scores agree.
- Why not imported chats now: all 96 production materials were imported as plain text without speaker labels, so the other person's lines cannot be separated.
- Keep raw samples after distilling: Jev noul 0.48 (near-even). Decision: **discard** raw samples. They are a third party's private messages; the distilled profile is enough for the interviewer, and the user can paste again to re-distill. Recorded here so the user can overrule.

## Problem

An interviewer persona is only a hand-written description. The planner LLM guesses how that person talks.

## Requirements

### Data
- Add nullable `voiceProfile String?` (markdown/plain text, max ~3000 chars) and `voiceDistilledAt DateTime?` to `InterviewerPersona`.
- New additive Prisma migration under `prisma/migrations/` (timestamp after `20260627120000_interviewer_personas`). Must be safe on existing rows. Regenerate client (`src/generated/prisma`).

### Distill
- New prompt `src/lib/prompts/persona-voice-distiller.ts` (follow the style of the other prompt files). Input: persona name, relationship, description, raw sample messages written by that person (string, max ~20000 chars). Output (structured JSON, via the existing `runAgent` helper in `src/lib/llm`): fields such as `tone`, `sentence_style` (length, punctuation), `vocabulary_and_phrases` (typical words/catchphrases, quoted from samples), `emoji_and_formatting`, `how_they_ask_and_push`, `language_mix`, and `example_lines` (3-6 short verbatim or near-verbatim lines from the samples). The prompt must only describe what the samples show, no invented traits.
- Pure formatter that turns the JSON into a compact text `voiceProfile` (unit-tested).
- Service function `distillPersonaVoice(projectId, personaId, samples, userId)` in `src/lib/services/interviewer-personas.ts`: scoped by projectId (IDOR-safe like deletePersona), resolves the user's LLM credential/settings the same way the interview planner does, runs the distiller, stores `voiceProfile` + `voiceDistilledAt`. **Raw samples are never persisted** (not in DB, not in logs).
- Validation: samples required, min ~200 chars (enough signal), max ~20000 chars; clear errors.

### API
- `POST /api/interviewer-personas/[id]/distill` with `{ samples: string }`. Auth + project ownership like the existing `[id]` route. Returns updated persona.
- Allow clearing the profile (e.g. `DELETE` on the same path, or a field) so the user can go back to description-only.

### Planner
- `buildInterviewPlannerMessages` gets optional `interviewerVoiceProfile`. When present, add a block: the persona's real speaking style distilled from their own messages; every interviewer turn must match it (wording, length, emoji, language mix) while still following the sampling rules. Thread it from the interview start path (`src/lib/self-model/interview.ts` / `src/lib/services/interviews.ts`) where the persona description is threaded today.
- Unit test: profile block appears when present, absent otherwise.

### UI (interview page persona manager, `src/app/(app)/interview/interview-client.tsx`)
- Per saved persona: "Distill voice" action opening a textarea: "Paste messages this person wrote to you (only their lines)". Help text: samples are used once to build a style profile and are not stored.
- Show status: "Voice distilled <date>" with an expandable view of the profile, plus "Re-distill" and "Clear".
- Pending state while the LLM runs; error message on failure.
- Mobile-friendly (textarea font ≥16px, controls ≥44px), en/zh i18n in `messages/*.json`, extend `src/lib/messages.test.ts`.

## Out of scope
- Extracting a speaker's lines from imported chats (needs labeled re-import). Leave #15 open for that.

## Acceptance
- lint, tsc, vitest, build pass.
- Migration applies cleanly on a fresh DB (`prisma migrate diff` or equivalent check if no DB available).
- Tests: input validation, formatter, planner block, route scoping where existing patterns allow.
