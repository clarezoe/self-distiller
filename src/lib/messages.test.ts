import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";

describe("messages", () => {
  it("has the short mobile interview label in en and zh", () => {
    expect(en.nav.interviewShort).toBe("Interview");
    expect(zh.nav.interviewShort).toBe("访谈");
  });
});
