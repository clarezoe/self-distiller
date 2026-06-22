import { runAgent } from "@/lib/llm";
import { getMaterialForUser } from "@/lib/services/materials";
import { createEvidenceItems } from "@/lib/services/evidence";
import { getActiveModel, nextVersion } from "./version";
import {
  SELF_MODEL_JSON_SCHEMA,
  normalizeSelfModel,
  type SelfModelJson,
} from "./schema";
import {
  EVIDENCE_EXTRACTION_SCHEMA,
  buildImportAnalyzerMessages,
  type EvidenceExtractionResult,
} from "@/lib/prompts/import-analyzer";
import {
  buildSelfModelGeneratorMessages,
  type EvidenceForGeneration,
} from "@/lib/prompts/self-model-generator";
import type { SignalType, StabilityLevel } from "@/generated/prisma/client";

// Analyze a raw material (LLM) → persist >=3 EvidenceItem rows linked to rawMaterialId.
// Ownership re-checked via getMaterialForUser. Raw material is never deleted.
export async function analyzeMaterial(userId: string, projectId: string, materialId: string) {
  const material = await getMaterialForUser(userId, materialId);
  if (material.projectId !== projectId) throw new Error("Material not found");

  const messages = buildImportAnalyzerMessages({
    content: material.content,
    sourceType: material.sourceType,
    language: material.language,
    materialTime: material.materialTime?.toISOString() ?? null,
  });

  const result = await runAgent<EvidenceExtractionResult>({
    userId,
    projectId,
    agentRole: "import_analyzer",
    messages,
    schema: { name: "evidence_extraction", schema: EVIDENCE_EXTRACTION_SCHEMA },
  });

  const parsed = result.parsed;
  if (!parsed || !Array.isArray(parsed.evidence_items) || parsed.evidence_items.length === 0) {
    throw new Error("Analyzer returned no structured evidence. Try again or check the model/credential.");
  }

  const time = material.materialTime ?? material.createdAt;
  const evidence = await createEvidenceItems(
    projectId,
    parsed.evidence_items.map((e) => ({
      rawMaterialId: material.id,
      claim: e.claim,
      evidenceText: e.evidence_text,
      contextIds: material.contextIds,
      signalType: e.signal_type as SignalType,
      confidence: clamp01(e.confidence),
      stability: e.stability as StabilityLevel,
      firstSeen: time,
      lastSeen: time,
    })),
  );

  return { classification: parsed.classification, evidence };
}

// Generate a Self Model JSON (§12) from user-accepted evidence (LLM).
// Returns the §12 JSON; persisting an immutable version is done by createVersion (version.ts).
export async function generateInitialModel(
  userId: string,
  projectId: string,
  acceptedEvidence: EvidenceForGeneration[],
  opts?: { goal?: string },
): Promise<SelfModelJson> {
  if (acceptedEvidence.length === 0) {
    throw new Error("No accepted evidence to generate a model from.");
  }

  const active = await getActiveModel(projectId);
  const version = nextVersion(active?.version);

  const messages = buildSelfModelGeneratorMessages({
    version,
    goal: opts?.goal,
    evidence: acceptedEvidence,
  });

  const result = await runAgent<Partial<SelfModelJson>>({
    userId,
    projectId,
    agentRole: "self_model_generator",
    messages,
    // strict:false — the Self Model has user-defined dynamic context maps
    // (additionalProperties:true) and optional fields, which OpenAI strict mode forbids.
    schema: { name: "self_model", schema: SELF_MODEL_JSON_SCHEMA, strict: false },
  });

  if (!result.parsed) {
    throw new Error("Model generator returned no structured output. Try again or check the model/credential.");
  }

  return normalizeSelfModel(result.parsed, version);
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}
