import { describe, expect, it } from "vitest";
import {
  getRelationshipChoice,
  relationshipChoiceKey,
  setRelationshipChoice,
  type RelationshipChoice,
} from "./relationship-choices";

const notSet: RelationshipChoice = { value: "", newName: "" };
const husband: RelationshipChoice = { value: "husband", newName: "" };
const friend: RelationshipChoice = { value: "friend", newName: "" };

const dm = (index: number, partner: string) => ({ index, participantKeys: ["me", partner] });
const group = (index: number) => ({ index, participantKeys: ["me", "husband", "friend"] });

describe("relationship choices", () => {
  it("reuses only the same partner in one-to-one conversations", () => {
    const choices = setRelationshipChoice({}, dm(0, "husband"), "me", husband);
    expect(getRelationshipChoice(choices, dm(1, "husband"), "me", notSet)).toEqual(husband);
    expect(getRelationshipChoice(choices, dm(2, "friend"), "me", notSet)).toEqual(notSet);
  });

  it("keeps a multi-partner group independent from every DM", () => {
    let choices = setRelationshipChoice({}, dm(0, "husband"), "me", husband);
    choices = setRelationshipChoice(choices, dm(1, "friend"), "me", friend);
    expect(getRelationshipChoice(choices, group(2), "me", notSet)).toEqual(notSet);

    choices = setRelationshipChoice(choices, group(2), "me", friend);
    expect(getRelationshipChoice(choices, dm(0, "husband"), "me", notSet)).toEqual(husband);
    expect(getRelationshipChoice(choices, dm(1, "friend"), "me", notSet)).toEqual(friend);
  });

  it("scopes choices to the owner so changing owner cannot reuse a stale assignment", () => {
    const choices = setRelationshipChoice({}, dm(0, "husband"), "me", husband);
    expect(getRelationshipChoice(choices, dm(0, "husband"), "other", notSet)).toEqual(notSet);
    expect(relationshipChoiceKey(dm(0, "husband"), "me")).not.toBe(
      relationshipChoiceKey(dm(0, "husband"), "other"),
    );
  });
});
