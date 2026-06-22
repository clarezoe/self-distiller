import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProjectForUser } from "@/lib/services/projects";
import { getActiveModel, modelRowToJson } from "@/lib/self-model/version";
import { toMarkdown } from "@/lib/self-model/markdown";

// GET /api/self-model/export?projectId=...&format=markdown|json
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  const format = url.searchParams.get("format") ?? "markdown";
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  try {
    await getProjectForUser(user.id, projectId);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const row = await getActiveModel(projectId);
  if (!row) return NextResponse.json({ error: "No active Self Model" }, { status: 404 });

  const json = modelRowToJson(row);

  if (format === "json") {
    return new NextResponse(JSON.stringify(json, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="self-model-v${json.version}.json"`,
      },
    });
  }

  if (format === "markdown") {
    return new NextResponse(toMarkdown(json), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="self-model-v${json.version}.md"`,
      },
    });
  }

  return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
}
