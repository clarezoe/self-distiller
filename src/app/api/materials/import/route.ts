import { NextResponse } from "next/server";
import { checkImportRateLimit, resolveImportUser } from "@/lib/import-token";
import { getProjectForUser } from "@/lib/services/projects";
import { importBodySchema, importMaterials } from "@/lib/services/agent-import";
import { readJsonBody, RequestBodyTooLargeError } from "@/lib/http/json-body";

// A 100-item batch may contain 100 maximum-size content fields plus JSON overhead.
const MAX_IMPORT_BODY_BYTES = 52_000_000;

// POST /api/materials/import — bulk import for agents.
// Token-gated (Authorization: Bearer <import token>), NOT session-gated: the path
// is in PUBLIC_PREFIXES (auth.config.ts) so the proxy never redirects it, and the
// check below is the only gate. Only User.importTokenHash authorizes; the persona
// read token does not.
export async function POST(request: Request) {
  const userId = await resolveImportUser(request.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkImportRateLimit(userId)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_IMPORT_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    body = null;
  }
  const parsed = importBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await getProjectForUser(userId, parsed.data.projectId);
  } catch {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const result = await importMaterials(parsed.data.projectId, parsed.data.materials, {
    createMissingContexts: parsed.data.createMissingContexts,
  });
  return NextResponse.json(result, { status: 200 });
}
