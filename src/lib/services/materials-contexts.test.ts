import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  context: {
    count: vi.fn(async () => 1),
    findMany: vi.fn(async (): Promise<{ id: string }[]> => []),
  },
  rawMaterial: {
    findMany: vi.fn(async (): Promise<{ id: string; contextIds: string[] }[]> => [
      { id: "m1", contextIds: [] },
    ]),
    updateMany: vi.fn((a: unknown) => a),
    deleteMany: vi.fn(() => ({ count: 1 })),
  },
  evidenceItem: { updateMany: vi.fn((a: unknown) => a), deleteMany: vi.fn((a: unknown) => a) },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { deleteMaterial, setMaterialContexts } from "./materials";

describe("setMaterialContexts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates material and its evidence contextIds, project-scoped", async () => {
    const r = await setMaterialContexts("p", ["m1", "other"], ["c1"]);
    expect(r.updated).toBe(1);
    expect(db.rawMaterial.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["m1", "other"] }, projectId: "p" },
      select: { id: true, contextIds: true },
    });
    expect(db.rawMaterial.updateMany).toHaveBeenCalledWith({
      where: { id: "m1", projectId: "p" },
      data: { contextIds: ["c1"] },
    });
    expect(db.evidenceItem.updateMany).toHaveBeenCalledWith({
      where: { rawMaterialId: "m1", projectId: "p" },
      data: { contextIds: ["c1"] },
    });
  });

  it("rejects contexts outside the project", async () => {
    db.context.count.mockResolvedValueOnce(0);
    await expect(setMaterialContexts("p", ["m1"], ["x"])).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("defaults to relationship contexts of the project", async () => {
    await setMaterialContexts("p", ["m1"], ["c1"]);
    expect(db.context.count).toHaveBeenCalledWith({
      where: { id: { in: ["c1"] }, projectId: "p", type: { in: ["relationship"] } },
    });
  });

  it("validates ids against the requested types", async () => {
    await setMaterialContexts("p", ["m1"], ["lang-en"], ["language"]);
    expect(db.context.count).toHaveBeenCalledWith({
      where: { id: { in: ["lang-en"] }, projectId: "p", type: { in: ["language"] } },
    });
  });

  it("replaces only the requested type and keeps other tags", async () => {
    db.rawMaterial.findMany.mockResolvedValueOnce([
      { id: "m1", contextIds: ["lang-zh", "role-x", "rel-old", "scene-post"] },
    ]);
    // rel-old is the only existing id of the replaced type.
    db.context.findMany.mockResolvedValueOnce([{ id: "rel-old" }]);
    await setMaterialContexts("p", ["m1"], ["rel-new"]);
    expect(db.context.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["lang-zh", "role-x", "rel-old", "scene-post"] },
        projectId: "p",
        type: { in: ["relationship"] },
      },
      select: { id: true },
    });
    const next = ["lang-zh", "role-x", "scene-post", "rel-new"];
    expect(db.rawMaterial.updateMany).toHaveBeenCalledWith({
      where: { id: "m1", projectId: "p" },
      data: { contextIds: next },
    });
    expect(db.evidenceItem.updateMany).toHaveBeenCalledWith({
      where: { rawMaterialId: "m1", projectId: "p" },
      data: { contextIds: next },
    });
  });

  it("clearing one type keeps the rest, per material", async () => {
    db.rawMaterial.findMany.mockResolvedValueOnce([
      { id: "m1", contextIds: ["lang-zh", "role-x"] },
      { id: "m2", contextIds: ["lang-en"] },
    ]);
    db.context.findMany.mockResolvedValueOnce([{ id: "lang-zh" }, { id: "lang-en" }]);
    const r = await setMaterialContexts("p", ["m1", "m2"], [], ["language"]);
    expect(r.updated).toBe(2);
    expect(db.context.count).not.toHaveBeenCalled();
    expect(db.rawMaterial.updateMany).toHaveBeenCalledWith({
      where: { id: "m1", projectId: "p" },
      data: { contextIds: ["role-x"] },
    });
    expect(db.rawMaterial.updateMany).toHaveBeenCalledWith({
      where: { id: "m2", projectId: "p" },
      data: { contextIds: [] },
    });
  });

  it("does not duplicate an id that is already set", async () => {
    db.rawMaterial.findMany.mockResolvedValueOnce([{ id: "m1", contextIds: ["rel-a", "lang-zh"] }]);
    db.context.findMany.mockResolvedValueOnce([{ id: "rel-a" }]);
    await setMaterialContexts("p", ["m1"], ["rel-a"]);
    expect(db.rawMaterial.updateMany).toHaveBeenCalledWith({
      where: { id: "m1", projectId: "p" },
      data: { contextIds: ["lang-zh", "rel-a"] },
    });
  });

  it("writes nothing when no material is owned", async () => {
    db.rawMaterial.findMany.mockResolvedValueOnce([]);
    const r = await setMaterialContexts("p", ["foreign"], ["c1"]);
    expect(r.updated).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
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
