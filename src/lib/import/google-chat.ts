// Pure parser for Google Chat Takeout exports.
//
// Documented layout: Takeout/Google Chat/Groups/<space>/messages.json
// (+ group_info.json). Each messages.json ≈
//   { messages: [{ creator: { name, email, user_type }, created_date, text, ... }] }
//
// Fields vary across exports (DM vs space, missing email, alternate date keys,
// attachment-only / system messages). This parser is intentionally TOLERANT:
// it accepts parsed objects or raw JSON strings, skips messages with no usable
// text, dedupes participants by email||name, and never throws on a single bad
// message. Verify against a real export when one lands — the real Takeout
// shape may differ from the documented one.
//
// PURE: no DB, no IO. Input is the content of one or more messages.json files.

export type ParsedTurn = {
  /** Display name (or email, or "Unknown") of the speaker. */
  sender: string;
  /** Speaker email when present — used as the stable identity key. */
  email?: string;
  /**
   * Canonical participant key for this turn (same value as the matching
   * ParsedParticipant.key). Owner detection compares against THIS, never a
   * value re-derived from `sender` — `sender` is a lossy display label.
   */
  key: string;
  text: string;
  /** ISO-ish timestamp when one could be parsed from the message. */
  ts?: string;
};

export type ParsedParticipant = {
  name: string;
  email?: string;
  count: number;
  /** Stable identity key (email when present, else name) used to mark "me". */
  key: string;
};

export type ParsedConversation = {
  spaceName?: string;
  dateRange: { from?: string; to?: string };
  turns: ParsedTurn[];
};

export type ParsedGoogleChat = {
  participants: ParsedParticipant[];
  conversations: ParsedConversation[];
};

/** A single messages.json file's content, plus optional space label. */
export type GoogleChatFileInput = {
  /** Raw JSON string or already-parsed JSON object. */
  content: string | unknown;
  /** Optional space/conversation name (e.g. derived from the folder path). */
  spaceName?: string;
};

export function participantKey(name: string | undefined, email: string | undefined): string {
  const e = (email ?? "").trim().toLowerCase();
  if (e) return `email:${e}`;
  const n = (name ?? "").trim();
  if (n) return `name:${n}`;
  return "unknown";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string | undefined {
  if (typeof value === "string") {
    const t = value.trim();
    return t ? t : undefined;
  }
  return undefined;
}

// Pull the list of message objects out of a tolerant range of shapes:
//   { messages: [...] }  |  [...]  |  { Messages: [...] }
function extractMessages(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  const rec = asRecord(parsed);
  if (!rec) return [];
  const candidate = rec.messages ?? rec.Messages ?? rec.message;
  return Array.isArray(candidate) ? candidate : [];
}

// Creator can be { name, email, user_type } or a bare string, under a few keys.
function extractCreator(msg: Record<string, unknown>): { name?: string; email?: string } {
  const creator = msg.creator ?? msg.sender ?? msg.author ?? msg.from;
  const rec = asRecord(creator);
  if (rec) {
    return {
      name: str(rec.name) ?? str(rec.display_name) ?? str(rec.displayName),
      email: str(rec.email) ?? str(rec.email_address) ?? str(rec.emailAddress),
    };
  }
  // Bare-string creator (rare/legacy).
  const bare = str(creator);
  if (bare) return { name: bare };
  return {};
}

function extractText(msg: Record<string, unknown>): string | undefined {
  return (
    str(msg.text) ??
    str(msg.message_text) ??
    str(msg.content) ??
    str(msg.body)
  );
}

function extractTimestamp(msg: Record<string, unknown>): string | undefined {
  return (
    str(msg.created_date) ??
    str(msg.createdDate) ??
    str(msg.created) ??
    str(msg.timestamp) ??
    str(msg.date)
  );
}

function parseFile(input: GoogleChatFileInput): { parsed: unknown; spaceName?: string } {
  const { content, spaceName } = input;
  if (typeof content === "string") {
    try {
      return { parsed: JSON.parse(content), spaceName };
    } catch {
      // Unparseable file → no messages, but do not crash the whole import.
      return { parsed: null, spaceName };
    }
  }
  return { parsed: content, spaceName };
}

/**
 * Parse one or more Google Chat Takeout `messages.json` files.
 * Each file becomes one conversation (a space / DM).
 */
export function parseGoogleChat(files: GoogleChatFileInput[]): ParsedGoogleChat {
  const conversations: ParsedConversation[] = [];
  // key -> participant aggregate, merged across all conversations.
  const participants = new Map<string, ParsedParticipant>();

  for (const file of files) {
    const { parsed, spaceName } = parseFile(file);
    const messages = extractMessages(parsed);

    const turns: ParsedTurn[] = [];
    let from: string | undefined;
    let to: string | undefined;

    for (const raw of messages) {
      const msg = asRecord(raw);
      if (!msg) continue;

      const text = extractText(msg);
      if (!text) continue; // skip attachment-only / system / empty messages

      const { name, email } = extractCreator(msg);
      const displayName = name ?? email ?? "Unknown";
      const key = participantKey(name, email);
      const ts = extractTimestamp(msg);

      turns.push({ sender: displayName, email, key, text, ts });

      if (ts) {
        if (!from) from = ts;
        to = ts;
      }

      const existing = participants.get(key);
      if (existing) {
        existing.count += 1;
        // Prefer a real name/email if we only had a fallback before.
        if (!existing.email && email) existing.email = email;
        if ((existing.name === "Unknown" || !existing.name) && name) existing.name = name;
      } else {
        participants.set(key, {
          name: displayName,
          email,
          count: 1,
          key,
        });
      }
    }

    // Skip conversations that yielded no usable turns.
    if (turns.length === 0) continue;

    conversations.push({
      spaceName,
      dateRange: { from, to },
      turns,
    });
  }

  return {
    participants: [...participants.values()].sort((a, b) => b.count - a.count),
    conversations,
  };
}
