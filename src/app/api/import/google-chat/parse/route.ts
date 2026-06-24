import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { parseGoogleChat } from "@/lib/import/google-chat";
import { chunkConversation } from "@/lib/import/chunk";

// Guard absurd payloads: large Takeout files are POSTed as JSON. The biggest
// real single DM messages.json is ~30MB, so 64MB total leaves headroom for
// batch uploads. App Router server-side request.json() has no 4MB Pages limit;
// fine for self-host. Beyond this we still return a clear 413.
const MAX_TOTAL_CHARS = 64_000_000;

const fileSchema = z.object({
  content: z.string().min(1),
  spaceName: z.string().optional(),
});

const parseSchema = z.object({
  projectId: z.string().min(1),
  files: z.array(fileSchema).min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = parseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const totalChars = parsed.data.files.reduce((n, f) => n + f.content.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      { error: "Upload too large. Split the Google Chat export into smaller batches." },
      { status: 413 },
    );
  }

  try {
    await getProjectForUser(user.id, parsed.data.projectId);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const result = parseGoogleChat(parsed.data.files);

  // Estimate how many materials (chunks) each conversation will create. Owner is
  // picked AFTER parse, but chunk count is driven by turn boundaries + the char
  // budget, not by which participant is labeled `me:` — so the top participant's
  // key gives a faithful estimate for the preview.
  const estimateOwnerKey = result.participants[0]?.key ?? "";

  // No materials created here — identity is picked first (parse-then-pick).
  return NextResponse.json({
    participants: result.participants,
    conversationCount: result.conversations.length,
    // Total materials that will be created across ALL conversations (not just preview).
    materialCount: result.conversations.reduce(
      (n, c) => n + chunkConversation(c, estimateOwnerKey).length,
      0,
    ),
    preview: result.conversations.slice(0, 5).map((c) => ({
      spaceName: c.spaceName ?? null,
      turnCount: c.turns.length,
      materialCount: chunkConversation(c, estimateOwnerKey).length,
      dateRange: c.dateRange,
    })),
  });
}
