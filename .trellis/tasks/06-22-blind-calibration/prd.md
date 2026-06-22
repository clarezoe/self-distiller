# Blind Calibration (Phase 4)

Parent: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md). Product spec: `docs/self_distiller_prd_en.md` §4.4, §6.4, §9.3, §13.4, §14.1, §14.2, §15.1, §18.7, §18.8, §19.3.
Foundation + Phases 2-3 are done & committed. Reuse `runAgent`, `src/lib/self-model/{apply,version}.ts`, services + UI patterns. Follow `.trellis/spec/`.

## Goal
Agent predicts a hidden reply; user writes their real reply; system reveals both, produces a difference report + update proposal; on approval, a new immutable Self Model version. Round-2 likeness should beat round-1.

## CRITICAL INVARIANT (PRD §23.9)
`BlindCalibration.hiddenAgentAnswer` must **NEVER** appear in any client-facing response (page props, JSON, server-action return) **before** `userAnswer` is submitted. Enforce in the service layer: list/get selectors used by the client MUST omit `hiddenAgentAnswer` while `userAnswer` is null. Add a unit test for the redaction helper.

## Build (reuse existing patterns)

### Prompts (`src/lib/prompts/`)
- `blind-hidden-answer.ts` (§14.1): predict how the USER would actually reply in the selected context — not an ideal assistant answer, do not over-polish; use only the selected Self Model subset; respect language/role/relationship/scene/polish. Return only the predicted reply.
- `blind-comparator.ts` (§14.2/§13.4): compare hidden agent answer vs user answer across the 10 dimensions (intent, emotional tone, relationship distance, structure, length, directness, politeness, action, language quirks, omissions, boundaries). Do not judge which is better — identify how the agent mis-predicted. Return `{ summary, differences[], update_proposal, affected_paths, confidence, scope (one-off|context|long-term per §15.1) }`.

### Service (`src/lib/services/calibrations.ts`)
- `createCalibration(userId, projectId, {contextCombinationId?, scenario?, incomingMessage?})` — persists scenario + the generated `hiddenAgentAnswer`.
- `getCalibrationForUser` / `listCalibrations` — **client-safe selectors that omit `hiddenAgentAnswer` until `userAnswer` is set** (redaction helper `redactCalibration`).
- `submitUserAnswer(userId, projectId, id, userAnswer)` — sets userAnswer; only then may hidden be revealed.
- `setComparison` / `setDecision`.

### Self Model context subset
- Build the selected model subset from the chosen `ContextCombination` (language/role/relationship/scene keys) to feed both prompts.

### Agents
- `generateHiddenAnswer(...)` via `runAgent` (agentRole: reuse `output_generator`, or add `blind_hidden` to AGENT_ROLES) → store on the row, never return to client.
- `compareCalibration(...)` via `runAgent({agentRole:"blind_comparator", schema})` → difference report + proposal.

### API (PRD §18.7/§18.8)
- `POST /api/calibrations` (create; generate scenario if absent + hidden answer; response MUST NOT include hidden answer).
- `POST /api/calibrations/[id]/user-answer` (submit → comparison + proposal; now safe to reveal both).
- `POST /api/calibrations/[id]/apply` (decision accept/partial/edit → applyProposal + createVersion, sourceType `blind_calibration`; reject → just record decision).

### UI (`(app)/calibration`, replace stub) — §19.3
- Select context combination → generate scenario; hidden answer generated server-side and **not shown**.
- User types real answer → submit → reveal agent answer + user answer side by side + difference report + proposal.
- Accept / partially accept / edit / reject → on accept/edit, new Self Model version.

## Acceptance Criteria (§19.3, §20.3)
- [ ] Hidden answer is NOT visible (in any response/markup) before user submits — covered by a redaction unit test + service selectors.
- [ ] After submission, both answers + difference report + proposal are shown.
- [ ] Accept/edit creates a new immutable Self Model version (ModelUpdate sourceType=blind_calibration); reject records decision only.
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green. Unit-test the redaction helper + (reuse) applyProposal.

## Out of scope
Task output generation (Phase 5). Live-LLM quality validated separately (no API key here).
