# Import + Self Model v0.1 (Phase 2)

Parent: [`../06-22-self-distiller-mvp/prd.md`](../06-22-self-distiller-mvp/prd.md). Product spec: `docs/self_distiller_prd_en.md` §6.1, §9.1, §9.5, §12, §13.1, §14, §15, §19.1.
Foundation is done (auth, schema, `lib/llm` `runAgent`, services pattern). Follow `.trellis/spec/` conventions exactly.

## Goal
Import historical text materials → classify + extract evidence (LLM) → user accepts/rejects → generate **Self Model v0.1** (immutable, §12 JSON) → view + export Markdown.

## Build (follow Foundation patterns: services in `src/lib/services`, `runAgent` for LLM, server actions + `SubmitButton`, zod validation, auth+ownership checks)

### Prompts (`src/lib/prompts/`)
- `import-analyzer.ts` — PRD §13.1 + §14 spirit. Classify material; extract ≥3 evidence items (claim, evidence_text quote, signal_type, confidence 0-1, stability); apply evidence weighting (§15.2) and time decay (§15.3); do NOT treat AI-generated content as authentic style unless confirmed; preserve original quotes.
- `self-model-generator.ts` — synthesize accepted evidence → Self Model v0.1 (§12 schema): core_self, language_models, role_models, relationship_models, scene_models, current_state, boundaries, unknowns, plus suggested interviews.

### Self Model lib (`src/lib/self-model/`)
- `schema.ts` — TS types for the §12 JSON + a JSON Schema object for structured output.
- `generate.ts` — `generateInitialModel(userId, projectId, acceptedEvidence)` via `runAgent` (agentRole `import_analyzer` for analysis; add a generator call). Returns §12 JSON.
- `version.ts` — `createVersion(projectId, json, { sourceType, sourceId })`: in a transaction, archive the current active `SelfModel`, insert a new immutable row (version bump e.g. 0.1 → 0.2), record a `ModelUpdate` (userApproved=true since user triggered). Never mutate existing rows.
- `markdown.ts` — `toMarkdown(selfModel)` → readable Markdown (§10.6).

### Services
- `materials.ts` — `createMaterial`, `listMaterials`, `getMaterialForUser` (ownership via project). Never delete raw on analyze.
- `evidence.ts` — `createEvidenceItems`, `listEvidence`, accept/reject (a `status` is not in schema — track acceptance in the UI/selection; only accepted items feed generation). Persist all extracted items; generation consumes the user-selected subset.

### Analyzer agent
- `analyzeMaterial(userId, projectId, materialId)` → `runAgent({ agentRole: "import_analyzer", schema })` → persist ≥3 `EvidenceItem` rows linked to `rawMaterialId`.

### API (PRD §18)
- `POST /api/materials` (create; §18.3), `POST /api/materials/[id]/analyze` (§18.4 → evidence), `POST /api/self-model/generate` (accepted evidence → v0.1), `GET /api/self-model/export?format=markdown|json`.

### UI
- **Import page** (`(app)/import`): paste text or upload `.txt`/`.md`; select source_type (enum), language, related contexts; Analyze → list extracted evidence with per-item accept/reject (checkbox, default on); "Generate / update Self Model" from accepted → new version. Acceptance §19.1.
- **Self Model page** (`(app)/self-model`, replace stub): show active version's core self + language/role/relationship/scene models + boundaries + unknowns + evidence links; Markdown + JSON export buttons.

## Acceptance Criteria
- [ ] Can import (paste + .txt/.md upload) and persist `RawMaterial`; raw never discarded.
- [ ] Analyze produces ≥3 `EvidenceItem` per material, linked to the raw; user can reject individual items.
- [ ] Generate Self Model v0.1 (§12 JSON) from accepted evidence; immutable row; traceable to evidence.
- [ ] Self Model page renders the active version; Markdown + JSON export work.
- [ ] `pnpm typecheck`, `lint`, `build`, `test` green. Unit tests for `toMarkdown` + version bump logic (pure parts).

## Out of scope
Interviews, calibration, output generation (later phases). Live-LLM behavior quality is validated separately (needs a real API key).

## Notes
- Structured output: pass a `schema` to `runAgent` (OpenAI json_schema / Anthropic tool-use handled by adapters).
- Keep `hiddenAgentAnswer`/calibration concerns out of this phase.
