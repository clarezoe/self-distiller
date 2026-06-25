// Chunk a generic block of pasted/uploaded plain text into per-material slices.
//
// Why: the plain-text Import path (paste or .txt/.md upload) used to store the
// whole blob as ONE RawMaterial. A 1.1MB MY_MESSAGES.txt (~280k tokens) then
// blew past the LLM context window and Analyze returned a 502. So we split big
// text into chunks with a target character budget, ONLY on line boundaries
// (never mid-line — a single line is the smallest unit and stays intact).
//
// Mirrors the boundary/budget logic of `chunk.ts` (the conversation chunker),
// but operates on raw "\n"-delimited lines instead of labeled turns.
//
// PURE: no DB, no IO. Unit-tested.

export type ChunkedText = {
  /** The lines of this chunk, rejoined by "\n". */
  content: string;
  /** 1-based index of this chunk within the text. */
  part: number;
  /** Total number of chunks the text produced. */
  partsTotal: number;
};

export type ChunkTextOptions = {
  /** Soft target: start a new chunk once a chunk reaches this many chars. */
  targetChars?: number;
  /** Hard ceiling: a chunk is forced to close near here (a single oversized line may exceed it alone). */
  maxChars?: number;
};

const DEFAULT_TARGET = 12_000;
const DEFAULT_MAX = 20_000;

/**
 * Split raw text into chunks. Each chunk's `content` is its lines rejoined by
 * newline. Splitting happens only between lines:
 * - A line is added to the current chunk if it still fits under `maxChars`.
 * - Once the current chunk reaches `targetChars`, the next line starts a new chunk.
 * - A single line longer than `maxChars` becomes its own chunk (never split mid-line).
 *
 * Small text (≤ target) yields exactly one chunk. Empty / whitespace-only text
 * yields zero chunks (the caller decides how to handle that).
 *
 * No text is lost: concatenating every chunk's content with "\n" between chunks
 * reproduces the original line sequence (trailing/leading whitespace-only lines
 * are preserved; a fully blank input is the only case that yields nothing).
 */
export function chunkText(text: string, opts: ChunkTextOptions = {}): ChunkedText[] {
  const targetChars = opts.targetChars ?? DEFAULT_TARGET;
  const maxChars = opts.maxChars ?? DEFAULT_MAX;

  // Nothing meaningful to chunk.
  if (!text.trim()) return [];

  const lines = text.split("\n");

  type Acc = { lines: string[]; chars: number };
  const chunks: Acc[] = [];
  let current: Acc | null = null;

  for (const line of lines) {
    // Cost of appending this line to the current chunk (account for the "\n").
    const addedCost =
      current && current.lines.length > 0 ? line.length + 1 : line.length;

    if (current) {
      const overMax = current.chars + addedCost > maxChars;
      const atTarget = current.chars >= targetChars;
      // Close the current chunk before adding when it would blow past max, or it
      // already met the soft target. An empty current chunk always takes the
      // line (so an oversized single line lands in its own chunk, not an extra).
      if (current.lines.length > 0 && (overMax || atTarget)) {
        chunks.push(current);
        current = null;
      }
    }

    if (!current) current = { lines: [], chars: 0 };
    current.lines.push(line);
    current.chars += current.lines.length > 1 ? line.length + 1 : line.length;
  }

  if (current && current.lines.length > 0) chunks.push(current);

  const partsTotal = chunks.length;
  return chunks.map((acc, i) => ({
    content: acc.lines.join("\n"),
    part: i + 1,
    partsTotal,
  }));
}
