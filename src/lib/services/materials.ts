import { prisma } from "@/lib/db";
import { MaterialSource } from "@/generated/prisma/client";

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

// Ownership: a raw material is reachable only via a project the user owns.
export async function getMaterialForUser(userId: string, materialId: string) {
  const material = await prisma.rawMaterial.findFirst({
    where: { id: materialId, project: { userId } },
  });
  if (!material) throw new Error("Material not found");
  return material;
}
