import { describe, expect, it, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ createMaterials: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "u1" }) }));
vi.mock("@/lib/services/projects", () => ({ getProjectForUser: async () => ({ id: "p" }) }));
vi.mock("@/lib/services/materials", () => ({
  createMaterials: m.createMaterials,
  listMaterials: vi.fn(),
  setMaterialContexts: vi.fn(),
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://t/api/materials", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  m.createMaterials.mockResolvedValue({ created: [{ id: "m1" }], skipped: 0 });
});

describe("POST /api/materials sourceMetadata", () => {
  it("stores sourceMetadata", async () => {
    const res = await post({ projectId: "p", sourceType: "other", content: "x", sourceMetadata: { url: "https://a" } });
    expect(res.status).toBe(201);
    expect(m.createMaterials.mock.calls[0][1].sourceMetadata).toEqual({ url: "https://a" });
  });
  it("is unchanged without it", async () => {
    await post({ projectId: "p", sourceType: "other", content: "x" });
    expect(m.createMaterials.mock.calls[0][1].sourceMetadata).toBeUndefined();
  });
  it("rejects oversized metadata with 400", async () => {
    const res = await post({ projectId: "p", sourceType: "other", content: "x", sourceMetadata: { b: "x".repeat(5000) } });
    expect(res.status).toBe(400);
    expect(m.createMaterials).not.toHaveBeenCalled();
  });
  it("rejects non-object metadata with 400", async () => {
    expect((await post({ projectId: "p", sourceType: "other", content: "x", sourceMetadata: [1] })).status).toBe(400);
  });
});
