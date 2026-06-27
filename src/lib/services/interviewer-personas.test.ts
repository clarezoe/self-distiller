import { describe, expect, it } from "vitest";
import { normalizePersonaInput } from "./interviewer-personas";

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
