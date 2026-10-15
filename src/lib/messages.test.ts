import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";

describe("messages", () => {
  it("has the short mobile interview label in en and zh", () => {
    expect(en.nav.interviewShort).toBe("Interview");
    expect(zh.nav.interviewShort).toBe("访谈");
  });

  it("has pull-to-refresh labels in en and zh", () => {
    for (const m of [en, zh]) {
      expect(m.nav.pullToRefresh).toBeTruthy();
      expect(m.nav.releaseToRefresh).toBeTruthy();
      expect(m.nav.refreshing).toBeTruthy();
    }
  });

  it("has persona voice distill labels in en and zh", () => {
    for (const m of [en, zh]) {
      for (const k of ["distillVoice", "reDistillVoice", "clearVoice", "voiceDistilledOn", "voiceSamplesLabel", "voiceSamplesHelp", "errVoiceDistill", "addMoreMessages", "voiceEvidence", "evidence_rough", "evidence_fair", "evidence_good", "voiceMoreHint", "voiceCounter"] as const) {
        expect(m.interview[k]).toBeTruthy();
      }
    }
    expect(Object.keys(en.interview).sort()).toEqual(Object.keys(zh.interview).sort());
  });
});
