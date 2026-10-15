import { describe, expect, it } from "vitest";
import { formatVersion } from "./version";

describe("formatVersion", () => {
  it("joins sha and date", () => {
    expect(formatVersion("a1b2c3d", "2026-10-16")).toBe("a1b2c3d · 2026-10-16");
  });
  it("omits a missing date", () => {
    expect(formatVersion("a1b2c3d", "")).toBe("a1b2c3d");
    expect(formatVersion("a1b2c3d")).toBe("a1b2c3d");
  });
  it("handles unknown or missing sha", () => {
    expect(formatVersion("unknown", "2026-10-16")).toBe("unknown");
    expect(formatVersion(undefined, undefined)).toBe("unknown");
  });
});
