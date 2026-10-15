# Dedicated personas management page

User (2026-10-16): "应该添加一个专门的管理 persona 的地方吧" — personas are managed inside a collapsible block on the interview page, mixed with interview setup. Wants a dedicated place.

## Current state
- `src/app/(app)/interview/interview-client.tsx` (951 lines) contains `PersonaManager` (~line 646) and `VoiceControls` (~line 764): create (name, relationship, description), delete, distill voice (add / re-distill / clear, evidence level).
- API: `GET/POST /api/interviewer-personas`, `DELETE /api/interviewer-personas/[id]`, `POST/DELETE /api/interviewer-personas/[id]/distill`. No edit (update) endpoint.
- Nav: `SECTIONS` in `src/app/(app)/layout.tsx`; mobile tabs Interview (primary), Dashboard, Self Model, Tasks; rest in More sheet.

## Requirements

### New page `/personas`
- Route `src/app/(app)/personas/page.tsx` (server, active project like interview page; same "create project first" empty state) + client component(s) in that folder.
- Move `PersonaManager` and `VoiceControls` out of interview-client.tsx into the personas folder (or `src/components/personas/`), do not duplicate.
- Page layout: header (title + one-line subtitle explaining personas are people the interviewer can role-play, and voice distillation from their messages); "New persona" form; list of persona cards. Each card: name, relationship, description, voice status (distilled date + evidence level or "not distilled"), actions: Edit, Distill/Add messages/Re-distill/Clear (existing VoiceControls), Delete (with confirm), and "Start interview with this persona" linking to `/interview?persona=<id>`.
- Edit: add `PATCH /api/interviewer-personas/[id]` with `{ projectId, name?, description?, relationship? }`, validated by existing `normalizePersonaInput` rules (merge with current values), scoped by projectId (IDOR-safe, `updateMany where {id, projectId}`), unique-name conflict returns 409 with a clear message. Service function `updatePersona(projectId, id, input)` with unit tests for the pure merge/validation part.
- Empty state when no personas: short explanation + the create form.

### Interview page
- Remove the inline PersonaManager block. Keep the persona select (saved personas + custom free text + suggestion chips). Next to it a link "Manage personas" -> `/personas`.
- Support `?persona=<id>` query param: preselect that saved persona if it exists in the project's list (read via `searchParams` in the server page and pass as initial prop; check `node_modules/next/dist/docs` for the current page `searchParams` API, it is a Promise in recent Next).
- If no saved personas, show a hint linking to `/personas`.

### Navigation
- Add `/personas` to `SECTIONS` in layout, after interview, key `personas`. Desktop sidebar shows it. Mobile: put it in the More sheet (do not change bottom tabs).
- i18n en/zh: nav label ("Personas" / "人物"), page strings; extend `src/lib/messages.test.ts`.

### Constraints
- Mobile ergonomics as elsewhere (16px inputs, >=44px controls, no horizontal overflow at 320px, long text breaks).
- No DB migration needed.
- Raw voice samples still never stored or logged (unchanged behaviour of distill).

## Acceptance
lint, tsc --noEmit, vitest, build pass. interview-client.tsx no longer contains PersonaManager/VoiceControls.
