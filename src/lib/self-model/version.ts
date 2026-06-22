import { prisma } from "@/lib/db";
import { ModelStatus, UpdateSourceType } from "@/generated/prisma/client";
import type { SelfModelJson } from "./schema";
import { nextVersion } from "./version-bump";

export { nextVersion };

function toJson(value: unknown): object {
  return JSON.parse(JSON.stringify(value ?? {})) as object;
}

export type CreateVersionSource = {
  sourceType: UpdateSourceType;
  sourceId: string;
  updateSummary?: string;
  affectedPaths?: string[];
};

// Create a new immutable SelfModel version (PRD §23):
// in one transaction — archive the current active model, insert the new immutable row,
// and record a user-approved ModelUpdate. Existing rows are never mutated except the
// active→archived status flip on the prior version.
export async function createVersion(
  projectId: string,
  json: SelfModelJson,
  source: CreateVersionSource,
) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.selfModel.findFirst({
      where: { projectId, status: ModelStatus.active },
      orderBy: { createdAt: "desc" },
    });

    const version = nextVersion(previous?.version);
    const stamped: SelfModelJson = { ...json, version };

    if (previous) {
      await tx.selfModel.update({
        where: { id: previous.id },
        data: { status: ModelStatus.archived },
      });
    }

    const created = await tx.selfModel.create({
      data: {
        projectId,
        version,
        status: ModelStatus.active,
        coreSelf: toJson(stamped.core_self),
        languageModels: toJson(stamped.language_models),
        roleModels: toJson(stamped.role_models),
        relationshipModels: toJson(stamped.relationship_models),
        sceneModels: toJson(stamped.scene_models),
        currentState: toJson(stamped.current_state),
        boundaries: toJson(stamped.boundaries),
        unknowns: toJson(stamped.unknowns),
      },
    });

    // Always record provenance — previousModelId is null for the first version (v0.1).
    await tx.modelUpdate.create({
      data: {
        projectId,
        previousModelId: previous?.id, // undefined → null for the first version
        newModelId: created.id,
        sourceType: source.sourceType,
        sourceId: source.sourceId,
        updateSummary: source.updateSummary ?? `Generated Self Model ${version}`,
        affectedPaths: source.affectedPaths ?? [],
        userApproved: true, // user explicitly triggered generation
      },
    });

    return created;
  });
}

export function getActiveModel(projectId: string) {
  return prisma.selfModel.findFirst({
    where: { projectId, status: ModelStatus.active },
    orderBy: { createdAt: "desc" },
  });
}

// Reconstruct the §12 JSON shape from the per-column DB row.
export function modelRowToJson(row: {
  version: string;
  coreSelf: unknown;
  languageModels: unknown;
  roleModels: unknown;
  relationshipModels: unknown;
  sceneModels: unknown;
  currentState: unknown;
  boundaries: unknown;
  unknowns: unknown;
}): SelfModelJson {
  return {
    version: row.version,
    core_self: (row.coreSelf as SelfModelJson["core_self"]) ?? {},
    language_models: (row.languageModels as SelfModelJson["language_models"]) ?? {},
    role_models: (row.roleModels as SelfModelJson["role_models"]) ?? {},
    relationship_models:
      (row.relationshipModels as SelfModelJson["relationship_models"]) ?? {},
    scene_models: (row.sceneModels as SelfModelJson["scene_models"]) ?? {},
    current_state: (row.currentState as SelfModelJson["current_state"]) ?? {},
    boundaries: (row.boundaries as SelfModelJson["boundaries"]) ?? {},
    unknowns: Array.isArray(row.unknowns) ? (row.unknowns as string[]) : [],
  };
}
