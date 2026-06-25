import { describe, expect, it } from "vitest";
import { dedupeEvidence } from "./evidence";

describe("dedupeEvidence", () => {
  it("keeps all items when nothing matches", () => {
    const { keep, skipped } = dedupeEvidence(new Set(), [
      { evidenceText: "alpha" },
      { evidenceText: "beta" },
    ]);
    expect(keep).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  it("drops items whose normalized text already exists in the project", () => {
    const existing = new Set(["already here"]);
    const { keep, skipped } = dedupeEvidence(existing, [
      { evidenceText: "already here" },
      { evidenceText: "new one" },
    ]);
    expect(keep.map((k) => k.evidenceText)).toEqual(["new one"]);
    expect(skipped).toBe(1);
  });

  it("dedupes duplicates within the incoming batch", () => {
    const { keep, skipped } = dedupeEvidence(new Set(), [
      { evidenceText: "same quote" },
      { evidenceText: "same quote" },
      { evidenceText: "other" },
    ]);
    expect(keep.map((k) => k.evidenceText)).toEqual(["same quote", "other"]);
    expect(skipped).toBe(1);
  });

  it("matches whitespace-insensitively (normalizeForHash)", () => {
    const existing = new Set(["line one\nline two"]);
    const { keep, skipped } = dedupeEvidence(existing, [
      { evidenceText: "line one  \r\nline two\r\n" },
    ]);
    expect(keep).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("preserves the original (un-normalized) evidenceText on kept items", () => {
    const { keep } = dedupeEvidence(new Set(), [
      { evidenceText: "  spaced text  " },
    ]);
    expect(keep[0].evidenceText).toBe("  spaced text  ");
  });
});
