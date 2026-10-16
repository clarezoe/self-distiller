import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  context: { count: vi.fn(async () => 1) },
  rawMaterial: {
    findMany: vi.fn(async () => [{ id: "m1" }]),
    updateMany: vi.fn((a: unknown) => a),
    deleteMany: vi.fn(() => ({ count: 1 })),
  },
  evidenceItem: { updateMany: vi.fn((a: unknown) => a), deleteMany: vi.fn((a: unknown) => a) },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { deleteMaterial, setMaterialContexts } from "./materials";

describe("setMaterialContexts", () => {
  it("updates material and its evidence contextIds, project-scoped", async () => {
    const r = await setMaterialContexts("p", ["m1", "other"], ["c1"]);
    expect(r.updated).toBe(1);
    expect(db.rawMaterial.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["m1"] }, projectId: "p" },
      data: { contextIds: ["c1"] },
    });
    expect(db.evidenceItem.updateMany).toHaveBeenCalledWith({
      where: { rawMaterialId: { in: ["m1"] }, projectId: "p" },
      data: { contextIds: ["c1"] },
    });
  });

  it("rejects contexts outside the project", async () => {
    db.context.count.mockResolvedValueOnce(0);
    await expect(setMaterialContexts("p", ["m1"], ["x"])).rejects.toThrow();
  });

  it("only accepts relationship contexts of the project", async () => {
    await setMaterialContexts("p", ["m1"], ["c1"]);
    expect(db.context.count).toHaveBeenCalledWith({
      where: { id: { in: ["c1"] }, projectId: "p", type: "relationship" },
    });
  });
});

describe("deleteMaterial", () => {
  it("deletes the material and its evidence, project-scoped", async () => {
    const ok = await deleteMaterial("p", "m1");
    expect(ok).toBe(true);
    expect(db.evidenceItem.deleteMany).toHaveBeenCalledWith({ where: { rawMaterialId: "m1", projectId: "p" } });
    expect(db.rawMaterial.deleteMany).toHaveBeenCalledWith({ where: { id: "m1", projectId: "p" } });
  });
});
