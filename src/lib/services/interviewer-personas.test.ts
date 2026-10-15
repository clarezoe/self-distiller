import { describe, expect, it } from "vitest";
import { mergePersonaUpdate, normalizePersonaInput, parseDistillMode, validateVoiceSamples } from "./interviewer-personas";

// The Prisma-backed list/create/delete are all scoped by `projectId` in their `where`/`data`
// (the caller passes a user-owned projectId via getActiveProject/getProjectForUser), so a
// persona never crosses tenants. Here we pin the pure input normalization/validation.

describe("normalizePersonaInput", () => {
  it("trims name, description, and relationship", () => {
    const r = normalizePersonaInput({ name: "  Blunt cofounder  ", description: "  direct  ", relationship: "  cofounder  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Blunt cofounder");
      expect(r.value.description).toBe("direct");
      expect(r.value.relationship).toBe("cofounder");
    }
  });

  it("treats blank/missing relationship as null", () => {
    const r = normalizePersonaInput({ name: "Coach", description: "warm and curious" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.relationship).toBeNull();
    const blank = normalizePersonaInput({ name: "Coach", description: "warm", relationship: "   " });
    expect(blank.ok).toBe(true);
    if (blank.ok) expect(blank.value.relationship).toBeNull();
  });

  it("rejects an empty name", () => {
    const r = normalizePersonaInput({ name: "   ", description: "something" });
    expect(r.ok).toBe(false);
  });

  it("rejects an empty description", () => {
    const r = normalizePersonaInput({ name: "Coach", description: "  " });
    expect(r.ok).toBe(false);
  });

  it("rejects an over-long name", () => {
    const r = normalizePersonaInput({ name: "x".repeat(81), description: "ok" });
    expect(r.ok).toBe(false);
  });

  it("rejects an over-long description", () => {
    const r = normalizePersonaInput({ name: "Coach", description: "x".repeat(2001) });
    expect(r.ok).toBe(false);
  });
});

describe("validateVoiceSamples", () => {
  it("rejects missing, too-short, and too-long samples", () => {
    expect(validateVoiceSamples(undefined).ok).toBe(false);
    expect(validateVoiceSamples("   ").ok).toBe(false);
    expect(validateVoiceSamples("x".repeat(199)).ok).toBe(false);
    expect(validateVoiceSamples("x".repeat(20001)).ok).toBe(false);
  });

  it("accepts and trims valid samples", () => {
    const r = validateVoiceSamples("  " + "x".repeat(200) + "  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("x".repeat(200));
  });
});

describe("parseDistillMode", () => {
  it("defaults to replace and validates", () => {
    expect(parseDistillMode(undefined)).toEqual({ ok: true, value: "replace" });
    expect(parseDistillMode("add")).toEqual({ ok: true, value: "add" });
    expect(parseDistillMode("replace")).toEqual({ ok: true, value: "replace" });
    expect(parseDistillMode("merge").ok).toBe(false);
    expect(parseDistillMode(5).ok).toBe(false);
  });
});

describe("mergePersonaUpdate", () => {
  const cur = { name: "Coach", description: "warm", relationship: "mentor" };

  it("keeps current values for omitted fields", () => {
    const r = mergePersonaUpdate(cur, { description: "  blunt  " });
    expect(r).toEqual({ ok: true, value: { name: "Coach", description: "blunt", relationship: "mentor" } });
  });

  it("clears relationship when given blank or null", () => {
    for (const rel of ["", "  ", null]) {
      const r = mergePersonaUpdate(cur, { relationship: rel });
      expect(r.ok && r.value.relationship).toBe(null);
    }
  });

  it("rejects blank name and overlong description", () => {
    expect(mergePersonaUpdate(cur, { name: "  " }).ok).toBe(false);
    expect(mergePersonaUpdate(cur, { description: "x".repeat(2001) }).ok).toBe(false);
  });
});
