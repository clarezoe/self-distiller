import { describe, expect, it } from "vitest";
import { EVIDENCE_EXTRACTION_SCHEMA } from "./import-analyzer";

// OpenAI Structured Outputs strict-mode subset: every object lists all of its
// properties in `required`, sets additionalProperties:false, and uses no
// unsupported validation keywords (minItems/maxItems/minLength/...).
// analyzeMaterial sends this schema with the default strict:true, so it MUST comply.
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
