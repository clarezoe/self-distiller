import { describe, expect, it } from "vitest";
import { conversationToContent, isKnownOwner } from "./import-google-chat";
import {
  participantKey,
  type ParsedConversation,
  type ParsedGoogleChat,
} from "@/lib/import/google-chat";

const conversation: ParsedConversation = {
  spaceName: "DM with Dave",
  dateRange: { from: "2024-02-02T10:00:00Z", to: "2024-02-02T10:01:00Z" },
  turns: [
    {
      sender: "Alice Owner",
      email: "alice@example.com",
      key: participantKey("Alice Owner", "alice@example.com"),
      text: "Are you free later?",
    },
    {
      sender: "Dave Friend",
      key: participantKey("Dave Friend", undefined),
      text: "Yep, after 3.",
    },
    {
      sender: "Alice Owner",
      email: "alice@example.com",
      key: participantKey("Alice Owner", "alice@example.com"),
      text: "Great, see you then.",
    },
  ],
};

describe("conversationToContent", () => {
  it("labels the owner's lines as me: and others by name", () => {
    const ownerKey = participantKey("Alice Owner", "alice@example.com");
    const content = conversationToContent(conversation, ownerKey);
    expect(content).toBe(
      ["me: Are you free later?", "Dave Friend: Yep, after 3.", "me: Great, see you then."].join("\n"),
    );
  });

  it("does not treat other participants as the owner when ownerKey is someone else", () => {
    const ownerKey = participantKey("Dave Friend", undefined);
    const content = conversationToContent(conversation, ownerKey);
    expect(content).toContain("me: Yep, after 3.");
    expect(content).toContain("Alice Owner: Are you free later?");
    // Alice's lines must NOT be labeled me when Dave is the owner.
    expect(content).not.toContain("me: Are you free later?");
  });

  it("uses the turn's canonical key, not a key re-derived from sender", () => {
    // Owner has an email but its display sender is the email string. The owner
    // key must still match via the stored turn.key.
    const emailOnly: ParsedConversation = {
      dateRange: {},
      turns: [
        {
          sender: "owner@example.com",
          email: "owner@example.com",
          key: participantKey(undefined, "owner@example.com"),
          text: "mine",
        },
        {
          sender: "Friend",
          key: participantKey("Friend", undefined),
          text: "theirs",
        },
      ],
    };
    const ownerKey = participantKey(undefined, "owner@example.com");
    const content = conversationToContent(emailOnly, ownerKey);
    expect(content).toBe(["me: mine", "Friend: theirs"].join("\n"));
  });
});

describe("isKnownOwner", () => {
  const parsed: ParsedGoogleChat = {
    participants: [
      { name: "Alice", email: "alice@example.com", count: 3, key: "email:alice@example.com" },
      { name: "Dave Friend", count: 1, key: "name:Dave Friend" },
    ],
    conversations: [],
  };

  it("accepts an ownerKey that matches a parsed participant", () => {
    expect(isKnownOwner(parsed, "email:alice@example.com")).toBe(true);
    expect(isKnownOwner(parsed, "name:Dave Friend")).toBe(true);
  });

  it("rejects a stale / bogus ownerKey not present in the export", () => {
    // Guards against a style-less material where nothing is labeled `me:`.
    expect(isKnownOwner(parsed, "email:someone-else@example.com")).toBe(false);
    expect(isKnownOwner(parsed, "")).toBe(false);
  });
});
