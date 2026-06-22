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
