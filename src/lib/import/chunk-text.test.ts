import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk-text";

describe("chunkText", () => {
  it("small text yields exactly one chunk with part/partsTotal 1", () => {
    const text = "line one\nline two\nline three";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].part).toBe(1);
    expect(chunks[0].partsTotal).toBe(1);
    expect(chunks[0].content).toBe(text);
  });

  it("empty text yields no chunks", () => {
    expect(chunkText("")).toHaveLength(0);
  });

  it("whitespace-only text yields no chunks", () => {
    expect(chunkText("   \n\n  \t  \n")).toHaveLength(0);
  });

  it("splits into multiple chunks respecting the budget, only on line boundaries", () => {
    // Each line is 200 chars. Target 500 → ~3 lines per chunk.
    const line = "x".repeat(200);
    const lines = Array.from({ length: 10 }, () => line);
    const text = lines.join("\n");

    const chunks = chunkText(text, { targetChars: 500, maxChars: 800 });

    expect(chunks.length).toBeGreaterThan(1);
    // partsTotal stamped consistently; parts are 1..N in order.
    expect(chunks.every((c) => c.partsTotal === chunks.length)).toBe(true);
    expect(chunks.map((c) => c.part)).toEqual(chunks.map((_, i) => i + 1));

    // Budget respected: no chunk exceeds maxChars.
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(800);
    }

    // Every line in every chunk is a complete 200-char line (no fragment).
    for (const c of chunks) {
      for (const l of c.content.split("\n")) {
        expect(l).toBe(line);
      }
    }
  });

  it("never splits a single line — an oversized line becomes its own chunk", () => {
    const huge = "y".repeat(50_000); // bigger than maxChars
    const text = ["first small", huge, "after the giant"].join("\n");

    const chunks = chunkText(text, { targetChars: 12_000, maxChars: 20_000 });

    // The giant line is intact in exactly one chunk, standing alone.
    const giantChunks = chunks.filter((c) => c.content.includes(huge));
    expect(giantChunks).toHaveLength(1);
    expect(giantChunks[0].content).toBe(huge);
  });

  it("preserves all text across chunks — content round-trips with no loss", () => {
    const lines = Array.from({ length: 500 }, (_, i) => `line ${i} ${"a".repeat(60)}`);
    const text = lines.join("\n");

    const chunks = chunkText(text, { targetChars: 1_000, maxChars: 1_500 });
    expect(chunks.length).toBeGreaterThan(1);

    // Rejoin chunks with "\n" between them → exactly the original text.
    const rejoined = chunks.map((c) => c.content).join("\n");
    expect(rejoined).toBe(text);
  });

  it("large whitespace-only text still yields no chunks", () => {
    const blob = " \n\t \n".repeat(10_000); // > 20k chars, all whitespace
    expect(blob.length).toBeGreaterThan(20_000);
    expect(chunkText(blob)).toHaveLength(0);
  });

  it("a single line under target is one chunk even when long", () => {
    const text = "z".repeat(15_000); // > target (12k) but < max (20k), no newline
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
  });
});
