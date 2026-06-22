# Blind Calibration

> Phase 4 of Self Distiller — the core training mechanism. Stub — refine via brainstorm when Phase 3 is done.

Parent: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md). Product spec: `docs/self_distiller_prd_en.md` §4.4, §6.4, §9.3, §13.4, §14.1-14.2, §19.3.

## Goal
Agent predicts a hidden reply; user writes their real reply; system compares, proposes a model update, versions on approval. Round-2 likeness must beat round-1.

## Requirements (high-level, to refine)
- Create calibration: pick context combination; system generates scenario (§18.7).
- Hidden-answer generation (§14.1): **never shown before user submits** (§23.9 invariant).
- User-answer capture (§18.8); reveal both side by side.
- Comparator agent (§13.4, §14.2): difference report across 10 dimensions; update proposal; classify temp-state vs context/pattern vs core (§15.1) — core needs multiple evidence.
- User accept / partial / reject / edit → new immutable Self Model version (§9.3).

## Acceptance Criteria (to refine)
- [ ] Hidden answer hidden until submission.
- [ ] Difference report + update proposal generated.
- [ ] Version updates on approval; rollback available.
- [ ] After 5 calibrations, round-2 likeness ≥ +1 vs round-1 (§20.3).

## Depends on
Foundation; Self Model (Phase 2); ideally interview data (Phase 3).
