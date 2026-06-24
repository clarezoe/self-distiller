import { describe, expect, it } from "vitest";
import { chunkConversation } from "./chunk";
import { participantKey, type ParsedConversation, type ParsedTurn } from "./google-chat";

const OWNER = participantKey("Alice Owner", "alice@example.com");
const FRIEND = participantKey("Dave Friend", undefined);

function ownerTurn(text: string, ts?: string): ParsedTurn {
  return { sender: "Alice Owner", email: "alice@example.com", key: OWNER, text, ts };
}
function friendTurn(text: string, ts?: string): ParsedTurn {
  return { sender: "Dave Friend", key: FRIEND, text, ts };
}

describe("chunkConversation", () => {
  it("small conversation yields exactly one chunk", () => {
    const conv: ParsedConversation = {
      spaceName: "DM",
      dateRange: { from: "2024-01-01T09:00:00Z", to: "2024-01-01T09:02:00Z" },
      turns: [
        ownerTurn("Are you free later?", "2024-01-01T09:00:00Z"),
        friendTurn("Yep, after 3.", "2024-01-01T09:01:00Z"),
        ownerTurn("Great, see you then.", "2024-01-01T09:02:00Z"),
      ],
    };
    const chunks = chunkConversation(conv, OWNER);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].part).toBe(1);
    expect(chunks[0].partsTotal).toBe(1);
    expect(chunks[0].turnCount).toBe(3);
    expect(chunks[0].content).toBe(
      ["me: Are you free later?", "Dave Friend: Yep, after 3.", "me: Great, see you then."].join("\n"),
    );
    expect(chunks[0].dateRange).toEqual({
      from: "2024-01-01T09:00:00Z",
      to: "2024-01-01T09:02:00Z",
    });
  });

  it("empty conversation yields no chunks", () => {
    const conv: ParsedConversation = { dateRange: {}, turns: [] };
    expect(chunkConversation(conv, OWNER)).toHaveLength(0);
  });

  it("splits into multiple chunks respecting the budget, only on turn boundaries", () => {
    // Each turn is ~200 chars. Target 500 → ~3 turns per chunk.
    const body = "x".repeat(200);
    const turns: ParsedTurn[] = [];
    for (let i = 0; i < 10; i++) {
      turns.push(i % 2 === 0 ? ownerTurn(body) : friendTurn(body));
    }
    const conv: ParsedConversation = { dateRange: {}, turns };
    const chunks = chunkConversation(conv, OWNER, { targetChars: 500, maxChars: 800 });

    expect(chunks.length).toBeGreaterThan(1);
    // partsTotal stamped consistently; parts are 1..N in order.
    expect(chunks.every((c) => c.partsTotal === chunks.length)).toBe(true);
    expect(chunks.map((c) => c.part)).toEqual(chunks.map((_, i) => i + 1));

    // Budget respected: no chunk exceeds maxChars.
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(800);
    }

    // All turns preserved, in order, none dropped or split mid-message.
    const totalTurns = chunks.reduce((n, c) => n + c.turnCount, 0);
    expect(totalTurns).toBe(10);
    const rejoined = chunks.map((c) => c.content).join("\n").split("\n");
    expect(rejoined).toHaveLength(10);
    // Every line is a complete labeled turn (no fragment).
    for (const line of rejoined) {
      expect(line).toMatch(/^(me|Dave Friend): x{200}$/);
    }
  });

  it("never splits a single turn — an oversized turn becomes its own chunk", () => {
    const huge = "y".repeat(50_000); // bigger than maxChars
    const conv: ParsedConversation = {
      dateRange: {},
      turns: [ownerTurn("first small"), ownerTurn(huge), friendTurn("after the giant")],
    };
    const chunks = chunkConversation(conv, OWNER, { targetChars: 12_000, maxChars: 20_000 });

    // The giant turn is intact in exactly one chunk's content.
    const giantChunks = chunks.filter((c) => c.content.includes(huge));
    expect(giantChunks).toHaveLength(1);
    expect(giantChunks[0].content).toContain(`me: ${huge}`);
    // The giant turn was NOT merged with the small turns into one over-max chunk;
    // it stands alone (only its own line).
    expect(giantChunks[0].turnCount).toBe(1);

    // No turn lost: 3 turns total across chunks.
    expect(chunks.reduce((n, c) => n + c.turnCount, 0)).toBe(3);
  });

  it("labels owner lines as me: per chunk, others by sender", () => {
    const body = "z".repeat(300);
    const turns: ParsedTurn[] = [];
    for (let i = 0; i < 8; i++) {
      turns.push(i % 2 === 0 ? ownerTurn(body) : friendTurn(body));
    }
    const conv: ParsedConversation = { dateRange: {}, turns };
    const chunks = chunkConversation(conv, OWNER, { targetChars: 600, maxChars: 1000 });
    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk uses the same labeling contract.
    for (const c of chunks) {
      for (const line of c.content.split("\n")) {
        expect(line).toMatch(/^(me|Dave Friend): /);
      }
    }
  });

  it("labels by the other participant when ownerKey is someone else", () => {
    const conv: ParsedConversation = {
      dateRange: {},
      turns: [ownerTurn("mine"), friendTurn("theirs")],
    };
    const chunks = chunkConversation(conv, FRIEND);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(["Alice Owner: mine", "me: theirs"].join("\n"));
  });

  it("dateRange uses first/last timestamps present within the chunk", () => {
    const conv: ParsedConversation = {
      dateRange: {},
      // Big turns force a split; timestamps only on some turns.
      turns: [
        ownerTurn("a".repeat(400), "2024-03-01T10:00:00Z"),
        friendTurn("b".repeat(400)),
        ownerTurn("c".repeat(400), "2024-03-01T10:05:00Z"),
        friendTurn("d".repeat(400), "2024-03-01T11:00:00Z"),
      ],
    };
    const chunks = chunkConversation(conv, OWNER, { targetChars: 500, maxChars: 900 });
    expect(chunks.length).toBeGreaterThan(1);
    // First chunk's range comes from its own stamped turns only.
    expect(chunks[0].dateRange.from).toBe("2024-03-01T10:00:00Z");
    // Last chunk's `to` is the latest timestamp it holds.
    expect(chunks[chunks.length - 1].dateRange.to).toBe("2024-03-01T11:00:00Z");
  });
});
