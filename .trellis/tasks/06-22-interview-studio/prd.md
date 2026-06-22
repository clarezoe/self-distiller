# Interview Studio (Phase 3)

Parent: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md). Product spec: `docs/self_distiller_prd_en.md` §6.2, §9.2, §13.2, §13.3, §14.3, §15.1, §19.2.
Foundation + Phase 2 are done & committed. Reuse their patterns and libs. Follow `.trellis/spec/` exactly.

## Goal
Run role-based interviews that actively sample the user; capture content AND interaction behavior; produce an extraction report + update proposal; on approval, create a new immutable Self Model version.

## Build (reuse `runAgent`, services pattern, server actions + `SubmitButton`, `src/lib/self-model/*`)

### Prompts (`src/lib/prompts/`)
- `interview-planner.ts` (§13.2): input current self model subset + target context + unknowns + previous interviews → `{ goal, interviewer_persona, turns: [5-10 questions/simulated messages], expected_signals }`. Every interview has a concrete sampling goal; elicit behavior, not abstract self-description; persona may role-play (subordinate, close friend, etc.).
- `interview-extractor.ts` (§13.3, §14.3): input transcript + goal + persona + target context → explicit facts, preferences, tone patterns, reaction patterns, correction behavior (high-value), role/relationship/language-specific behavior, evidence quotes, confidence, AND an `update_proposal` classified per §15.1 (temporary state / context / language / relationship / core — core needs multiple evidence). Extract BOTH what was said and how.

### Self Model apply (`src/lib/self-model/apply.ts`) — shared with Phase 4
- `applyProposal(currentModelJson, proposal) → newModelJson`: deterministically merge proposal paths into the §12 JSON (e.g. `affected_paths` + values). Do not blow away unrelated sections. Pure function — unit-test it.
- Reuse `createVersion` (Phase 2) to persist the merged model as a new immutable version + `ModelUpdate` (sourceType `interview`, sourceId = interview id, userApproved=true).

### Service (`src/lib/services/interviews.ts`)
- `createInterview` (with plan), `getInterviewForUser` (ownership via project), `appendTurn` (push `{speaker,text,timestamp}` to `transcript` Json), `setExtractionReport`, `listInterviews`.

### Agents
- `planInterview(userId, projectId, {type, persona, targetContextIds, goal?})` → `runAgent({agentRole:"interview_planner", schema})`.
- `extractInterview(userId, projectId, interviewId)` → `runAgent({agentRole:"interview_extractor", schema})` → store report + proposal on the Interview row.

### API (PRD §18.5/§18.6)
- `POST /api/interviews` (create + plan), `POST /api/interviews/[id]/turn` (append a user/agent turn), `POST /api/interviews/[id]/extract` (→ report + proposal), `POST /api/interviews/[id]/apply` (approve proposal → new Self Model version via apply.ts + createVersion).

### UI (`(app)/interview`, replace stub) — §19.2
- Select interview type (7 types §9.2), interviewer persona, target context(s); Start → planner generates goal + turns.
- Chat surface: shows agent turn, user types reply, appends to transcript (turn-based; the plan's turns drive the agent side; allow free continuation).
- End interview → Extract → show extraction report + proposed update; user accepts (→ apply, new version) or rejects.

## Acceptance Criteria (§19.2)
- [ ] System generates interview questions from the goal; full transcript saved.
- [ ] Extraction report includes explicit info AND interaction behavior (tone/correction/etc.).
- [ ] Update proposal generated; on approval a new immutable Self Model version is created (traceable via ModelUpdate, sourceType=interview).
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green. Unit-test `applyProposal` (merge correctness, no collateral wipe).

## Invariants
Proposals only; immutable versions on approval; auth + ownership on every route/action; structured `schema` on every runAgent; secrets server-side.

## Out of scope
Blind calibration, output generation (later). Live-LLM quality validated separately (no API key here).
