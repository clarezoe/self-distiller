import { MaterialSource } from "@/generated/prisma/client";
import { createMaterialsBatch, type MaterialInput } from "@/lib/services/materials";
import { getProjectForUser } from "@/lib/services/projects";
import {
  type ParsedConversation,
  type ParsedGoogleChat,
} from "@/lib/import/google-chat";
import { chunkConversation } from "@/lib/import/chunk";

// Build the full material content for one conversation. The user's own lines are
// labeled `me:` and are the primary style signal (PRD §15.2); everyone else is
// kept as labeled context, NOT treated as the user's style. Owner detection
// compares the turn's canonical `key` (set by the parser) against `ownerKey` —
// never a key re-derived from the lossy display `sender`.
//
// Kept DRY by delegating to the chunker: with no budget cap there is exactly one
// chunk whose content is every labeled turn joined by "\n".
export function conversationToContent(
  conversation: ParsedConversation,
  ownerKey: string,
): string {
  const chunks = chunkConversation(conversation, ownerKey, {
    targetChars: Number.POSITIVE_INFINITY,
    maxChars: Number.POSITIVE_INFINITY,
  });
  return chunks.map((c) => c.content).join("\n");
}

export type GoogleChatCommitResult = {
  created: number;
  // Chunks skipped as content-hash duplicates (re-import of the same export, or
  // two identical chunks). Intentional dedup, reported — never a silent drop.
  skipped: number;
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

  const participantList = parsed.participants.map((p) => ({
    name: p.name,
    email: p.email,
    key: p.key,
    isOwner: p.key === ownerKey,
  }));

  // One RawMaterial PER CHUNK. A small conversation chunks to exactly one
  // material; a 30MB DM chunks into many — each ≤ ~20k chars and Analyze-able.
  // Collect every chunk as an input, then insert via the dedup-aware batch so a
  // re-imported export (or duplicate chunks) is skipped, not double-stored.
  const inputs: MaterialInput[] = [];
  for (const conversation of parsed.conversations) {
    const chunks = chunkConversation(conversation, ownerKey);
    for (const chunk of chunks) {
      if (!chunk.content.trim()) continue;

      inputs.push({
        sourceType: MaterialSource.chat,
        content: chunk.content,
        sourceMetadata: {
          source: "google_chat_takeout",
          spaceName: conversation.spaceName ?? null,
          part: chunk.part,
          partsTotal: chunk.partsTotal,
          dateRange: chunk.dateRange,
          participants: participantList,
          ownerKey,
        },
      });
    }
  }

  const { created, skipped } = await createMaterialsBatch(projectId, inputs);
  return { created: created.length, skipped, materialIds: created.map((m) => m.id) };
}
