# Interview follow-up turns use conversation context

User (2026-10-16): "Interview 的话好奇怪，牛头不对马嘴的，interview没有上下文的吗"

## Root cause (verified in code)
- `POST /api/interviews` runs the planner once and returns 5-10 `plannedTurns`; only turn 0 is stored in the transcript. The plan itself is NOT persisted (only returned to the client).
- `interview-client.tsx` `sendReply()` (~line 204) appends the user reply, then appends `plannedTurns[n+1].text` verbatim via `POST /api/interviews/[id]/turn`. No LLM sees the user's reply. Every follow-up ignores what the user said.
- A page reload loses `plannedTurns` (client state only).

## Requirements

### Persist the plan
- Add `plan Json?` to `Interview` (stores `{ turns: [{text, purpose}], expected_signals, interviewer_persona }` as returned by the planner) and `voiceProfile`-independent persona context needed to continue: `interviewerPersonaDescription String?`, `interviewerPersonaId String?` (no FK needed; look up voice profile scoped by projectId at turn time).
- Additive migration `prisma/migrations/<timestamp after 20261015130000>_interview_plan_context` (nullable columns only). Old interviews (plan null) must still work: fall back to generating the next turn from transcript + goal only.

### Contextual next turn (server)
- New prompt `src/lib/prompts/interview-turn.ts`: input = goal, type, persona name + description + optional voice profile, language, target contexts, expected signals, the planned turns as a GUIDE (with which ones are already covered), and the full transcript so far. Output structured JSON `{ text, purpose, covers_planned_index: number | null, should_end: boolean }`.
  - Rules: respond to what the user ACTUALLY said in their last message first (acknowledge, react, or follow up in character), then steer toward the next unmet sampling purpose. Natural conversation, one message, short like a real chat message from this persona. Stay in persona voice and in the interview language. Never repeat a question already asked. If the user asked the interviewer something, answer briefly in character before continuing. If the user corrected the interviewer, accept it. `should_end` true when the planned purposes are covered or after ~12 agent turns; then `text` is a natural closing line.
- Service `nextInterviewTurn(userId, projectId, interviewId)` in `src/lib/self-model/interview.ts`: load interview (scoped), transcript, plan, persona voice profile (scoped by projectId), run agent (`agentRole` e.g. `interview_turn`, add to llm types), append agent turn, return `{ transcript, done: should_end }`.
- New route `POST /api/interviews/[id]/reply` with `{ text }`: auth + ownership (same as turn route), append user turn, call `nextInterviewTurn`, return `{ transcript, done }`. If the LLM fails, the user turn must already be saved; return 502 with error so client can show "retry" which calls `POST /api/interviews/[id]/next` (generate next agent turn only, no user append). Implement `/next` too.
- `POST /api/interviews` start: persist plan + persona description + persona id on create. Keep returning plannedTurns for compatibility but client should not depend on them for advancing.

### Client (`src/app/(app)/interview/interview-client.tsx`)
- `sendReply` calls `/reply` instead of appending planned turns. Show the user's message immediately (optimistic), then a typing indicator (persona name + "…") while waiting. On error show message + Retry button (calls `/next`).
- When `done` is true, show a hint that the interview reached its goal and the user can Extract (existing button), still allow more replies.
- Remove `nextPlanned` / planned-turn advancing logic. Planned turns may still be shown as a collapsible "Interview plan" for transparency (optional).
- i18n en/zh for new strings; extend `src/lib/messages.test.ts`.

### Tests
- Prompt builder: includes last user message, transcript, persona voice block when present, language rule; marks covered planned turns.
- Pure helper that decides which planned turns are covered (from stored `covers_planned_index` values if you store them per agent turn in the transcript, e.g. optional `plannedIndex` on TranscriptTurn) — keep it simple and tested.

## Acceptance
lint, tsc --noEmit, vitest, build pass. Migration hand-written, additive; `prisma validate` + `prisma generate` pass.
