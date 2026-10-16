import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { llmCallLog: { create: vi.fn().mockResolvedValue({}) } } }));

import { isJevEnabled, jevNoul } from "./client";

const q = { a: { type: "noul" as const, instructions: "x" } };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("jevNoul", () => {
  it("returns null answers when key missing, without fetching", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(isJevEnabled()).toBe(false);
    expect((await jevNoul({}, q)).answers).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("parses noul answers", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ answers: { a: { noul: 0.8 } } }) }));
    expect((await jevNoul({}, q)).answers).toEqual({ a: 0.8 });
  });

  it("returns null on non-2xx, malformed, and thrown fetch", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    expect((await jevNoul({}, q)).answers).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect((await jevNoul({}, q)).answers).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect((await jevNoul({}, q)).answers).toBeNull();
  });
});
