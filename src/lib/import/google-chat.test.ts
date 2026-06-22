import { describe, expect, it } from "vitest";
import { parseGoogleChat, participantKey } from "./google-chat";

// Fixture: a multi-party space (3 people) modeled on the documented Takeout shape.
const multiPartySpace = {
  messages: [
    {
      creator: { name: "Alice Owner", email: "alice@example.com", user_type: "Human" },
      created_date: "Monday, January 1, 2024 at 9:00:00 AM UTC",
      text: "Hey team, kicking this off.",
    },
    {
      creator: { name: "Bob Helper", email: "bob@example.com", user_type: "Human" },
      created_date: "Monday, January 1, 2024 at 9:01:00 AM UTC",
      text: "Sounds good.",
    },
    {
      creator: { name: "Alice Owner", email: "alice@example.com", user_type: "Human" },
      created_date: "Monday, January 1, 2024 at 9:02:00 AM UTC",
      text: "I'll take the first part.",
    },
    {
      creator: { name: "Alice Owner", email: "alice@example.com", user_type: "Human" },
      created_date: "Monday, January 1, 2024 at 9:03:00 AM UTC",
      text: "Carol, can you review?",
    },
    {
      creator: { name: "Carol Reviewer", email: "carol@example.com", user_type: "Human" },
      created_date: "Monday, January 1, 2024 at 9:05:00 AM UTC",
      text: "On it.",
    },
    // system / attachment-only message — no text, must be skipped
    {
      creator: { name: "Alice Owner", email: "alice@example.com", user_type: "Human" },
      created_date: "Monday, January 1, 2024 at 9:06:00 AM UTC",
      attached_files: [{ export_name: "diagram.png" }],
    },
  ],
};

// Fixture: a 2-person DM, passed as a raw JSON string and with variant field
// names + a missing email — exercises tolerance.
const dmRaw = JSON.stringify({
  messages: [
    {
      creator: { name: "Alice Owner", email: "alice@example.com" },
      timestamp: "2024-02-02T10:00:00Z",
      message_text: "Are you free later?",
    },
    {
      // no email — should still register, keyed by name
      author: { display_name: "Dave Friend" },
      timestamp: "2024-02-02T10:01:00Z",
      content: "Yep, after 3.",
    },
  ],
});

describe("participantKey", () => {
  it("prefers email (case-insensitive) over name", () => {
    expect(participantKey("Alice", "Alice@Example.com")).toBe("email:alice@example.com");
  });
  it("falls back to name when no email", () => {
    expect(participantKey("Dave Friend", undefined)).toBe("name:Dave Friend");
  });
  it("returns unknown when neither present", () => {
    expect(participantKey(undefined, undefined)).toBe("unknown");
  });
});

describe("parseGoogleChat — multi-party space", () => {
  const result = parseGoogleChat([
    { content: multiPartySpace, spaceName: "Project Kickoff" },
  ]);

  it("collects one conversation with the space name", () => {
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0].spaceName).toBe("Project Kickoff");
  });

  it("skips the attachment-only message (no text)", () => {
    // 5 text messages, 1 attachment-only dropped
    expect(result.conversations[0].turns).toHaveLength(5);
  });

  it("computes a date range from first/last timestamps", () => {
    const { from, to } = result.conversations[0].dateRange;
    expect(from).toContain("9:00:00 AM");
    expect(to).toContain("9:05:00 AM");
  });

  it("ranks the most frequent participant first (owner detection)", () => {
    // Alice has 3 text turns, Bob 1, Carol 1 → Alice first.
    expect(result.participants[0].key).toBe("email:alice@example.com");
    expect(result.participants[0].count).toBe(3);
    expect(result.participants.map((p) => p.name)).toContain("Bob Helper");
    expect(result.participants.map((p) => p.name)).toContain("Carol Reviewer");
  });
});

describe("parseGoogleChat — DM as raw string with variant fields", () => {
  const result = parseGoogleChat([{ content: dmRaw, spaceName: "DM with Dave" }]);

  it("parses a raw JSON string input", () => {
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0].turns).toHaveLength(2);
  });

  it("reads variant text keys (message_text / content)", () => {
    const texts = result.conversations[0].turns.map((t) => t.text);
    expect(texts).toEqual(["Are you free later?", "Yep, after 3."]);
  });

  it("registers a participant with no email keyed by name", () => {
    const dave = result.participants.find((p) => p.name === "Dave Friend");
    expect(dave).toBeDefined();
    expect(dave?.email).toBeUndefined();
    expect(dave?.key).toBe("name:Dave Friend");
  });
});

describe("parseGoogleChat — tolerance", () => {
  it("merges participants across multiple files by email", () => {
    const result = parseGoogleChat([
      { content: multiPartySpace, spaceName: "Space" },
      { content: dmRaw, spaceName: "DM" },
    ]);
    const alice = result.participants.find((p) => p.key === "email:alice@example.com");
    // 3 (space) + 1 (dm) = 4
    expect(alice?.count).toBe(4);
    expect(result.conversations).toHaveLength(2);
  });

  it("does not throw on unparseable JSON and skips it", () => {
    const result = parseGoogleChat([{ content: "{not valid json" }]);
    expect(result.conversations).toHaveLength(0);
    expect(result.participants).toHaveLength(0);
  });

  it("skips conversations with no usable turns", () => {
    const result = parseGoogleChat([{ content: { messages: [{ creator: {} }] } }]);
    expect(result.conversations).toHaveLength(0);
  });

  it("accepts a bare array of messages", () => {
    const result = parseGoogleChat([
      { content: [{ creator: { name: "X" }, text: "hi" }] },
    ]);
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0].turns[0].sender).toBe("X");
  });
});
