import { describe, expect, it } from "vitest";
import { languageLabel } from "./language-label";

describe("languageLabel", () => {
  it("labels known codes", () => {
    expect(languageLabel("zh")).toBe("中文 (zh)");
    expect(languageLabel("en")).toBe("English (en)");
    expect(languageLabel("sv")).toBe("Svenska (sv)");
    expect(languageLabel("sr")).toBe("Srpski (sr)");
  });
  it("returns unknown values as-is", () => {
    expect(languageLabel("Swedish chat")).toBe("Swedish chat");
    expect(languageLabel("")).toBe("");
  });
});
