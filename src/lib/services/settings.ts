import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
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
