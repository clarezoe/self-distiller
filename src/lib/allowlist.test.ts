import { describe, expect, it } from "vitest";
import { isAllowedEmail, parseAllowlist, DEFAULT_ALLOWLIST } from "@/lib/allowlist";

describe("parseAllowlist", () => {
  it("falls back to the default when env is undefined or empty", () => {
    expect(parseAllowlist(undefined)).toEqual([DEFAULT_ALLOWLIST]);
    expect(parseAllowlist("")).toEqual([DEFAULT_ALLOWLIST]);
  });

  it("splits, trims, and lowercases", () => {
    expect(parseAllowlist(" A@X.com , B@Y.com ")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("drops empty entries", () => {
    expect(parseAllowlist("a@x.com,,")).toEqual(["a@x.com"]);
  });
});

describe("isAllowedEmail", () => {
  const allow = "clarezoe@gmx.com, owner@distill.me";

  it("allows a listed email case-insensitively", () => {
    expect(isAllowedEmail("clarezoe@gmx.com", allow)).toBe(true);
    expect(isAllowedEmail("Clarezoe@GMX.com", allow)).toBe(true);
    expect(isAllowedEmail("  owner@distill.me  ", allow)).toBe(true);
  });

  it("rejects an unlisted email", () => {
    expect(isAllowedEmail("intruder@evil.com", allow)).toBe(false);
  });

  it("rejects falsy / empty emails", () => {
    expect(isAllowedEmail(null, allow)).toBe(false);
    expect(isAllowedEmail(undefined, allow)).toBe(false);
    expect(isAllowedEmail("", allow)).toBe(false);
    expect(isAllowedEmail("   ", allow)).toBe(false);
  });

  it("uses the default allowlist when env is unset", () => {
    expect(isAllowedEmail("clarezoe@gmx.com", undefined)).toBe(true);
    expect(isAllowedEmail("someone@else.com", undefined)).toBe(false);
  });
});
