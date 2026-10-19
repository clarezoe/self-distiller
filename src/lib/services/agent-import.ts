// Token-authenticated bulk import (GitHub #38). The route authenticates and
// checks project ownership; everything below is project-scoped.

import { z } from "zod";
import { createMaterials, MATERIAL_SOURCES } from "@/lib/services/materials";
import { createContext, listContexts } from "@/lib/services/contexts";
import { validateSourceMetadata } from "@/lib/import/source-metadata";
import { ContextType, type MaterialSource } from "@/generated/prisma/client";

export const MAX_IMPORT_ITEMS = 100;
// Per-item content cap. Larger content is still auto-chunked by createMaterials.
export const MAX_ITEM_CONTENT_CHARS = 500_000;
export const IMPORTED_VIA = "import-token";
// Match the default selected by the app's user-created context form. Context names
// are generic labels, so do not silently turn an agent import into a relationship.
const CREATED_CONTEXT_TYPE = ContextType.language;

export const importBodySchema = z.object({
  projectId: z.string().min(1),
  createMissingContexts: z.boolean().optional(),
  materials: z.array(z.unknown()).min(1).max(MAX_IMPORT_ITEMS),
});

const itemSchema = z.object({
  sourceType: z.enum(MATERIAL_SOURCES, { message: "invalid sourceType" }),
  content: z.string().refine((s) => s.trim().length > 0, "content is empty").refine((s) => s.length <= MAX_ITEM_CONTENT_CHARS, `content exceeds ${MAX_ITEM_CONTENT_CHARS} chars`),
  language: z.string().optional(),
  contextIds: z.array(z.string()).optional(),
  contextNames: z.array(z.string().min(1)).optional(),
  materialTime: z
    .string()
    .refine((s) => !Number.isNaN(new Date(s).getTime()), "invalid materialTime")
    .optional(),
  sourceMetadata: z.record(z.string(), z.unknown()).optional(),
});

export type ImportResult = {
  created: number;
  skipped: number;
  ids: string[];
  errors: { index: number; error: string }[];
};

export async function importMaterials(
  projectId: string,
  items: unknown[],
  opts: { createMissingContexts?: boolean } = {},
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, skipped: 0, ids: [], errors: [] };
  const contexts = await listContexts(projectId);
  const idByName = new Map<string, string>();
  for (const c of contexts) {
    const k = c.name.trim().toLowerCase();
    if (!idByName.has(k)) idByName.set(k, c.id);
  }
  const knownIds = new Set(contexts.map((c) => c.id));
  const importedAt = new Date().toISOString();

  for (let index = 0; index < items.length; index++) {
    const parsed = itemSchema.safeParse(items[index]);
    if (!parsed.success) {
      result.errors.push({
        index,
        error: parsed.error.issues.map((i) => `${i.path.join(".") || "item"}: ${i.message}`).join("; "),
      });
      continue;
    }
    const item = parsed.data;

    try {
      if (item.sourceMetadata) {
        const err = validateSourceMetadata(item.sourceMetadata);
        if (err) {
          result.errors.push({ index, error: err });
          continue;
        }
      }

      const foreign = (item.contextIds ?? []).filter((id) => !knownIds.has(id));
      if (foreign.length > 0) {
        result.errors.push({ index, error: "unknown contextIds for this project" });
        continue;
      }

      const names = [...new Set((item.contextNames ?? []).map((n) => n.trim()).filter(Boolean))];
      const missing = names.filter((n) => !idByName.has(n.toLowerCase()));
      if (missing.length > 0 && !opts.createMissingContexts) {
        result.errors.push({ index, error: `unknown contextNames: ${missing.join(", ")}` });
        continue;
      }
      for (const name of missing) {
        const k = name.toLowerCase();
        if (idByName.has(k)) continue;
        const ctx = await createContext(projectId, { type: CREATED_CONTEXT_TYPE, name });
        idByName.set(k, ctx.id);
        knownIds.add(ctx.id);
      }
      const contextIds = [
        ...new Set([...(item.contextIds ?? []), ...names.map((n) => idByName.get(n.toLowerCase())!)]),
      ];

      const { created, skipped } = await createMaterials(projectId, {
        sourceType: item.sourceType as MaterialSource,
        content: item.content,
        language: item.language,
        contextIds,
        // Provenance keys are spread last so callers cannot override them.
        sourceMetadata: { ...(item.sourceMetadata ?? {}), importedVia: IMPORTED_VIA, importedAt },
        materialTime: item.materialTime ? new Date(item.materialTime) : null,
      });
      result.created += created.length;
      result.skipped += skipped;
      result.ids.push(...created.map((m) => m.id));
    } catch {
      result.errors.push({ index, error: "item could not be imported" });
    }
  }
  return result;
}
