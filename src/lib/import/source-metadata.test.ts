import { describe, expect, it } from "vitest";
import { safeHttpUrl, validateSourceMetadata } from "./source-metadata";

describe("source metadata", () => {
  it("caps size and shape", () => {
    expect(validateSourceMetadata({ a: 1 })).toBeNull();
    expect(validateSourceMetadata({ a: "x".repeat(4100) })).toMatch(/exceeds/);
    expect(validateSourceMetadata([])).not.toBeNull();
  });
  it("only links safe http(s) URLs", () => {
    expect(safeHttpUrl("https://a.com/x")).toBe("https://a.com/x");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
    expect(safeHttpUrl("https://user:password@a.com/x")).toBeNull();
    expect(safeHttpUrl(5)).toBeNull();
  });
});
