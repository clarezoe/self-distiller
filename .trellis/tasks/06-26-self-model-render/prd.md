# Self Model page: robust render of open-ended JSON

GitHub-worthy bug, found live: `/self-model` crashes — `Objects are not valid as a React child (found: object with keys {type, examples, evidence_ids})`. Root cause: the Self Model JSON is intentionally open-ended (PRD §23.8 dynamic keys; generated with `strict:false`), so the LLM emits nested objects/arrays where `src/app/(app)/self-model/page.tsx` assumed flat strings (`<Field value={lm.voice_summary}>`, `<List items={lm.tone_patterns}>`). Real generated model has `register: {...}`, `voice_features: [{feature, examples, evidence_ids}]`, etc. → React renders an object child → 500.

## Goal
The Self Model page renders ANY shape of the §12 JSON without crashing, staying readable. Keep the existing section structure (Core Self, Language/Role/Relationship/Scene, Boundaries) but render each section's values tolerantly.

## Build
- Add a **tolerant recursive JSON renderer** (a small client/server component, e.g. `src/app/(app)/self-model/json-view.tsx` or `src/components/json-view.tsx`):
  - string/number/boolean → text.
  - array → list; array of objects → nested blocks.
  - object → labeled key/value blocks (keys humanized: snake_case → "Snake case"). Recurse.
  - Special-case `evidence_ids: string[]` → render as evidence links (reuse the existing `EvidenceLinks`/evidence map the page already builds), not raw ids.
  - Hide empty values (null, "", [], {}).
- Rewrite `self-model/page.tsx` to feed each top-level section (core_self, language_models, role_models, relationship_models, scene_models, current_state, boundaries, unknowns) through the renderer instead of hardcoded `<Field>`/`<List>` accessors. Keep the version header + Markdown/JSON export buttons.
- Keep `src/lib/self-model/schema.ts` types permissive enough to not fight the renderer (the renderer works off `unknown`/JSON, not the strict TS interfaces). Don't force the LLM output into the narrow interfaces.
- Markdown export (`toMarkdown`) — verify it also doesn't assume flat strings; if it would render `[object Object]`, make it recurse too (or at least not break). Add/adjust a unit test.

## Acceptance Criteria
- [ ] `/self-model` renders the real generated model (with nested `register`, `voice_features`, etc.) without error; evidence_ids show as links.
- [ ] Empty sections still show "nothing yet" gracefully.
- [ ] Markdown + JSON export still work (JSON = raw; Markdown = readable, no `[object Object]`).
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green; renderer + toMarkdown nested-shape unit-tested.

## Out of scope / notes
- Don't constrain the generator's schema to fix this (the openness is intentional §23.8). Fix is render-side.
- No styling overhaul — just correct + readable.
- Auth/ownership unchanged.
