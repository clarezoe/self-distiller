import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { hashPersonaToken } from "@/lib/persona";
import type { Provider } from "@/lib/llm";

export function getSettings(userId: string) {
  return prisma.llmSettings.findUnique({ where: { userId } });
}

export function updateSettings(
  userId: string,
  data: { defaultProvider?: string; defaultModel?: string | null },
) {
  return prisma.llmSettings.upsert({
    where: { userId },
    update: data,
    create: { userId, defaultProvider: data.defaultProvider ?? "openai_compatible", defaultModel: data.defaultModel ?? null },
  });
}

// Never selects the encrypted secret.
export function listCredentials(userId: string) {
  return prisma.credential.findMany({
    where: { userId },
    select: { id: true, provider: true, label: true, baseUrl: true, createdAt: true },
    orderBy: { provider: "asc" },
  });
}

export function upsertCredential(
  userId: string,
  input: { provider: Provider; label?: string; baseUrl?: string; apiKey: string },
) {
  const secret = encryptSecret(input.apiKey);
  return prisma.credential.upsert({
    where: { userId_provider: { userId, provider: input.provider } },
    update: { label: input.label, baseUrl: input.baseUrl || null, secret },
    create: { userId, provider: input.provider, label: input.label, baseUrl: input.baseUrl || null, secret },
  });
}

export function deleteCredential(userId: string, provider: Provider) {
  return prisma.credential.deleteMany({ where: { userId, provider } });
}

// Whether the user has a per-user persona API token set (GitHub #13). Never
// returns the hash itself — just presence.
export async function hasPersonaToken(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { personaTokenHash: true },
  });
  return !!user?.personaTokenHash;
}

// Generate a fresh per-user persona token: store sha256(token) at rest and
// return the plaintext ONCE. Regenerating replaces any previous token.
export async function generatePersonaToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { personaTokenHash: hashPersonaToken(token) },
  });
  return token;
}
