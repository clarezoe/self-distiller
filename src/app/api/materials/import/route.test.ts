import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  project: { findFirst: vi.fn() },
}));
const svc = vi.hoisted(() => ({ importMaterials: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/services/agent-import", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/agent-import")>()),
  importMaterials: svc.importMaterials,
}));

import { POST } from "./route";
import { resetImportRateLimit } from "@/lib/import-token";

const IMPORT = "import-token-value";
const PERSONA = "persona-token-value";

function req(token: string | null, body: unknown = { projectId: "p", materials: [{ sourceType: "other", content: "x" }] }) {
  return new Request("http://t/api/materials/import", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetImportRateLimit();
  process.env.PERSONA_API_TOKEN = "env-persona";
  // Only the import hash resolves, on the importTokenHash column.
  db.user.findFirst.mockImplementation(async (a: { where: { importTokenHash?: string } }) =>
    a.where.importTokenHash === sha(IMPORT) ? { id: "u1" } : null,
  );
  db.project.findFirst.mockImplementation(async (a: { where: { id: string; userId: string } }) =>
    a.where.id === "p" && a.where.userId === "u1" ? { id: "p" } : null,
  );
  svc.importMaterials.mockResolvedValue({ created: 1, skipped: 0, ids: ["m"], errors: [] });
});

describe("POST /api/materials/import auth", () => {
  it("rejects a missing token", async () => {
    expect((await POST(req(null))).status).toBe(401);
    expect(svc.importMaterials).not.toHaveBeenCalled();
  });
  it("rejects an unknown/revoked token", async () => {
    expect((await POST(req("revoked"))).status).toBe(401);
  });
  it("rejects the persona token (hash and env)", async () => {
    expect((await POST(req(PERSONA))).status).toBe(401);
    expect((await POST(req("env-persona"))).status).toBe(401);
    for (const call of db.user.findFirst.mock.calls) {
      expect(Object.keys(call[0].where)).toEqual(["importTokenHash"]);
    }
  });
  it("returns 404 for another user's project", async () => {
    expect((await POST(req(IMPORT, { projectId: "other", materials: [{}] }))).status).toBe(404);
    expect(svc.importMaterials).not.toHaveBeenCalled();
  });
  it("imports for the owner and returns the result", async () => {
    const res = await POST(req(IMPORT));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ created: 1, skipped: 0, ids: ["m"], errors: [] });
  });
  it("rejects more than 100 items", async () => {
    const materials = Array.from({ length: 101 }, () => ({ sourceType: "other", content: "x" }));
    expect((await POST(req(IMPORT, { projectId: "p", materials }))).status).toBe(400);
  });
  it("rate limits per user with 429", async () => {
    let last = 200;
    for (let i = 0; i < 31; i++) last = (await POST(req(IMPORT))).status;
    expect(last).toBe(429);
  });

  it("does not authorize a token from the persona hash column", async () => {
    db.user.findFirst.mockImplementation(async (a: { where: { importTokenHash?: string; personaTokenHash?: string } }) =>
      a.where.importTokenHash ? null : { id: "u1" },
    );
    expect((await POST(req(PERSONA))).status).toBe(401);
    expect(db.user.findFirst.mock.calls[0][0].where).toEqual({ importTokenHash: sha(PERSONA) });
  });
});
