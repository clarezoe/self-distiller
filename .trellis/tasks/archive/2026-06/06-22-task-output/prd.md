# Task Output (Phase 5)

Parent: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md). Product spec: `docs/self_distiller_prd_en.md` §6.5, §9.4, §13.5, §13.6, §14, §16.1, §16.3, §18.10, §19 (output flow).
Foundation + Phases 2-4 are done & committed. Reuse `runAgent`, `src/lib/self-model/*` (esp. `context-subset.ts`), services + UI patterns. Follow `.trellis/spec/`.

## Goal
Use the trained Self Model to draft replies/copy in the right context. **Draft Mode only** (no auto-send). Capture feedback to evolve the model.

## Build (reuse existing patterns)

### Prompts (`src/lib/prompts/`)
- `persona-router.ts` (§13.5): given the task + selected context (+ self model), select language/role/relationship/scene model subset + polish level + boundary warnings. MVP: user selects context manually; the router validates + assembles the subset and flags sensitive cases. (Reuse `context-subset.ts` to assemble the subset from selected contexts.)
- `output-generator.ts` (§13.6/§14): produce what the USER would likely say in this context — NOT the best AI answer. Respect polish level (simulate vs polished); for non-native languages control grammar correction by polish level. Draft only.
- Sensitive-topic check (§16.3): classify whether the scenario hits a sensitive category (breakup/divorce, self-harm/harm, medical, legal, financial/large transactions, hiring/firing, sexual, violence, identity deception). If sensitive → return a boundary warning and require user takeover (do not present the draft as send-ready).

### Service (`src/lib/services/tasks.ts`)
- `generateTask(userId, projectId, { taskType, input, contextIds, mode })` — assemble subset, run boundary check, run output generator, persist a `TaskOutput` row, return draft + any boundary warning. Mode is always `draft` in MVP.
- `getTaskForUser` / `listTasks` (ownership via project).
- `recordFeedback(userId, projectId, id, { likeness_score?, usefulness_score?, comments?, labels? })` — store on `TaskOutput.feedback`. Optionally "save as training sample" → create a `RawMaterial` (source_type `task_feedback`) for future distillation.

### Agents
- `routePersona`, `generateOutput`, `checkSensitive` via `runAgent` (agentRoles `persona_router`, `output_generator`; sensitivity can reuse `persona_router` or a small dedicated call). Structured schema where output is structured; the draft itself can be plain text.

### API (PRD §18.10)
- `POST /api/tasks/generate` (body §18.10: project_id, task_type, input, context_ids, mode) → draft + boundary warning.
- `POST /api/tasks/[id]/feedback` → store feedback; optional save-as-training-sample.

### UI (`(app)/tasks`, replace stub) — output flow §9.4
- Task input (textarea) + task_type select + context selection (language/role/relationship/scene) + mode (draft, fixed) → Generate.
- Show draft. If a boundary warning fired, show a prominent "sensitive — please take over" notice instead of presenting it as ready to send.
- Feedback controls: "Sounds like me / Doesn't sound like me", likeness + usefulness (1-5), labels (too long/short/soft/harsh/too AI-like/wrong tone…), comments, "Save as training sample". (Mirror §6.5 labels.)

## Acceptance Criteria (§19 output flow)
- [ ] Generates a draft using the active Self Model + selected context; persists `TaskOutput`.
- [ ] Draft Mode only — never auto-sends; sensitive scenarios trigger a boundary/takeover notice (§16.3).
- [ ] Feedback (sounds-like-me/not, scores, labels) captured; "save as training sample" creates a `RawMaterial` (source_type task_feedback).
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green. Unit-test a pure helper (e.g. label normalization or subset assembly edge) where applicable.

## Out of scope
Auto-send / live proxy, multi-contact relationship models, automatic context detection (manual selection in MVP). Live-LLM quality validated separately (no API key here).
