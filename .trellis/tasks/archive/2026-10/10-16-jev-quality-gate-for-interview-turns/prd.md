# Jev quality gate for interview turns

User (2026-10-16): "看看怎么把 jev 加进去，使 app 更有效"

## Decision record (Jev, 2026-10-16)
Which Jev integration first (choice, confidence 0.64): interview_turn_gate 0.70, evidence_support_check 0.16, interview_coverage 0.14, sensitive_check_jev 0.00, calibration_scoring 0.00, draft_voice_match 0.00.
Per-item value scores (0-4): evidence_support_check 2.74, interview_coverage 2.68, interview_turn_gate 2.66, draft_voice_match 1.78, sensitive_check_jev 1.44, calibration_scoring 1.33.
Choice and scores disagree: the top three scores are near-even, the choice clearly favours the turn gate. Followed the choice; coverage is folded into the same Jev request (no extra latency). Evidence support check is the next candidate.

## Probe (real Jev, 2026-10-16) — basis for thresholds
Three noul questions on a zh close-friend interview:
| case | responds | in_character | not_repeat |
|---|---|---|---|
| good, acknowledges reply | 0.90 | 0.94 | 0.96 |
| good, answers user's question | 0.93 | 0.96 | 0.95 |
| ignores user's reply | 0.20 | 0.90 | 0.96 |
| wrong language (English) | 0.55 | 0.05 | 0.96 |
| repeats earlier question | 0.02 | 0.59 | 0.02 |
| formal, out of persona | 0.04 | 0.05 | 0.96 |
Threshold 0.5 per question separates all cases.

## Requirements

### Jev client
- `src/lib/jev/client.ts`: minimal typed client for `POST https://api.typesafe.ai/v1/systemone` (model `jev-latest`), Bearer `process.env.TYPESAFE_API_KEY`. Supports `noul` questions (returns probability). Timeout 8s via AbortController. Returns `null` (never throws to callers) when the key is unset, on timeout, non-2xx, or malformed response. No new dependency (use fetch).
- `isJevEnabled()` = key present.
- Never log the key. Log each Jev call to `LlmCallLog` with `provider: "typesafe"`, `model: "jev-latest"`, `agentRole: "interview_turn_gate"`, request = state+questions, parsedResponse = answers, error string on failure. Check the LlmCallLog `provider` column type first; if it is an enum that lacks typesafe, add a value via an additive migration, otherwise just write the string.

### Gate (in `nextInterviewTurn`, `src/lib/self-model/interview.ts`)
- After the LLM returns a candidate turn, if Jev is enabled, ask Jev in ONE request with state `{ interview_language, interviewer_persona (name + description if any), goal, transcript (last 12 turns, speaker interviewer/user), candidate_next_interviewer_message, planned_purposes (unmet ones, with index) }` and questions:
  - `responds`, `in_character`, `not_repeat`: exact instructions from the probe script (see Probe; copy wording into a prompt module `src/lib/jev/interview-gate.ts`).
  - `covered_<i>` for each UNMET planned purpose i: "Has the transcript plus `candidate_next_interviewer_message` already elicited the user's behaviour for planned purpose <purpose text>?" (noul).
- Pure helper `evaluateGate(answers, threshold=0.5)` → `{ pass, failed: ("responds"|"in_character"|"not_repeat")[], minScore }` (unit-tested).
- If fail: regenerate ONCE with an extra system/user note naming what failed in plain words (e.g. "Your previous draft ignored what the user just said. Respond to it first." / "Write in <language> and in this persona's casual voice." / "Do not repeat a question already asked."), then gate again. Keep whichever candidate has the higher `minScore`. Never more than 2 LLM + 2 Jev calls per turn.
- Store on the agent `TranscriptTurn` an optional `quality: { responds, in_character, not_repeat, regenerated: boolean }` (numbers rounded to 2 decimals). Old turns without it stay valid.
- Coverage: a planned purpose counts as covered if its `covered_<i>` ≥ 0.7 OR the LLM's `covers_planned_index` named it. `done` = LLM `should_end` OR all planned purposes covered (when a plan exists). Track covered indexes in the transcript (add `coveredIndexes?: number[]` on the agent turn) so `coveredPlannedIndexes` includes them; update its tests.
- If Jev is disabled or returns null: behave exactly as today (no regeneration, no quality field).

### UI
- Agent bubbles with `quality` show nothing by default. In the "Interview plan" collapsible, show covered purposes with a check mark using the combined coverage. No other UI change.

### Config
- `.env.example` (if present) documents `TYPESAFE_API_KEY` as optional.

### Tests
- `evaluateGate` thresholds and minScore.
- Request builder: includes last user message, candidate, only unmet purposes, trims to last 12 turns.
- Jev client: returns null when key missing; parses noul answers (mock fetch).

## Acceptance
lint, tsc --noEmit, vitest, build pass. No behaviour change when `TYPESAFE_API_KEY` is unset.
