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

  it("has chat partner relationship labels in en and zh", () => {
    for (const m of [en, zh]) {
      for (const k of ["selectFolder", "relationshipsTitle", "relationshipsHelp", "relationshipLabel", "notSet", "newRelationship", "newRelationshipPlaceholder", "dateRange"] as const) {
        expect(m.googleChat[k]).toBeTruthy();
      }
      for (const k of ["noContexts", "noContextOfKind", "clearContext", "setContextFor", "contextKindLabel", "noContextsHint", "deleteMaterial", "confirmDelete", "oldImportsNote"] as const) {
        expect(m.import[k]).toBeTruthy();
      }
      for (const k of ["language", "role", "relationship", "scene"] as const) {
        expect(m.import.contextKinds[k]).toBeTruthy();
      }
    }
    expect(Object.keys(en.googleChat).sort()).toEqual(Object.keys(zh.googleChat).sort());
    expect(Object.keys(en.import).sort()).toEqual(Object.keys(zh.import).sort());
  });

  it("has import token settings labels in en and zh", () => {
    for (const m of [en, zh]) {
      for (const k of ["importTokenSection", "importTokenDescription", "importTokenSet", "importTokenNone", "generateImportToken", "regenerateImportToken", "revokeImportToken", "revoking", "importTokenOnce"] as const) {
        expect(m.settings[k]).toBeTruthy();
      }
      expect(m.import.sourceMetadataLabel).toBeTruthy();
    }
    expect(Object.keys(en.settings).sort()).toEqual(Object.keys(zh.settings).sort());
    expect(Object.keys(en.import).sort()).toEqual(Object.keys(zh.import).sort());
  });
});
