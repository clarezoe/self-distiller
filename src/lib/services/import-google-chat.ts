import { MaterialSource } from "@/generated/prisma/client";
import { createMaterialsBatch, type MaterialInput } from "@/lib/services/materials";
import { getProjectForUser } from "@/lib/services/projects";
import { createContext, getContextsByIds, listContexts } from "@/lib/services/contexts";
import {
  conversationPartners,
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

export type ConversationAssignment = {
  conversationIndex: number;
  contextIds?: string[];
  newRelationshipName?: string;
};

export class InvalidAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAssignmentError";
  }
}

// First line of every chunk so the analyzer sees who the partner is.
export function chatHeader(partners: string[], relationshipNames: string[]): string {
  const who = partners.length > 0 ? partners.join(", ") : "unknown";
  const rel = relationshipNames.length > 0 ? ` (${relationshipNames.join(", ")})` : "";
  return `# Chat with ${who}${rel}`;
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
  assignments: ConversationAssignment[] = [],
): Promise<GoogleChatCommitResult> {
  await getProjectForUser(userId, projectId);

  // The server re-parses the files, so the participant keys are authoritative.
  if (!isKnownOwner(parsed, ownerKey)) {
    throw new UnknownOwnerError();
  }

  // Validate + resolve assignments to context ids per conversation BEFORE any write
  // of materials. New relationship names are created once (case-insensitive dedupe).
  const contextsByConversation = new Map<number, Set<string>>();
  const claimedIds = new Set<string>();
  for (const a of assignments) {
    if (
      !Number.isInteger(a.conversationIndex) ||
      a.conversationIndex < 0 ||
      a.conversationIndex >= parsed.conversations.length
    ) {
      throw new InvalidAssignmentError("Assignment refers to an unknown conversation.");
    }
    for (const id of a.contextIds ?? []) claimedIds.add(id);
  }
  if (claimedIds.size > 0) {
    const found = (await getContextsByIds(projectId, [...claimedIds])).filter((c) => c.type === "relationship");
    if (found.length !== claimedIds.size) {
      throw new InvalidAssignmentError("Unknown context for this project.");
    }
  }
  const relationshipIdByName = new Map<string, string>();
  const needsNew = assignments.some((a) => a.newRelationshipName?.trim());
  if (needsNew) {
    for (const c of await listContexts(projectId)) {
      if (c.type === "relationship") relationshipIdByName.set(c.name.trim().toLowerCase(), c.id);
    }
  }
  for (const a of assignments) {
    const set = contextsByConversation.get(a.conversationIndex) ?? new Set<string>();
    for (const id of a.contextIds ?? []) set.add(id);
    const name = a.newRelationshipName?.trim();
    if (name) {
      const k = name.toLowerCase();
      let id = relationshipIdByName.get(k);
      if (!id) {
        id = (await createContext(projectId, { type: "relationship", name })).id;
        relationshipIdByName.set(k, id);
      }
      set.add(id);
    }
    contextsByConversation.set(a.conversationIndex, set);
  }
  const allIds = [...new Set([...contextsByConversation.values()].flatMap((s) => [...s]))];
  const nameById = new Map<string, string>();
  if (allIds.length > 0) {
    for (const c of await getContextsByIds(projectId, allIds)) nameById.set(c.id, c.name);
  }

  // One RawMaterial PER CHUNK. A small conversation chunks to exactly one
  // material; a 30MB DM chunks into many — each ≤ ~20k chars and Analyze-able.
  // Collect every chunk as an input, then insert via the dedup-aware batch so a
  // re-imported export (or duplicate chunks) is skipped, not double-stored.
  const inputs: MaterialInput[] = [];
  for (const [index, conversation] of parsed.conversations.entries()) {
    const partners = conversationPartners(conversation, ownerKey, parsed.participants);
    const partnerKeys = conversation.participantKeys.filter((k) => k !== ownerKey);
    const contextIds = [...(contextsByConversation.get(index) ?? [])];
    const header = chatHeader(
      partners.length > 0 ? partners : [conversation.title ?? conversation.spaceName ?? "unknown"],
      contextIds.map((id) => nameById.get(id)).filter((n): n is string => Boolean(n)),
    );
    const chunks = chunkConversation(conversation, ownerKey, { header });
    for (const chunk of chunks) {
      if (!chunk.content.trim()) continue;

      inputs.push({
        sourceType: MaterialSource.chat,
        content: chunk.content,
        contextIds,
        sourceMetadata: {
          source: "google_chat_takeout",
          spaceName: conversation.spaceName ?? null,
          title: conversation.title ?? null,
          part: chunk.part,
          partsTotal: chunk.partsTotal,
          dateRange: chunk.dateRange,
          partners: partnerKeys.map((key, i) => ({ name: partners[i], key })),
          ownerKey,
        },
      });
    }
  }

  const { created, skipped } = await createMaterialsBatch(projectId, inputs);
  return { created: created.length, skipped, materialIds: created.map((m) => m.id) };
}
