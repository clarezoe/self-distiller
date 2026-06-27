# Named reusable interviewer personas (#8 v1)

Deliver the buildable core of GitHub #8 (multi-persona interviewer): let the user define **named, described, reusable interviewer personas** — the specific people in their life (blunt cofounder, gentle parent, demanding customer) — and run interviews in that voice. Different personas draw out different facets → richer self-model.

**In scope (this task):** user-authored named personas, stored + reusable, their description threads into the interview planner as the interviewer's voice.
**OUT of scope (separate future epic):** auto-distilling a real person's voice from imported materials (the issue's "advanced" part — needs its own design + consent model). Split to a new issue at the end.

## Current state (already works — build ON it)
- `Interview.interviewerPersona String` (free text). UI: free-text input + `PERSONA_SUGGESTIONS` datalist (`interview-client.tsx`).
- Planner (`src/lib/prompts/interview-planner.ts`) already threads `Interviewer persona: ${input.interviewerPersona}` and instructs "the interviewer ADOPTS the given persona and stays in character". So a persona NAME already shapes the voice; this task adds rich, reusable, described personas.

## Build

### Schema (migration — additive; MUST be applied to cloud by hand after deploy, see deploy/README)
- `InterviewerPersona { id, projectId, name, description String, relationship String?, createdAt }` (+ `@@index([projectId])`, `@@unique([projectId, name])`). projectId-scoped → per-user isolated (consistent with all domain tables).

### Service `src/lib/services/interviewer-personas.ts`
- `listPersonas(projectId)`, `createPersona(projectId, {name, description, relationship?})`, `deletePersona(projectId, id)` — all scoped by projectId (verify the project belongs to the current user via the existing `getProjectForUser`/`getActiveProject` pattern; never cross-tenant).

### UI (interview page / interview-client)
- A "Saved personas" manager: list the project's personas; a small form to add one (name + description textarea + optional relationship tag); delete.
- The interviewer-persona selector: choosing a saved persona sets `interviewerPersona` to its NAME and passes its DESCRIPTION through to the start call. Free text still allowed (back-compat).
- i18n keys in `messages/{en,zh}.json`.

### Planner threading
- Extend the interview start path (`interviews.ts` createInterview + `planInterview`) to accept an optional `interviewerPersonaDescription`. When present, thread it into the planner prompt as the persona's voice/background (e.g. "Interviewer persona: {name} — {description}. Stay fully in character: match their tone, vocabulary, directness, and how they'd actually push the user."). Keep the existing behavior when only a name is given.
- Store the resolved persona name on `Interview.interviewerPersona` as today (no schema change there).

## Acceptance Criteria
- [ ] User can create/list/delete named personas (name + description + optional relationship), per-project isolated.
- [ ] Starting an interview with a saved persona threads its DESCRIPTION into the planner; the generated turns are in that persona's voice.
- [ ] Free-text persona still works (back-compat); existing interviews unaffected.
- [ ] A persona from project A is never visible/usable in project B / another user.
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green; service ownership-scoping covered by a test where feasible.

## Invariants / notes
- Tenant isolation: personas scoped by projectId → user; no cross-tenant read/write.
- Migration additive; apply to cloud manually post-deploy (Dokploy doesn't auto-migrate — see deploy/README).
- Don't break the existing free-text persona flow or the planner's current persona adoption.
- Keep it simple: no auto-distillation, no LLM call to "generate" a persona — the user authors the description.
