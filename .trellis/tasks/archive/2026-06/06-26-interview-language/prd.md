# Explicit interview language (GitHub #7)

Problem: the language an interview is *conducted* in is uncontrolled → the distilled persona is inconsistent (a user's zh vs en style differ; uncontrolled language muddies the extracted self-model). Fix: make interview language an explicit, stored, prompt-threaded choice.

**Decouple from #1**: interview language is its OWN field, independent of UI locale (next-intl, the parallel session's work — do NOT touch it). UI may be zh while an interview is run in en.

## Build (reuse Phase 3 interview patterns)
- **Schema**: add `Interview.language String?` (e.g. "zh" | "en" | "sv" | free ISO-ish code). Migration (nullable — existing rows safe). Run on local dev; the cloud box DB also needs the column (nullable ALTER — handle at deploy).
- **Service** `src/lib/services/interviews.ts`: `createInterview` accepts `language?: string`, persists it.
- **Agents** `src/lib/self-model/interview.ts`:
  - `planInterview` — accept the interview language; pass into the planner prompt so ALL generated questions/turns are in that language, and the goal notes the language.
  - `extractInterview` — pass the language into the extractor prompt so language-specific patterns are tagged with it and the report records `language`.
- **Prompts** `src/lib/prompts/interview-planner.ts` + `interview-extractor.ts`: add a `language` input; planner instruction "Conduct the entire interview in {language}; write every question/turn in {language}." extractor "The interview was conducted in {language}; attribute language-specific patterns to it."
- **API** `POST /api/interviews`: accept + validate `language` (zod), thread to planInterview + createInterview.
- **UI** `src/app/(app)/interview/interview-client.tsx`: a language selector in the setup step. Options: derive from the project's `language`-type Contexts if any (so the user picks among languages they've defined), plus a sensible default; if none defined, a small built-in list (Chinese/English/Swedish) or free text. Pre-select the first language context. Show the chosen language in past-interview list rows.

## Acceptance Criteria
- [ ] User picks interview language at setup; it's stored on the Interview row.
- [ ] Planner generates questions in the chosen language (prompt enforces it).
- [ ] Extractor records/uses the language; language-specific patterns attributed correctly.
- [ ] Existing interviews (null language) still load/extract without error.
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green; prompt builders / any pure helper unit-tested.

## Invariants / out of scope
- Don't touch next-intl / UI i18n (#1, parallel session).
- Don't change the calibration/import flows.
- Auth + ownership unchanged; structured schema on runAgent unchanged.
- No need to backfill old interviews' language.
