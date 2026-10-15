# Mobile settings overflow and tab label fix

## Problem (user iPhone screenshot, 2026-10-15, after PR #16 shipped)

1. Settings page scrolls horizontally on iPhone. Left edge of content is cut off
   ("Distiller", "Default provider & model" clipped). Cause: credential row
   `src/app/(app)/settings/page.tsx:164` is `flex items-center gap-2` with no wrap;
   long base URL (`https://swedeapi.feifeiecom.com/v1`) plus "key stored (encrypted)"
   pushes the row wider than the viewport, so the whole page widens.
2. Bottom tab bar: primary tab label "Interview Studio" wraps to two lines and looks cramped.

## Requirements

- No page in `src/app/(app)` can scroll horizontally at 320px width because of long text.
  - Credential row: wrap, and let the base URL break (`min-w-0 break-all` or equivalent).
  - Check the similar `flex items-center gap-2` list rows (tasks, calibration, interview,
    import, contexts, invites in settings) and apply the same fix where long user text can appear.
  - Invite form (`flex gap-2` input + button) must fit at 320px.
- Mobile bottom tab uses a short label: en "Interview", zh "访谈". Add a new message key
  (e.g. `nav.interviewShort`); desktop sidebar keeps "Interview Studio" / "访谈工作室".
- Tab labels must stay on one line (`whitespace-nowrap`, truncate if needed).
- Desktop layout unchanged.

## Acceptance

- lint, typecheck, tests, build pass.
- Add/extend a test if a cheap one fits (e.g. messages en/zh both have the new key).
