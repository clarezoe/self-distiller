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

  it("has interview language picker labels in en and zh", () => {
    for (const m of [en, zh]) {
      expect(m.interview.languageOther).toBeTruthy();
      expect(m.interview.interviewLanguagePlaceholder).toBeTruthy();
    }
  });

  it("has personas page and nav labels in en and zh", () => {
    expect(en.nav.personas).toBe("Personas");
    expect(zh.nav.personas).toBe("人物");
    for (const m of [en, zh]) {
      for (const k of Object.keys(en.personas) as (keyof typeof en.personas)[]) {
        expect(m.personas[k]).toBeTruthy();
      }
      expect(m.interview.managePersonas).toBeTruthy();
      expect(m.interview.noSavedPersonasHint).toBeTruthy();
    }
    expect(Object.keys(en.personas).sort()).toEqual(Object.keys(zh.personas).sort());
  });

  it("has contextual interview turn labels in en and zh", () => {
    for (const m of [en, zh]) {
      for (const k of ["typing", "retry", "errFailedReply", "goalReached", "interviewPlan"] as const) {
        expect(m.interview[k]).toBeTruthy();
      }
    }
  });
});
