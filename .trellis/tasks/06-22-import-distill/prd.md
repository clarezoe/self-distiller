# Import + Self Model v0.1

> Phase 2 of Self Distiller. Stub — refine via brainstorm when Foundation is done.

Parent: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md). Product spec: `docs/self_distiller_prd_en.md` §6.1, §9.1, §13.1, §19.1.

## Goal
Import historical text materials, classify + extract evidence, generate Self Model v0.1, export Markdown.

## Requirements (high-level, to refine)
- Import UI: paste text / upload `.txt` `.md`; pick source_type, language, contexts (PRD §10.3, §19.1).
- Import Analyzer agent (§13.1): classify, extract ≥3 evidence items, propose voice signals; preserve raw text; weight by source (§15.2) + time decay (§15.3).
- Evidence review: user accepts/rejects individual items.
- Generate Self Model v0.1 (§12 schema) from accepted evidence; immutable version.
- Markdown export of Self Model.

## Acceptance Criteria (to refine)
- [ ] Import ≥10 materials; raw saved.
- [ ] ≥3 evidence items per material; user can reject.
- [ ] Self Model v0.1 generated, traceable to evidence.
- [ ] Markdown export works.

## Depends on
Foundation (schema, auth, `lib/llm`, contexts).
