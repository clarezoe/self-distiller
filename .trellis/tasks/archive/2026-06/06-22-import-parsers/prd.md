# Chat export import parser — Google Chat Takeout

Parent: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md). Builds on the committed MVP (Import + materials). Product spec ties: §6.1, §10.3, §13.1, §15.2, V1 "manual import of chat records".

## Goal
Let the user drop a Google Chat **Takeout** export into the app and have it auto-split into `RawMaterial` rows (instead of manual copy-paste), tagged + weighted for distillation.

## Context / constraints
- **ChatGPT dropped**: user is on ChatGPT Business — self-serve export is admin-locked, no `conversations.json`. (If ever needed: admin Compliance API — out of scope.)
- Google Chat Takeout is exporting now (slow). Documented layout (to verify against the real export):
  `Takeout/Google Chat/Groups/<space>/messages.json` (+ `group_info.json`), `Users/`, etc. Each `messages.json` ≈ `{ messages: [{ creator: {name, email, user_type}, created_date, text, ... }] }`.
- Current Import accepts paste + `.txt`/`.md` only → needs JSON file handling.

## Decisions (resolved)
- **Timing = build now**, best-effort to the documented Takeout format; tolerant parser; calibrate against the real export when it lands.
- **Granularity = 1 conversation/space → 1 RawMaterial**; the user's own messages are the primary style signal; other participants' lines kept as labeled context but NOT treated as the user's style (§15.2). `source_type = chat`.
- **Identity = parse-then-pick**: parse lists all participants; UI lets the user mark which participant is "me" (pre-select a best guess, e.g. most frequent / matching the owner). Materials are generated only after the user confirms identity. No Google name/email supplied up front → rely on the picker.

## Requirements
- **Pure parser** `src/lib/import/google-chat.ts`: tolerant of Takeout field/layout variation. Input = one or more `messages.json` contents → output = `{ participants: [{name,email,count}], conversations: [{ spaceName?, dateRange, turns: [{ sender, isOwner, text, ts }] }] }`. Pure + unit-tested with a fixture built from the documented format.
- **Parse-then-pick flow** (2 step): client uploads `.json` file(s) → reads text → POST to a parse endpoint → returns participants + conversation preview (NO materials yet) → user marks which participant is "me" → POST confirm → create one `RawMaterial` per conversation.
- Material content: turns labeled `me:` / `<other-name>:`; the user's own lines are the style signal. `source_type = chat`; `source_metadata` = { source: "google_chat_takeout", spaceName, participants, dateRange }. `language` optional.
- Reuse existing `materials` service to persist; then the normal Analyze → evidence flow applies.
- Small framework (`src/lib/import/`) so a future importer (other platforms) can slot in.
- Note file-size: large exports POSTed as JSON — acceptable for MVP; log/guard absurd sizes.

## Acceptance Criteria
- [ ] Upload a Google Chat Takeout `messages.json` → participants listed; after picking "me", ≥1 RawMaterial created with user vs others correctly separated/labeled.
- [ ] Only the user's lines are treated as their style (others labeled as context).
- [ ] Created materials round-trip into the existing Analyze flow (source_type=chat).
- [ ] typecheck/lint/build/test green; parser unit-tested with a representative fixture (incl. a multi-party space + an owner-detection case).

## Out of scope
ChatGPT import (can't export), live API connectors (V2), .zip auto-unpack if it adds much (start with the JSON files).
