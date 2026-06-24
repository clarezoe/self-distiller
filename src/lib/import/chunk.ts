// Chunk a parsed Google Chat conversation into per-material slices.
//
// Why: a single large DM (the real export's biggest is a 30MB messages.json)
// becomes one enormous `turns` array. Stored as ONE RawMaterial it is unusable
// for Analyze — far past the LLM context window. So we split each conversation
// into chunks with a target character budget, ONLY on turn boundaries (never
// mid-message — a single labeled line is the smallest unit and stays intact).
//
// PURE: no DB, no IO. Owner labeling matches `conversationToContent`: the
// owner's lines are labeled `me:` (the style signal), everyone else by sender.

import type { ParsedConversation, ParsedTurn } from "@/lib/import/google-chat";

export type ChunkedMaterial = {
  /** Labeled turns for this chunk, joined by "\n" (same format as a full material). */
  content: string;
  /** 1-based index of this chunk within the conversation. */
  part: number;
  /** Total number of chunks the conversation produced. */
  partsTotal: number;
  /** First/last timestamp seen within this chunk's turns (may be empty). */
  dateRange: { from?: string; to?: string };
  /** Number of turns in this chunk. */
  turnCount: number;
};

export type ChunkOptions = {
  /** Soft target: start a new chunk once a chunk reaches this many chars. */
  targetChars?: number;
  /** Hard ceiling: a chunk is forced to close near here (a single oversized turn may exceed it alone). */
  maxChars?: number;
};

const DEFAULT_TARGET = 12_000;
const DEFAULT_MAX = 20_000;

function labelTurn(turn: ParsedTurn, ownerKey: string): string {
  const label = turn.key === ownerKey ? "me" : turn.sender;
  return `${label}: ${turn.text}`;
}

/**
 * Split a conversation's turns into chunks. Each chunk's `content` is the
 * labeled turns joined by newline. Splitting happens only between turns:
 * - A turn is added to the current chunk if it still fits under `maxChars`.
 * - Once the current chunk reaches `targetChars`, the next turn starts a new chunk.
 * - A single turn longer than `maxChars` becomes its own chunk (never split mid-message).
 *
 * A small conversation yields exactly one chunk. An empty conversation yields none.
 */
export function chunkConversation(
  conversation: ParsedConversation,
  ownerKey: string,
  opts: ChunkOptions = {},
): ChunkedMaterial[] {
  const targetChars = opts.targetChars ?? DEFAULT_TARGET;
  const maxChars = opts.maxChars ?? DEFAULT_MAX;

  type Acc = { lines: string[]; chars: number; turns: ParsedTurn[] };
  const chunks: Acc[] = [];
  let current: Acc | null = null;

  for (const turn of conversation.turns) {
    const line = labelTurn(turn, ownerKey);
    // Cost of appending this line to the current chunk (account for the "\n").
    const addedCost = current && current.lines.length > 0 ? line.length + 1 : line.length;

    if (current) {
      const overMax = current.chars + addedCost > maxChars;
      const atTarget = current.chars >= targetChars;
      // Close the current chunk before adding when it would blow past max, or it
      // already met the soft target. An empty current chunk always takes the
      // turn (so an oversized single turn lands in its own chunk, not an extra).
      if (current.lines.length > 0 && (overMax || atTarget)) {
        chunks.push(current);
        current = null;
      }
    }

    if (!current) current = { lines: [], chars: 0, turns: [] };
    current.lines.push(line);
    current.chars += current.lines.length > 1 ? line.length + 1 : line.length;
    current.turns.push(turn);
  }

  if (current && current.lines.length > 0) chunks.push(current);

  const partsTotal = chunks.length;
  return chunks.map((acc, i) => {
    const stamped = acc.turns.map((t) => t.ts).filter((t): t is string => Boolean(t));
    return {
      content: acc.lines.join("\n"),
      part: i + 1,
      partsTotal,
      dateRange: { from: stamped[0], to: stamped[stamped.length - 1] },
      turnCount: acc.turns.length,
    };
  });
}
