import { describe, expect, it } from "vitest";
import { nextVersion } from "./version-bump";

describe("nextVersion", () => {
  it("starts at 0.1 when there is no prior version", () => {
    expect(nextVersion()).toBe("0.1");
    expect(nextVersion(null)).toBe("0.1");
    expect(nextVersion("")).toBe("0.1");
  });

  it("increments the minor version", () => {
    expect(nextVersion("0.1")).toBe("0.2");
    expect(nextVersion("0.5")).toBe("0.6");
    expect(nextVersion("2.3")).toBe("2.4");
  });

  it("rolls minor 9 over to the next major", () => {
    expect(nextVersion("0.9")).toBe("1.0");
    expect(nextVersion("1.9")).toBe("2.0");
  });

  it("trims whitespace", () => {
    expect(nextVersion("  0.1 ")).toBe("0.2");
  });

  it("falls back to 0.1 on malformed input", () => {
    expect(nextVersion("garbage")).toBe("0.1");
    expect(nextVersion("1")).toBe("0.1");
    expect(nextVersion("1.2.3")).toBe("0.1");
  });
});
