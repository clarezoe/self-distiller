// Write-scoped agent import token (GitHub #38). Deliberately separate from the
// read-only persona token: only User.importTokenHash authorizes imports. The
// persona token and env PERSONA_API_TOKEN never do.

import { prisma } from "@/lib/db";
import { hashPersonaToken, parseBearer } from "@/lib/persona";

export async function resolveImportUser(authHeader: string | null): Promise<string | null> {
  const token = parseBearer(authHeader);
  if (!token) return null;
  const user = await prisma.user.findFirst({
    where: { importTokenHash: hashPersonaToken(token) },
    select: { id: true },
  });
  return user?.id ?? null;
}

// Simple fixed-window in-memory limiter, per user. Per-process only (single
// instance deployment); good enough to blunt a runaway agent loop.
export const IMPORT_RATE_LIMIT = 30;
export const IMPORT_RATE_WINDOW_MS = 60_000;

const windows = new Map<string, { start: number; count: number }>();

export function checkImportRateLimit(userId: string, now = Date.now()): boolean {
  const w = windows.get(userId);
  if (!w || now - w.start >= IMPORT_RATE_WINDOW_MS) {
    windows.set(userId, { start: now, count: 1 });
    return true;
  }
  if (w.count >= IMPORT_RATE_LIMIT) return false;
  w.count++;
  return true;
}

export function resetImportRateLimit() {
  windows.clear();
}
