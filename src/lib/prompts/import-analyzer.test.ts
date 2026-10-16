import { describe, expect, it } from "vitest";
import {
  buildImportAnalyzerMessages,
  EVIDENCE_EXTRACTION_SCHEMA,
  materialRelationshipHint,
  relationshipHint,
} from "./import-analyzer";

// OpenAI Structured Outputs strict-mode subset: every object lists all of its
// properties in `required`, sets additionalProperties:false, and uses no
// unsupported validation keywords (minItems/maxItems/minLength/...).
const UNSUPPORTED_KEYWORDS = [
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "pattern",
  "format",
];

function assertStrictCompatible(node: unknown, path = "root"): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  for (const kw of UNSUPPORTED_KEYWORDS) {
    expect(obj[kw], `${path} must not use unsupported keyword "${kw}"`).toBeUndefined();
  }

  if (obj.type === "object") {
    expect(obj.additionalProperties, `${path} must set additionalProperties:false`).toBe(false);
    const props = (obj.properties ?? {}) as Record<string, unknown>;
    const required = (obj.required ?? []) as string[];
    const propKeys = Object.keys(props);
    expect(
      [...propKeys].sort(),
      `${path}: every property must be required in strict mode`,
    ).toEqual([...propKeys].sort().filter((k) => required.includes(k)));
    expect(propKeys.length, `${path}: required count must equal property count`).toBe(
      required.length,
    );
    for (const [k, v] of Object.entries(props)) assertStrictCompatible(v, `${path}.${k}`);
  }

  if (obj.type === "array") {
    assertStrictCompatible(obj.items, `${path}[]`);
  }
}

describe("EVIDENCE_EXTRACTION_SCHEMA", () => {
  it("is OpenAI strict-mode compatible", () => {
    assertStrictCompatible(EVIDENCE_EXTRACTION_SCHEMA);
  });
});

describe("relationship hint", () => {
  it("keeps legacy plain-text materials unrestricted when no relationship is set", () => {
    expect(materialRelationshipHint({}, [])).toBeUndefined();
    expect(materialRelationshipHint({ source: "plain_text" }, [])).toBeUndefined();
  });
  it("keeps structured Google Chat owner-only when no relationship is set", () => {
    const hint = materialRelationshipHint({ source: "google_chat_takeout" }, []);
    expect(hint).toContain("Relationship not set");
    expect(hint).toContain("only the user's \"me:\" lines");
    expect(hint).toContain("ignore any relationship label embedded");
  });
  it("uses the current relationship for structured Google Chat", () => {
    expect(materialRelationshipHint({ source: "google_chat_takeout" }, ["Husband"])).toContain(
      "Relationship: Husband",
    );
  });
  it("is undefined without relationships for the generic helper", () => {
    expect(relationshipHint([])).toBeUndefined();
  });
  it("reaches the analyzer prompt", () => {
    const msgs = buildImportAnalyzerMessages({
      content: "me: hi",
      sourceType: "chat",
      contextHint: relationshipHint(["Husband"]),
    });
    expect(msgs[0].content).toContain("current \"Related context\" / relationship hint");
    expect(msgs[1].content).toContain("Relationship: Husband");
    expect(msgs[1].content).toContain("IN THIS RELATIONSHIP");
  });
  it("tells the analyzer that the current context overrides an embedded old label", () => {
    const msgs = buildImportAnalyzerMessages({
      content: "# Chat with Dave (Old relationship)\nme: hi",
      sourceType: "chat",
      contextHint: relationshipHint(["Husband"]),
    });
    expect(msgs[0].content).toContain("overrides any relationship label embedded in the material text");
    expect(msgs[1].content).toContain("Relationship: Husband");
  });
});
