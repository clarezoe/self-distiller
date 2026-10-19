# UI: edit language / role / scene context tags on materials

## Request (2026-10-20)
"让界面也能改语言角色场景标记" — the import page could only set relationship tags; the 28 agent-imported materials carry language/role/scene tags written directly to the DB.

## Found during work
`setMaterialContexts` replaced the whole `contextIds` array. Relabelling a relationship in the UI would have silently dropped the language/role/scene tags.

## Scope
- `setMaterialContexts(projectId, materialIds, contextIds, types = ["relationship"])` replaces only contexts of `types`; other types kept. Evidence synced in the same transaction.
- `PATCH /api/materials/:id` and `PATCH /api/materials` accept optional `types`.
- Materials list: all tags shown as chips; per-material select for each context type present in the project; bulk action picks type + value.
- en/zh i18n keys aligned. No DB migration.

## Acceptance
- Changing one type never removes tags of other types (unit tests).
- lint, tsc, vitest, build pass.
