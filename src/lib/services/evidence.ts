import { prisma } from "@/lib/db";
import { SignalType, StabilityLevel, type EvidenceItem } from "@/generated/prisma/client";
import { normalizeForHash } from "@/lib/import/hash";

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

// Drop items whose NORMALIZED evidenceText already exists for the project
// (`existingNormalizedTexts`) or is duplicated earlier in this batch. Even with
// material content-hash dedup, overlapping-but-not-identical materials (a full
// DM and a pasted excerpt) yield the same quoted evidence — deduping at this
// layer stops one quote inflating confidence (PRD §15.2). Exact normalized
// match only; no fuzzy/similarity matching. PURE: unit-tested.
export function dedupeEvidence<T extends { evidenceText: string }>(
  existingNormalizedTexts: Set<string>,
  items: T[],
): { keep: T[]; skipped: number } {
  const seen = new Set(existingNormalizedTexts);
  const keep: T[] = [];
  let skipped = 0;
  for (const item of items) {
    const norm = normalizeForHash(item.evidenceText);
    if (seen.has(norm)) {
      skipped++;
      continue;
    }
    seen.add(norm);
    keep.push(item);
  }
  return { keep, skipped };
}

// Persist extracted evidence, deduped by normalized evidenceText (per project).
// Acceptance is tracked at generation time (only user-selected ids feed the
// model); items are never deleted on analyze. Skips are reported via `skipped`.
export async function createEvidenceItems(
  projectId: string,
  items: EvidenceInput[],
): Promise<{ created: EvidenceItem[]; skipped: number }> {
  const existing = await prisma.evidenceItem.findMany({
    where: { projectId },
    select: { evidenceText: true },
  });
  const existingNormalized = new Set(existing.map((e) => normalizeForHash(e.evidenceText)));

  const { keep, skipped } = dedupeEvidence(existingNormalized, items);

  const now = new Date();
  const created = await prisma.$transaction(
    keep.map((item) =>
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
  return { created, skipped };
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
