import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  rawMaterial: {
    findMany: vi.fn(async () => []),
    create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: "x", ...a.data })),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { createMaterials } from "./materials";

describe("createMaterials chunking", () => {
  it("keeps sourceMetadata on every chunk", async () => {
    const content = Array.from({ length: 1500 }, (_, i) => `line number ${i} with some padding text`).join("\n");
    expect(content.length).toBeGreaterThan(20_000);
    await createMaterials("p", { sourceType: "other", content, sourceMetadata: { url: "https://a" } });
    const calls = db.rawMaterial.create.mock.calls.map((c) => (c[0] as { data: { sourceMetadata: Record<string, unknown> } }).data.sourceMetadata);
    expect(calls.length).toBeGreaterThan(1);
    for (const md of calls) expect(md.url).toBe("https://a");
    expect(calls[0].partsTotal).toBe(calls.length);
  });
});
