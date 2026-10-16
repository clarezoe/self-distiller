import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseGoogleChat } from "@/lib/import/google-chat";

const created: Array<{ content: string; contextIds?: string[]; sourceMetadata?: Record<string, unknown> }> = [];
const store = vi.hoisted(() => ({
  contexts: [] as Array<{ id: string; type: string; name: string }>,
  creates: 0,
}));

vi.mock("@/lib/services/projects", () => ({ getProjectForUser: vi.fn(async () => ({})) }));
vi.mock("@/lib/services/materials", () => ({
  createMaterialsBatch: vi.fn(async (_p: string, inputs: typeof created) => {
    created.push(...inputs);
    return { created: inputs.map((_, i) => ({ id: `m${i}` })), skipped: 0 };
  }),
}));
vi.mock("@/lib/services/contexts", () => ({
  listContexts: vi.fn(async () => store.contexts),
  getContextsByIds: vi.fn(async (_p: string, ids: string[]) =>
    store.contexts.filter((c) => ids.includes(c.id)),
  ),
  createContext: vi.fn(async (_p: string, d: { type: string; name: string }) => {
    store.creates++;
    const c = { id: `new${store.creates}`, type: d.type, name: d.name };
    store.contexts.push(c);
    return c;
  }),
}));

import { commitGoogleChatImport, InvalidAssignmentError } from "./import-google-chat";

const owner = { name: "Me", email: "me@x.com" };
const parsed = parseGoogleChat([
  { content: { messages: [{ creator: owner, text: "a" }, { creator: { name: "Dave" }, text: "b" }] }, spaceName: "DM_1" },
  { content: { messages: [{ creator: owner, text: "c" }, { creator: { name: "Eve" }, text: "d" }] }, spaceName: "DM_2" },
]);
const ownerKey = "email:me@x.com";

beforeEach(() => {
  created.length = 0;
  store.creates = 0;
  store.contexts = [{ id: "r1", type: "relationship", name: "Close friend" }];
});

describe("commitGoogleChatImport assignments", () => {
  it("sets contextIds per conversation and per-conversation partners", async () => {
    await commitGoogleChatImport("u", "p", parsed, ownerKey, [
      { conversationIndex: 0, contextIds: ["r1"] },
    ]);
    expect(created[0].contextIds).toEqual(["r1"]);
    expect(created[1].contextIds).toEqual([]);
    expect(created[0].content.split("\n")[0]).toBe("# Chat with Dave (Close friend)");
    expect(created[0].sourceMetadata?.partners).toEqual([{ name: "Dave", key: "name:Dave" }]);
    expect(created[1].sourceMetadata?.partners).toEqual([{ name: "Eve", key: "name:Eve" }]);
  });

  it("rejects an unknown context id", async () => {
    await expect(
      commitGoogleChatImport("u", "p", parsed, ownerKey, [{ conversationIndex: 0, contextIds: ["nope"] }]),
    ).rejects.toBeInstanceOf(InvalidAssignmentError);
    expect(created).toHaveLength(0);
  });

  it("creates a new relationship once and reuses it (case-insensitive)", async () => {
    await commitGoogleChatImport("u", "p", parsed, ownerKey, [
      { conversationIndex: 0, newRelationshipName: "Husband" },
      { conversationIndex: 1, newRelationshipName: "husband" },
    ]);
    expect(store.creates).toBe(1);
    expect(created[0].contextIds).toEqual(["new1"]);
    expect(created[1].contextIds).toEqual(["new1"]);
  });
});
