import { prisma } from "@/lib/db";
import { SignalType, StabilityLevel } from "@/generated/prisma/client";

export type EvidenceInput = {
  rawMaterialId?: string | null;
  claim: string;
  evidenceText: string;
  contextIds?: string[];
  signalType: SignalType;
  confidence: number;
  stability: StabilityLevel;
  firstSeen?: Date;
  lastSeen?: Date;
};

// Persist all extracted evidence. Acceptance is tracked at generation time
// (only user-selected ids feed the model); items are never deleted on analyze.
export async function createEvidenceItems(projectId: string, items: EvidenceInput[]) {
  const now = new Date();
  return prisma.$transaction(
    items.map((item) =>
      prisma.evidenceItem.create({
        data: {
          projectId,
          rawMaterialId: item.rawMaterialId ?? null,
          claim: item.claim,
          evidenceText: item.evidenceText,
          contextIds: item.contextIds ?? [],
          signalType: item.signalType,
          confidence: item.confidence,
          stability: item.stability,
          firstSeen: item.firstSeen ?? now,
          lastSeen: item.lastSeen ?? now,
        },
      }),
    ),
  );
}

export function listEvidence(projectId: string) {
  return prisma.evidenceItem.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

// Fetch a user-selected subset, scoped to the owner's project (defends against forged ids).
export function getEvidenceByIds(projectId: string, ids: string[]) {
  return prisma.evidenceItem.findMany({
    where: { projectId, id: { in: ids } },
    orderBy: { createdAt: "asc" },
  });
}
