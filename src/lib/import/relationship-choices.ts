export type RelationshipChoice = { value: string; newName: string };

export type RelationshipChoiceConversation = {
  index: number;
  participantKeys: string[];
};

/**
 * Relationship choices are shared only by one-to-one conversations with the
 * same owner and partner. Group conversations stay independent because a
 * group may contain people with different relationships to the owner.
 */
export function relationshipChoiceKey(
  conversation: RelationshipChoiceConversation,
  ownerKey: string,
): string {
  const partners = conversation.participantKeys.filter((key) => key !== ownerKey);
  if (partners.length === 1) return `owner:${ownerKey}|partner:${partners[0]}`;
  return `owner:${ownerKey}|conversation:${conversation.index}`;
}

export function getRelationshipChoice(
  choices: Record<string, RelationshipChoice>,
  conversation: RelationshipChoiceConversation,
  ownerKey: string,
  notSet: RelationshipChoice,
): RelationshipChoice {
  return choices[relationshipChoiceKey(conversation, ownerKey)] ?? notSet;
}

export function setRelationshipChoice(
  choices: Record<string, RelationshipChoice>,
  conversation: RelationshipChoiceConversation,
  ownerKey: string,
  choice: RelationshipChoice,
): Record<string, RelationshipChoice> {
  return {
    ...choices,
    [relationshipChoiceKey(conversation, ownerKey)]: choice,
  };
}
