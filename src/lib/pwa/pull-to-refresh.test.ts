import { describe, expect, it } from "vitest";
import { PULL_MAX, PULL_THRESHOLD, pullDistance, pullReady } from "./pull-to-refresh";

describe("pull-to-refresh math", () => {
  it("ignores upward or invalid movement", () => {
    expect(pullDistance(-50)).toBe(0);
    expect(pullDistance(0)).toBe(0);
    expect(pullDistance(NaN)).toBe(0);
  });
  it("applies resistance", () => {
    expect(pullDistance(100)).toBe(50);
  });
  it("caps the distance", () => {
    expect(pullDistance(10000)).toBe(PULL_MAX);
  });
  it("triggers at the threshold only", () => {
    expect(pullReady(PULL_THRESHOLD - 1)).toBe(false);
    expect(pullReady(PULL_THRESHOLD)).toBe(true);
    expect(pullReady(pullDistance(139))).toBe(false);
    expect(pullReady(pullDistance(140))).toBe(true);
  });
});
