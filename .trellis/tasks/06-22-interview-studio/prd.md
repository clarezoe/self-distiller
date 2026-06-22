# Interview Studio

> Phase 3 of Self Distiller. Stub — refine via brainstorm when Phase 2 is done.

Parent: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md). Product spec: `docs/self_distiller_prd_en.md` §6.2, §9.2, §13.2-13.3, §14.3, §19.2.

## Goal
Run role-based interviews that actively sample the user; extract content + interaction behavior; propose model updates.

## Requirements (high-level, to refine)
- Select interview type, interviewer persona, target context (§9.2 lists 7 types, persona list §6.2).
- Interview Planner agent (§13.2): goal + persona + 5-10 turns + expected signals.
- Interview chat UI; save full transcript.
- Interview Extractor agent (§13.3, §14.3): extract explicit info AND how the user said it; correction behavior = high-value signal.
- Update proposal → user approve → new Self Model version.

## Acceptance Criteria (to refine)
- [ ] Generates questions from goal; saves transcript.
- [ ] Extraction report has content + interaction behavior.
- [ ] Update proposal; on approval, new version created.

## Depends on
Foundation; Self Model v0.1 (Phase 2) for planner context.
