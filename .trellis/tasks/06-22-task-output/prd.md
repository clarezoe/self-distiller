# Task Output

> Phase 5 of Self Distiller. Stub — refine via brainstorm when Phase 4 is done.

Parent: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md). Product spec: `docs/self_distiller_prd_en.md` §6.5, §9.4, §13.5-13.6, §18.10.

## Goal
Use the trained Self Model to draft real replies in the right context; capture feedback to evolve the model. Draft Mode only.

## Requirements (high-level, to refine)
- Task input + context selection (language/role/relationship/scene) (§9.4, §18.10).
- Persona Router (§13.5): select language/role/relationship/scene model + polish level + boundary warnings; manual selection if context unclear (MVP).
- Output Generator (§13.6): "what the user would say," not best-AI answer; polish levels; Swedish grammar control; **Draft Mode only** (§16.1).
- Sensitive-topic boundary checks → user takeover (§16.3).
- Feedback capture: likeness/usefulness scores + labels (§6.5) → update proposal.

## Acceptance Criteria (to refine)
- [ ] Generates draft using current Self Model + selected context.
- [ ] Feedback (sounds like me / not) captured; can save as training sample.
- [ ] Sensitive scenarios trigger boundary stop.

## Depends on
Foundation; trained Self Model (Phases 2-4).
