import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { parseGoogleChat } from "@/lib/import/google-chat";
import { commitGoogleChatImport, UnknownOwnerError } from "@/lib/services/import-google-chat";

const MAX_TOTAL_CHARS = 20_000_000;

const fileSchema = z.object({
  content: z.string().min(1),
  spaceName: z.string().optional(),
});

const commitSchema = z.object({
  projectId: z.string().min(1),
  files: z.array(fileSchema).min(1),
  ownerKey: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = commitSchema.safeParse(body);
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

  // Re-parse server-side: never trust client-supplied conversation structure.
  const parsedChat = parseGoogleChat(parsed.data.files);
  try {
    const result = await commitGoogleChatImport(
      user.id,
      parsed.data.projectId,
      parsedChat,
      parsed.data.ownerKey,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof UnknownOwnerError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
