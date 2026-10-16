# Chat Relationship Context

## 1. Scope / Trigger

Google Chat import carries conversation-specific partner identity and user-assigned relationship contexts through materials, evidence, and Self Model generation. Changes to this cross-layer contract require regression tests. No database migration is required: use existing `sourceMetadata` and `contextIds` fields.

## 2. Signatures

- `commitGoogleChatImport(userId, projectId, parsed, ownerKey, assignments = [])`
- `ConversationAssignment = { conversationIndex: number; contextIds?: string[]; newRelationshipName?: string }`
- `setMaterialContexts(projectId, materialIds, contextIds): Promise<{ updated: number }>`
- `PATCH /api/materials/:id` accepts `{ contextIds: string[] }`.
- `PATCH /api/materials` accepts `{ projectId: string, materialIds: string[], contextIds: string[] }`.
- `DELETE /api/materials/:id` deletes the owned material and its associated evidence.

## 3. Contracts

Each uploaded conversation may include `groupInfo`, the text of its sibling `group_info.json`. Pair folder uploads using their relative directory, never a global metadata file shared by unrelated conversations.

Each parsed conversation contains its own `participantKeys` and optional `title`. Resolve partner names from those keys, excluding `ownerKey`. Do not attach the full export's participant list to every material.

Each imported chunk stores `sourceMetadata` containing `source`, `spaceName`, `title`, `partners: [{ name, key }]`, `ownerKey`, `part`, `partsTotal`, and `dateRange`. Assign relationship IDs through `contextIds`. Only owner turns receive the `me:` label.

New relationship names are reused case-insensitively within the project. Context IDs must belong to the project and have type `relationship`.

Material relationship edits replace the selected context IDs and update associated evidence in the same transaction. Bulk updates affect only materials within the authorized project. Existing Self Model versions are not rewritten; a subsequent generation uses the updated evidence.

The analyzer receives resolved relationship names as `contextHint`. For `sourceMetadata.source === "google_chat_takeout"`, always supply an owner-only instruction, even when no relationship is selected. An empty relationship selection explicitly overrides stale relationship labels embedded in the content. Other participants' speech is context, not evidence of the owner's voice. Legacy plain-text materials without `me:` markers do not receive this structured-chat-only restriction. Old imports lacking partner identities cannot be reliably reconstructed automatically.

Reuse relationship choices only for the same owner and single partner in direct conversations. Group conversations have independent choices; editing a group must never overwrite a participant's direct-chat relationship.

## 4. Validation & Error Matrix

| Condition | Result |
| --- | --- |
| Unauthenticated material mutation | HTTP 401 |
| Invalid material mutation body | HTTP 400 |
| Material or project not owned by current user | HTTP 404 |
| Foreign or non-relationship context ID | Reject; material mutation returns HTTP 400 |
| Assignment index outside parsed conversations | `InvalidAssignmentError` |
| Unknown owner key | `UnknownOwnerError` |
| Bulk list includes foreign material IDs | Those IDs are not updated |
| Empty relationship list | Clear assigned contexts and synchronize evidence |

## 5. Good / Base / Bad Cases

- Good: two direct chats with distinct partners carry separate partner metadata and relationship assignments.
- Base: no relationship selected; partner metadata is still retained and the relationship remains unspecified.
- Bad: an assignment references another project's context; reject it before material writes.
- Bad: interpret another participant's sentences as the user's expression style.

## 6. Tests Required

- Parser: per-conversation participant keys, metadata title, and member identity enrichment.
- Partner helper: owner excluded; unrelated conversations' participants excluded.
- Commit: relationship IDs attached to every chunk, invalid assignments rejected, new names reused case-insensitively, partner metadata scoped per conversation.
- Material updates: both material and evidence writes are project-scoped and transactional; foreign context IDs rejected.
- Prompt: relationship hint included and owner-only style attribution explicit.
- UI: selecting a relationship must not silently overwrite a different partner's relationship; changing owner must not reuse an assignment for the wrong identity.
- i18n: English and Chinese keys remain aligned.

## 7. Wrong vs Correct

Wrong:

```ts
sourceMetadata: { participants: parsed.participants }
```

Correct: build partner metadata from the current conversation's participant keys, excluding the owner, and pass that conversation's validated relationship IDs separately.

Wrong: update only `RawMaterial.contextIds`.

Correct: update the material and its `EvidenceItem.contextIds` in one transaction so future Self Model generation sees the same relationship.
