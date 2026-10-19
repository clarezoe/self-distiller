import { describe, expect, it, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({
  context: {
    findMany: vi.fn(async () => [] as { id: string; name: string; type: string }[]),
    create: vi.fn(async (a: { data: { name: string } }) => ({ id: `new-${a.data.name}`, ...a.data })),
  },
  rawMaterial: {
    findMany: vi.fn(async () => [] as { contentHash: string }[]),
    create: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: `m${Math.random()}`, ...a.data })),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { importMaterials } from "./agent-import";

const item = (o: Record<string, unknown> = {}) => ({ sourceType: "social_post", content: "hello world", ...o });

beforeEach(() => {
  vi.clearAllMocks();
  db.context.findMany.mockResolvedValue([{ id: "c1", name: "Zh", type: "scene" }]);
  db.rawMaterial.findMany.mockResolvedValue([]);
});

describe("importMaterials", () => {
  it("imports valid items and reports the invalid index", async () => {
    const r = await importMaterials("p", [item(), item({ sourceType: "bogus" }), item({ content: "second" })]);
    expect(r.created).toBe(2);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].index).toBe(1);
  });

  it("skips content that already exists (re-run dedup)", async () => {
    const first = await importMaterials("p", [item()]);
    expect(first.created).toBe(1);
    const hash = (db.rawMaterial.create.mock.calls[0][0] as { data: { contentHash: string } }).data.contentHash;
    db.rawMaterial.findMany.mockResolvedValue([{ contentHash: hash }]);
    const again = await importMaterials("p", [item()]);
    expect(again.created).toBe(0);
    expect(again.skipped).toBe(1);
  });

  it("stamps provenance that callers cannot override", async () => {
    await importMaterials("p", [item({ sourceMetadata: { url: "https://a", importedVia: "forged", importedAt: "x" } })]);
    const md = (db.rawMaterial.create.mock.calls[0][0] as { data: { sourceMetadata: Record<string, string> } }).data.sourceMetadata;
    expect(md.url).toBe("https://a");
    expect(md.importedVia).toBe("import-token");
    expect(md.importedAt).not.toBe("x");
    expect(Number.isNaN(Date.parse(md.importedAt))).toBe(false);
  });

  it("rejects oversized sourceMetadata per item", async () => {
    const r = await importMaterials("p", [item({ sourceMetadata: { big: "x".repeat(5000) } }), item({ content: "ok" })]);
    expect(r.errors.map((e) => e.index)).toEqual([0]);
    expect(r.created).toBe(1);
  });

  it("resolves contextNames case-insensitively", async () => {
    await importMaterials("p", [item({ contextNames: ["zH"] })]);
    expect((db.rawMaterial.create.mock.calls[0][0] as { data: { contextIds: string[] } }).data.contextIds).toEqual(["c1"]);
    expect(db.context.create).not.toHaveBeenCalled();
  });

  it("rejects unknown contextNames unless createMissingContexts, then creates once", async () => {
    const r = await importMaterials("p", [item({ contextNames: ["New"] })]);
    expect(r.errors[0].error).toMatch(/unknown contextNames/);
    expect(db.context.create).not.toHaveBeenCalled();

    const r2 = await importMaterials("p", [item({ contextNames: ["New"] }), item({ content: "b", contextNames: ["new"] })], {
      createMissingContexts: true,
    });
    expect(r2.created).toBe(2);
    expect(db.context.create).toHaveBeenCalledTimes(1);
  });

  it("rejects contextIds from other projects", async () => {
    const r = await importMaterials("p", [item({ contextIds: ["foreign"] })]);
    expect(r.errors).toHaveLength(1);
    expect(r.created).toBe(0);
  });

  it("contains an unexpected context creation failure to its item", async () => {
    db.context.create.mockRejectedValueOnce(new Error("secret database details"));
    const r = await importMaterials(
      "p",
      [item({ contextNames: ["broken"] }), item({ content: "still imported" })],
      { createMissingContexts: true },
    );
    expect(r.created).toBe(1);
    expect(r.errors).toEqual([{ index: 0, error: "item could not be imported" }]);
  });
});
