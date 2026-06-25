import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  JsonValue,
  humanizeKey,
  isEmptyValue,
  type EvidenceMap,
} from "./json-view";

function render(value: unknown, map: EvidenceMap = new Map()): string {
  return renderToStaticMarkup(createElement(JsonValue, { value, map }));
}

describe("humanizeKey", () => {
  it("converts snake_case and camelCase to a humanized label", () => {
    expect(humanizeKey("voice_features")).toBe("Voice features");
    expect(humanizeKey("close_friends")).toBe("Close friends");
    expect(humanizeKey("improvementTrend")).toBe("Improvement trend");
  });
});

describe("isEmptyValue", () => {
  it("treats null/undefined/blank/[]/{} and recursively-empty as empty", () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue("")).toBe(true);
    expect(isEmptyValue("  ")).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue({})).toBe(true);
    expect(isEmptyValue({ a: "", b: [] })).toBe(true);
    expect(isEmptyValue("x")).toBe(false);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue({ a: "x" })).toBe(false);
  });
});

describe("JsonValue", () => {
  it("renders scalars as text", () => {
    expect(render("hello")).toContain("hello");
    expect(render(42)).toContain("42");
    expect(render(true)).toContain("Yes");
  });

  it("renders an array of scalars as a bullet list", () => {
    const html = render(["one", "two"]);
    expect(html).toContain("<ul");
    expect(html).toContain("one");
    expect(html).toContain("two");
  });

  it("renders nested objects and arrays-of-objects without crashing", () => {
    const value = {
      register: { default: "informal", close_friends: "casual" },
      voice_features: [
        { feature: "Uses Swedish for coordination.", examples: ["Kan du"] },
      ],
      improvement_trend: "unknown",
      confidence: 0.82,
    };
    const html = render(value);
    expect(html).not.toContain("[object Object]");
    expect(html).toContain("Register");
    expect(html).toContain("informal");
    expect(html).toContain("Voice features");
    expect(html).toContain("Uses Swedish for coordination.");
    expect(html).toContain("Kan du");
    expect(html).toContain("confidence 0.82");
  });

  it("special-cases evidence_ids to known evidence claims, dropping unknown ids", () => {
    const map: EvidenceMap = new Map([["ev_a", { claim: "User is direct" }]]);
    const html = render(
      { style_summary: "Direct", evidence_ids: ["ev_a", "ev_missing"] },
      map,
    );
    expect(html).toContain("User is direct");
    expect(html).not.toContain("ev_missing");
    expect(html).toContain("Evidence");
  });

  it("hides empty values", () => {
    expect(render({ a: "", b: [], c: null })).toBe("");
    expect(render([])).toBe("");
  });
});
