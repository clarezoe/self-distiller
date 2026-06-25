import { prisma } from "@/lib/db";
import { MaterialSource, type RawMaterial } from "@/generated/prisma/client";
import { chunkText } from "@/lib/import/chunk-text";
import { contentHash } from "@/lib/import/hash";

// Above this many chars a single pasted/uploaded blob is split into multiple
// RawMaterials so each Analyze call stays within the model context window.
// Matches the chunker's hard max (a chunk never exceeds ~20k chars).
const SPLIT_THRESHOLD = 20_000;

export const MATERIAL_SOURCES = [
  MaterialSource.chat,
  MaterialSource.copywriting,
  MaterialSource.email,
  MaterialSource.social_post,
  MaterialSource.diary,
  MaterialSource.course_script,
  MaterialSource.product_text,
  MaterialSource.sales_reply,
  MaterialSource.chatgpt_conversation,
  MaterialSource.other,
] as const;

export function isMaterialSource(value: string): value is MaterialSource {
  return (Object.values(MaterialSource) as string[]).includes(value);
}

export function listMaterials(projectId: string) {
  return prisma.rawMaterial.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { evidenceItems: { orderBy: { createdAt: "asc" } } },
  });
}

export type MaterialInput = {
  sourceType: MaterialSource;
  content: string;
  language?: string | null;
  contextIds?: string[];
  sourceMetadata?: Record<string, unknown>;
  materialTime?: Date | null;
};

export type CreateMaterialsResult = { created: RawMaterial[]; skipped: number };

// Look up which of the given content hashes already exist for this project.
async function existingContentHashes(
  projectId: string,
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const rows = await prisma.rawMaterial.findMany({
    where: { projectId, contentHash: { in: hashes } },
    select: { contentHash: true },
  });
  return new Set(
    rows.map((r) => r.contentHash).filter((h): h is string => h !== null),
  );
}

// Dedup-aware batch insert. Each input is hashed on its NORMALIZED content; an
// input is skipped (not inserted) when that hash already exists for the project
// OR was already inserted earlier in this same batch (intra-batch dedup). Skips
// are intentional and reported via `skipped` — never a silent drop. Dedup is
// strictly per project (the unique key is [projectId, contentHash]).
export async function createMaterialsBatch(
  projectId: string,
  inputs: MaterialInput[],
): Promise<CreateMaterialsResult> {
  if (inputs.length === 0) return { created: [], skipped: 0 };

  const withHash = inputs.map((input) => ({ input, hash: contentHash(input.content) }));
  const seen = await existingContentHashes(
    projectId,
    withHash.map((w) => w.hash),
  );

  const created: RawMaterial[] = [];
  let skipped = 0;
  for (const { input, hash } of withHash) {
    if (seen.has(hash)) {
      skipped++;
      continue;
    }
    seen.add(hash);
    const material = await prisma.rawMaterial.create({
      data: {
        projectId,
        sourceType: input.sourceType,
        content: input.content,
        contentHash: hash,
        language: input.language ?? null,
        contextIds: input.contextIds ?? [],
        sourceMetadata: (input.sourceMetadata ?? {}) as object,
        materialTime: input.materialTime ?? null,
      },
    });
    created.push(material);
  }
  return { created, skipped };
}

// Create a single RawMaterial (dedup-aware). Unique content still creates as
// before; a re-import of identical content is skipped and reported.
export function createMaterial(
  projectId: string,
  data: MaterialInput,
): Promise<CreateMaterialsResult> {
  return createMaterialsBatch(projectId, [data]);
}

// Create one-or-many RawMaterials from a single input. Small content (≤ the
// split threshold) creates exactly one material, unchanged from before. Large
// content is split on line boundaries (`chunkText`) into multiple materials,
// each ≤ ~20k chars and individually Analyze-able — no text is discarded.
// Each chunk carries the same sourceType/language/contextIds; its
// source_metadata is the caller's metadata merged with `{ part, partsTotal }`.
// Dedup (content-hash, per project) is applied across the produced chunks.
export async function createMaterials(
  projectId: string,
  data: MaterialInput,
): Promise<CreateMaterialsResult> {
  if (data.content.length <= SPLIT_THRESHOLD) {
    return createMaterialsBatch(projectId, [data]);
  }

  const chunks = chunkText(data.content);
  // Defensive: chunkText yields 0 chunks for whitespace-only input. Content
  // reaches here only after a zod `min(1)` check, so a large all-whitespace
  // blob is possible — never discard it.
  if (chunks.length === 0) {
    return createMaterialsBatch(projectId, [data]);
  }

  const inputs: MaterialInput[] = chunks.map((chunk) => ({
    sourceType: data.sourceType,
    content: chunk.content,
    language: data.language,
    contextIds: data.contextIds,
    sourceMetadata: {
      ...(data.sourceMetadata ?? {}),
      part: chunk.part,
      partsTotal: chunk.partsTotal,
    },
    materialTime: data.materialTime,
  }));
  return createMaterialsBatch(projectId, inputs);
}

// Ownership: a raw material is reachable only via a project the user owns.
export async function getMaterialForUser(userId: string, materialId: string) {
  const material = await prisma.rawMaterial.findFirst({
    where: { id: materialId, project: { userId } },
  });
  if (!material) throw new Error("Material not found");
  return material;
}
