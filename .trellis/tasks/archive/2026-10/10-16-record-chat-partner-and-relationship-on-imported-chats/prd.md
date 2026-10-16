# Record chat partner and relationship on imported chats

User (2026-10-16): "导入的 Google Chat 聊天记录没有把我的聊天对象记录下来。比如说，我跟好朋友的聊天记录、跟我老公的聊天记录，还有跟其他人的聊天记录，我说话的方式是不一样的呀。"

## Verified facts
- Production: 96 RawMaterials, all `contextIds = []`. 94 have `sourceMetadata` = only `{part, partsTotal}` (plain-text chunked import), 2 are `{}`. None contain `me:` lines, none store participants. The partner of each existing chat cannot be recovered from stored data.
- Google Chat import path (`src/app/(app)/import/google-chat-client.tsx`, `src/lib/import/google-chat.ts`, `src/lib/services/import-google-chat.ts`):
  - Client accepts individual `.json` files only and uses the FILE NAME as `spaceName`. Takeout names every file `messages.json`, so every conversation is labelled "messages".
  - `group_info.json` (Takeout: `Google Chat/Groups/<DM_xxx|Space_xxx>/group_info.json` with `members: [{name, email}]` and optional `name`) is ignored.
  - Participants are aggregated across ALL files; per-conversation partner is not stored. `sourceMetadata.participants` is the global list.
  - Materials are created with no `contextIds`.
- Downstream already supports relationship contexts: `Context` (type `relationship`, e.g. production has "Close friend"), `RawMaterial.contextIds` → `EvidenceItem.contextIds` at analyze time → `contextNames` in the Self Model generator prompt → `relationship_models` in the Self Model. Only the import never sets it.

## Requirements

### 1. Parse per-conversation partners
- Client: accept a whole Takeout folder (`<input webkitdirectory>` in addition to multi-file). For each `messages.json`, use the parent folder name (from `webkitRelativePath`) as `spaceName`, and pair it with the sibling `group_info.json` if present (send its content alongside, e.g. `groupInfo` string on the file input). Keep accepting loose `.json` files.
- Parser: `ParsedConversation` gains `participantKeys: string[]` (keys of everyone who spoke) and `title?: string` (group_info `name` if any). Use group_info members to fill names/emails when messages lack them.
- Pure helper `conversationPartners(conversation, ownerKey, participants)` → partner display names (everyone except owner). Unit-tested.

### 2. Assign relationship per conversation at import
- After parse + owner selection, the preview lists each conversation with: partner name(s) (fallback: title/spaceName), message count, date range, and a relationship picker:
  - existing `relationship` contexts of the project, plus "+ New relationship…" (inline text, creates a Context of type relationship on commit, e.g. "Husband", "Close friend", "Colleague"), plus "Not set".
  - Default: "Not set". Reuse a choice only across one-to-one conversations with the same owner and single partner. Group conversations keep independent choices, and changing the owner must not reuse another owner's assignments.
- Commit sends `assignments: [{ conversationIndex, contextIds?: string[], newRelationshipName?: string }]`. Server validates context ids belong to the project, creates new relationship contexts (dedupe by case-insensitive name), and sets `contextIds` on every chunk of that conversation.
- `sourceMetadata` per chunk stores `spaceName`, `title`, `partners: [{name, key}]` for THAT conversation (not the global list), `ownerKey`, part info.
- Chunk content: label the owner as `me:` (unchanged) and label others by name (unchanged). Add a first line `# Chat with <partners> (<relationship names>)` so the analyzer sees who the partner is.

### 3. Analyzer uses the relationship
- `analyzeMaterial` (src/lib/self-model/generate.ts): resolve material contextIds to names and pass `contextHint` (already supported by `buildImportAnalyzerMessages`) like "Relationship: Husband". Prompt instruction: describe how the user (`me:` lines) talks IN THIS RELATIONSHIP; only `me:` lines are the user's style.

### 4. Fix existing materials (no partner data)
- Materials page (`/import` list of materials): allow setting relationship contexts on an existing material and in bulk (select several → set relationship). New `PATCH /api/materials/[id]` (or bulk endpoint) with `contextIds`, scoped by project. When a material's contexts change, also update `contextIds` on its EvidenceItems (scoped) so the next Self Model generation uses them.
- Show each material's relationship as a badge in the list.
- UI copy on the import page explaining that old imports have no partner info and suggesting re-importing the Takeout folder (new chunks have different content and will not be deduped against old ones; provide a "delete material" action if one doesn't already exist, scoped, with confirm).

### Constraints
- Owner's lines remain the only style signal.
- Mobile ergonomics (16px inputs, ≥44px controls, no horizontal overflow; long names wrap).
- en/zh i18n, extend `src/lib/messages.test.ts`.
- No DB migration expected (contextIds and sourceMetadata already exist). If one becomes necessary, write it by hand, additive only, and say so.

### Tests
- Parser: group_info pairing, participantKeys per conversation, title.
- `conversationPartners`.
- Commit service: assignments → contextIds per chunk; invalid context id rejected; new relationship created once and reused; per-conversation partners in metadata.
- Analyzer receives contextHint.
- Evidence contextIds follow material update.

## Acceptance
lint, tsc --noEmit, vitest, build pass.
