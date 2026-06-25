import { prisma } from "@/lib/db";
import { MaterialSource } from "@/generated/prisma/client";
import { chunkText } from "@/lib/import/chunk-text";

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

export function createMaterial(
  projectId: string,
  data: {
    sourceType: MaterialSource;
    content: string;
    language?: string | null;
    contextIds?: string[];
    sourceMetadata?: Record<string, unknown>;
    materialTime?: Date | null;
  },
) {
  return prisma.rawMaterial.create({
    data: {
      projectId,
      sourceType: data.sourceType,
      content: data.content,
      language: data.language ?? null,
      contextIds: data.contextIds ?? [],
      sourceMetadata: (data.sourceMetadata ?? {}) as object,
      materialTime: data.materialTime ?? null,
    },
  });
}

// Create one-or-many RawMaterials from a single input. Small content (≤ the
// split threshold) creates exactly one material, unchanged from before. Large
// content is split on line boundaries (`chunkText`) into multiple materials,
// each ≤ ~20k chars and individually Analyze-able — no text is discarded.
// Each chunk carries the same sourceType/language/contextIds; its
// source_metadata is the caller's metadata merged with `{ part, partsTotal }`.
export async function createMaterials(
  projectId: string,
  data: {
    sourceType: MaterialSource;
    content: string;
    language?: string | null;
    contextIds?: string[];
    sourceMetadata?: Record<string, unknown>;
    materialTime?: Date | null;
  },
) {
  if (data.content.length <= SPLIT_THRESHOLD) {
    const material = await createMaterial(projectId, data);
    return [material];
  }

  const chunks = chunkText(data.content);
  // Defensive: chunkText yields 0 chunks for whitespace-only input. Content
  // reaches here only after a zod `min(1)` check, so a large all-whitespace
  // blob is possible — never discard it or hand the route an empty array.
  if (chunks.length === 0) {
    const material = await createMaterial(projectId, data);
    return [material];
  }

  const materials = [];
  for (const chunk of chunks) {
    const material = await createMaterial(projectId, {
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
    });
    materials.push(material);
  }
  return materials;
}

// Ownership: a raw material is reachable only via a project the user owns.
export async function getMaterialForUser(userId: string, materialId: string) {
  const material = await prisma.rawMaterial.findFirst({
    where: { id: materialId, project: { userId } },
  });
  if (!material) throw new Error("Material not found");
  return material;
}
