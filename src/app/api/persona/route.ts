import { NextResponse } from "next/server";
import {
  getPersonaForUser,
  personaETag,
  resolvePersonaUser,
  toSystemPrompt,
} from "@/lib/persona";

// GET /api/persona?format=md|json
// Token-gated (Authorization: Bearer <token>), NOT session-gated:
// `/api/persona` is in PUBLIC_PREFIXES so the proxy never redirects it to login;
// the token check below is the only gate. The Bearer is a PER-USER persona token
// (sha256 at rest) — or the env PERSONA_API_TOKEN for the owner (back-compat).
// Each token resolves to ITS user's persona, never another user's.
export async function GET(request: Request) {
  const userId = await resolvePersonaUser(request.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const persona = await getPersonaForUser(userId);
  if (!persona) {
    return NextResponse.json({ error: "No active Self Model" }, { status: 404 });
  }

  const etag = personaETag(persona);
  const lastModified = persona.createdAt.toUTCString();

  // If-None-Match → 304 when the active version is unchanged.
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Last-Modified": lastModified },
    });
  }

  const format = new URL(request.url).searchParams.get("format") ?? "md";

  if (format === "json") {
    return NextResponse.json(persona.modelJson, {
      headers: { ETag: etag, "Last-Modified": lastModified },
    });
  }

  // Default: an agent-ready system prompt as markdown.
  return new NextResponse(toSystemPrompt(persona.modelJson), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      ETag: etag,
      "Last-Modified": lastModified,
    },
  });
}
