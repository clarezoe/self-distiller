# Persona voice: add more samples to refine profile

Follow-up to PR #22. User (2026-10-15): "那这个人的话可以加吗？200字会不会太少了"

## Problems

1. Re-distilling replaces the profile with one built only from the new paste. The user cannot keep adding that person's messages to sharpen the profile.
2. The 200-character minimum is enough to pass validation but too little to capture a voice. The UI gives no hint about how much is enough.

## Requirements

- Distill accepts a mode: `replace` (default, current behaviour) or `add`.
  - `add`: the existing `voiceProfile` is passed to the distiller together with the new samples. Prompt: the existing profile came from earlier messages by the same person; merge the new messages into it, keep traits still supported, adjust or drop ones the new messages contradict, add newly seen traits, keep `example_lines` to the 3-6 best across old and new (old example lines are available in the profile text). Still describe only what the evidence shows. Output the same schema, same length cap.
  - `add` with no existing profile behaves like `replace`.
  - Raw samples are still never persisted or logged (keep `redactRequest`; the existing profile text is fine to log since it is derived, but redacting the whole request is fine too).
- API: `POST /api/interviewer-personas/[id]/distill` accepts optional `mode: "replace" | "add"`; validate; default `replace`. Same auth/project scoping.
- Track how much evidence the profile rests on: add nullable-safe column `voiceSampleChars Int @default(0)` to `InterviewerPersona` (cumulative characters distilled so far; `replace` sets it to the new length, `add` increases it; cleared to 0 on clear). Additive migration `prisma/migrations/<timestamp after 20261015120000>_persona_voice_sample_chars`. Store only the count, never the text.
- Keep VOICE_SAMPLES_MIN = 200 as the hard floor, keep MAX 20000 per paste. Add pure helper `voiceEvidenceLevel(chars)` returning `rough` (<500), `fair` (500-1999), `good` (>=2000), unit-tested.
- UI (`src/app/(app)/interview/interview-client.tsx`):
  - When a profile exists, the primary action is "Add more messages" (mode add); keep "Re-distill from scratch" (mode replace) and "Clear".
  - Show evidence level next to the distilled date: e.g. "Evidence: rough (320 chars)". When rough or fair, hint: "Add more of their messages for a more accurate voice. 2000+ characters (about 30+ messages) works well."
  - In the paste box, show a live character counter with the same hint thresholds.
  - Note in the textarea help that only their own lines should be pasted and nothing is stored.
  - en/zh i18n in `messages/*.json`, extend `src/lib/messages.test.ts`. Mobile ergonomics unchanged (16px textarea, >=44px controls).
- Tests: validation of mode, `voiceEvidenceLevel`, distiller messages include the existing profile only in add mode.

## Acceptance
lint, tsc --noEmit, vitest, build pass. Migration is two-line additive SQL; check `prisma validate` + `prisma generate`.
