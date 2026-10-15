# Interview language picker shows all options

User screenshot (2026-10-16): the interview language field shows "zh" and the dropdown only lists "zh"; other languages cannot be picked.

## Cause
`src/app/(app)/interview/interview-client.tsx` ~line 398 uses `<input list="interview-language-options">` + `<datalist>`. Browsers filter datalist options by the current input value, and the state is pre-filled with `languageOptions[0]` ("zh"), so only matching options show. Same pattern for the persona free-text input with `PERSONA_SUGGESTIONS` (shows only matches once text is typed).

## Requirements
- Interview language: replace the datalist with a `<select>` listing every option from `languageOptions` (project language contexts, else DEFAULT_LANGUAGES zh/en/sv/sr), with human-readable labels (e.g. "中文 (zh)", "English (en)", "Svenska (sv)", "Srpski (sr)"; unknown codes / context names shown as-is), plus a final "Other…" option that reveals a text input for a custom language. Value sent to the API is unchanged (the code or name string). Default stays the first option.
- Persona free-text input: keep free text, but make the suggestions discoverable regardless of typed text: render the suggestions as tappable chips (buttons) under the input that fill the field. Remove the datalist. Keep existing onPersonaTextChange behaviour (typing clears selected saved persona).
- i18n en/zh for any new labels ("Other…", custom language placeholder); extend `src/lib/messages.test.ts`.
- Mobile ergonomics: select and chips >=44px tap height, 16px text (inputCls already used).
- Pure helper for language labels with a unit test.

## Acceptance
lint, tsc --noEmit, vitest, build pass.
