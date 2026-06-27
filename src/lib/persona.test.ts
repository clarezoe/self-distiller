import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPersonaToken, parseBearer, personaETag, toSystemPrompt } from "./persona";
import { emptySelfModel, type SelfModelJson } from "./self-model/schema";

describe("parseBearer", () => {
  it("extracts a non-empty Bearer token", () => {
    expect(parseBearer("Bearer abc123")).toBe("abc123");
    expect(parseBearer("Bearer  spaced ")).toBe("spaced");
  });

  it("returns null for missing / malformed / empty headers", () => {
    expect(parseBearer(null)).toBe(null);
    expect(parseBearer("abc123")).toBe(null); // no Bearer prefix
    expect(parseBearer("Bearer ")).toBe(null); // empty token
    expect(parseBearer("Bearer    ")).toBe(null); // whitespace only
  });
});

describe("hashPersonaToken", () => {
  it("is a stable sha256 hex of the token (never the plaintext)", () => {
    const token = "my-secret-token";
    const expected = createHash("sha256").update(token, "utf8").digest("hex");
    expect(hashPersonaToken(token)).toBe(expected);
    expect(hashPersonaToken(token)).toHaveLength(64);
    expect(hashPersonaToken(token)).not.toContain(token);
  });

  it("differs for different tokens", () => {
    expect(hashPersonaToken("a")).not.toBe(hashPersonaToken("b"));
  });
});

describe("personaETag", () => {
  it("builds a weak tag from version + createdAt epoch", () => {
    const createdAt = new Date("2026-06-27T00:00:00.000Z");
    expect(personaETag({ version: "0.2", createdAt })).toBe(
      `W/"v0.2-${createdAt.getTime()}"`,
    );
  });

  it("changes when the version or timestamp changes", () => {
    const a = personaETag({ version: "0.1", createdAt: new Date(1000) });
    const b = personaETag({ version: "0.2", createdAt: new Date(1000) });
    const c = personaETag({ version: "0.1", createdAt: new Date(2000) });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("toSystemPrompt", () => {
  it("renders the framing header and an empty-model fallback identity", () => {
    const prompt = toSystemPrompt(emptySelfModel("0.1"));
    expect(prompt).toContain("# Persona: write AS this person");
    expect(prompt).toContain("You ARE the specific person this persona models.");
    expect(prompt).toContain("Write as the user, not as an assistant.");
    expect(prompt.endsWith("\n")).toBe(true);
    expect(prompt).not.toMatch(/\n{3,}/);
  });

  it("renders identity, core self, contexts, and boundaries", () => {
    const model: SelfModelJson = {
      version: "0.2",
      core_self: {
        identity: ["a content creator", "a founder"],
        values: ["Directness", "Honesty"],
        stable_dislikes: ["Marketing fluff"],
      },
      language_models: {
        zh: { voice_summary: "Short, direct, warm", tone_patterns: ["casual"] },
      },
      role_models: {
        boss: { style_summary: "Direct but not harsh", evidence_ids: ["ev_1"] },
      },
      relationship_models: {
        close_friend: { style_summary: "Short replies", emoji_policy: "preserve" },
      },
      scene_models: {
        comforting: { default_intent: "Validate then re-frame" },
      },
      current_state: { recent_changes: ["busier lately"] },
      boundaries: { sensitive_topics: ["breakups"], must_not_invent: ["job titles"] },
      unknowns: [],
    };

    const prompt = toSystemPrompt(model);
    expect(prompt).toContain("You ARE a content creator, a founder.");
    expect(prompt).toContain("**Values:**");
    expect(prompt).toContain("- Directness");
    expect(prompt).toContain("## How you write per language");
    expect(prompt).toContain("### zh");
    expect(prompt).toContain("Short, direct, warm");
    expect(prompt).toContain("### boss");
    expect(prompt).toContain("**Evidence:** ev_1");
    expect(prompt).toContain("### close_friend");
    expect(prompt).toContain("### comforting");
    expect(prompt).toContain("temporary");
    expect(prompt).toContain("busier lately");
    expect(prompt).toContain("## Hard boundaries (never violate)");
    expect(prompt).toContain("breakups");
    expect(prompt).toContain("job titles");
  });

  it("renders open-ended nested shapes without [object Object]", () => {
    const model = {
      ...emptySelfModel("0.3"),
      language_models: {
        sv: {
          register: {
            default: "informal, practical",
            close_friends: "casual Swedish with emoji",
          },
          voice_features: [
            {
              feature: "Uses Swedish for everyday coordination.",
              examples: ["Kan du ta honom i selen"],
              evidence_ids: ["ev_a"],
            },
          ],
          confidence: 0.82,
        },
      },
    } as unknown as SelfModelJson;

    const prompt = toSystemPrompt(model);
    expect(prompt).not.toContain("[object Object]");
    expect(prompt).toContain("### sv");
    expect(prompt).toContain("**Register:**");
    expect(prompt).toContain("**Default:** informal, practical");
    expect(prompt).toContain("**Voice features:**");
    expect(prompt).toContain("Uses Swedish for everyday coordination.");
    expect(prompt).toContain("Kan du ta honom i selen");
    expect(prompt).toContain("**Confidence:** 0.82");
  });
});
