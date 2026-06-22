import { prisma } from "@/lib/db";
import { ContextType } from "@/generated/prisma/client";

export const CONTEXT_TYPES = [
  ContextType.language,
  ContextType.role,
  ContextType.relationship,
  ContextType.scene,
] as const;

export function listContexts(projectId: string) {
  return prisma.context.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export function createContext(
  projectId: string,
  data: { type: ContextType; name: string; description?: string; metadata?: Record<string, unknown> },
) {
  return prisma.context.create({
    data: {
      projectId,
      type: data.type,
      name: data.name,
      description: data.description,
      metadata: (data.metadata ?? {}) as object,
    },
  });
}

export function listCombinations(projectId: string) {
  return prisma.contextCombination.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export function createCombination(
  projectId: string,
  data: {
    name: string;
    description?: string;
    languageContextId?: string;
    roleContextId?: string;
    relationshipContextId?: string;
    sceneContextId?: string;
  },
) {
  return prisma.contextCombination.create({
    data: {
      projectId,
      name: data.name,
      description: data.description,
      languageContextId: data.languageContextId || null,
      roleContextId: data.roleContextId || null,
      relationshipContextId: data.relationshipContextId || null,
      sceneContextId: data.sceneContextId || null,
    },
  });
}

export function isContextType(value: string): value is ContextType {
  return (CONTEXT_TYPES as readonly string[]).includes(value);
}

// Resolve a ContextCombination (ownership-scoped) into its selected context dimensions:
// the combination name + each linked Context's {type, name}. Used to build the Self Model
// subset + context summary for blind calibration prompts (PRD §13.5, §14.1, §14.2).
export async function getCombinationSelection(userId: string, combinationId: string) {
  const combination = await prisma.contextCombination.findFirst({
    where: { id: combinationId, project: { userId } },
  });
  if (!combination) throw new Error("Combination not found");

  const ids = [
    combination.languageContextId,
    combination.roleContextId,
    combination.relationshipContextId,
    combination.sceneContextId,
  ].filter((x): x is string => Boolean(x));

  const linked = ids.length
    ? await prisma.context.findMany({ where: { id: { in: ids }, projectId: combination.projectId } })
    : [];

  const contexts = linked.map((c) => ({
    type: c.type as "language" | "role" | "relationship" | "scene",
    name: c.name,
  }));

  return { combination, contexts };
}
