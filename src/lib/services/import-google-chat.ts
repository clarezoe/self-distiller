import { MaterialSource } from "@/generated/prisma/client";
import { createMaterial } from "@/lib/services/materials";
import { getProjectForUser } from "@/lib/services/projects";
import {
  type ParsedConversation,
  type ParsedGoogleChat,
  type ParsedTurn,
} from "@/lib/import/google-chat";

// Build the material content for one conversation. The user's own lines are
// labeled `me:` and are the primary style signal (PRD §15.2); everyone else is
// kept as labeled context, NOT treated as the user's style. Owner detection
// compares the turn's canonical `key` (set by the parser) against `ownerKey` —
// never a key re-derived from the lossy display `sender`.
export function conversationToContent(
  conversation: ParsedConversation,
  ownerKey: string,
): string {
  return conversation.turns
    .map((turn: ParsedTurn) => {
      const isOwner = turn.key === ownerKey;
      const label = isOwner ? "me" : turn.sender;
      return `${label}: ${turn.text}`;
    })
    .join("\n");
}

export type GoogleChatCommitResult = {
  created: number;
  materialIds: string[];
};

export class UnknownOwnerError extends Error {
  constructor() {
    super("Selected participant is not present in the parsed export.");
    this.name = "UnknownOwnerError";
  }
}

// The owner must be one of the parsed participants. Without this, a stale or
// bogus ownerKey would silently produce materials where NO line is labeled
// `me:` — a style-less material that breaks the §15.2 contract. Pure so it can
// be unit-tested without the DB.
export function isKnownOwner(parsed: ParsedGoogleChat, ownerKey: string): boolean {
  return parsed.participants.some((p) => p.key === ownerKey);
}

// Persist one RawMaterial per conversation. Ownership must be verified by the
// caller's auth path; we also re-check here as defense in depth.
export async function commitGoogleChatImport(
  userId: string,
  projectId: string,
  parsed: ParsedGoogleChat,
  ownerKey: string,
): Promise<GoogleChatCommitResult> {
  await getProjectForUser(userId, projectId);

  // The server re-parses the files, so the participant keys are authoritative.
  if (!isKnownOwner(parsed, ownerKey)) {
    throw new UnknownOwnerError();
  }

  const materialIds: string[] = [];
  const participantList = parsed.participants.map((p) => ({
    name: p.name,
    email: p.email,
    key: p.key,
    isOwner: p.key === ownerKey,
  }));

  for (const conversation of parsed.conversations) {
    const content = conversationToContent(conversation, ownerKey);
    if (!content.trim()) continue;

    const material = await createMaterial(projectId, {
      sourceType: MaterialSource.chat,
      content,
      sourceMetadata: {
        source: "google_chat_takeout",
        spaceName: conversation.spaceName ?? null,
        participants: participantList,
        dateRange: conversation.dateRange,
        ownerKey,
      },
    });
    materialIds.push(material.id);
  }

  return { created: materialIds.length, materialIds };
}
