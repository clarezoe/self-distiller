import { describe, expect, it } from "vitest";
import { contentHash, normalizeForHash } from "./hash";

describe("normalizeForHash", () => {
  it("normalizes CRLF and CR to LF", () => {
    expect(normalizeForHash("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("strips trailing whitespace on each line", () => {
    expect(normalizeForHash("a  \nb\t\nc")).toBe("a\nb\nc");
  });

  it("trims overall leading/trailing whitespace", () => {
    expect(normalizeForHash("\n\n  hello  \n\n")).toBe("hello");
  });
});

describe("contentHash", () => {
  it("is stable for the same input", () => {
    expect(contentHash("hello world")).toBe(contentHash("hello world"));
  });

  it("is whitespace-insensitive per normalizeForHash", () => {
    expect(contentHash("line one\nline two")).toBe(
      contentHash("line one  \r\nline two\r\n"),
    );
  });

  it("differs for different content", () => {
    expect(contentHash("alpha")).not.toBe(contentHash("beta"));
  });

  it("returns a 64-char hex sha256 digest", () => {
    expect(contentHash("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});
