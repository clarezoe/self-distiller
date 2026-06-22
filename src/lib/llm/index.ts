import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { Prisma } from "@/generated/prisma/client";
import { getAdapter, resolveProviderModel } from "./resolve";
import type {
  AgentRole,
  CompleteParams,
  CompleteResult,
  Provider,
  ResolvedCredential,
} from "./types";

export * from "./types";
export * from "./resolve";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export async function resolveCredential(
  userId: string,
  provider: Provider,
): Promise<ResolvedCredential> {
  const cred = await prisma.credential.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!cred) {
    throw new Error(`No credential configured for provider "${provider}". Add one in Settings.`);
  }
  return {
    provider,
    apiKey: decryptSecret(cred.secret),
    baseUrl: cred.baseUrl ?? undefined,
  };
}

export type RunAgentArgs = {
  userId: string;
  projectId?: string;
  agentRole: AgentRole;
  messages: CompleteParams["messages"];
  schema?: CompleteParams["schema"];
  temperature?: number;
  maxTokens?: number;
  providerOverride?: Provider;
  modelOverride?: string;
};

// Resolve provider/model per D6 (override → user default → fallback), call the adapter,
// and persist raw + parsed response to LlmCallLog (PRD §17.3).
export async function runAgent<T = unknown>(
  args: RunAgentArgs,
): Promise<CompleteResult<T>> {
  const settings = await prisma.llmSettings.findUnique({
    where: { userId: args.userId },
  });

  const { provider, model } = resolveProviderModel(settings, args);
  const adapter = getAdapter(provider);

  const cred = await resolveCredential(args.userId, provider);
  const params: CompleteParams = {
    messages: args.messages,
    model,
    schema: args.schema,
    temperature: args.temperature,
    maxTokens: args.maxTokens,
  };

  let result: CompleteResult<T> | null = null;
  let error: string | null = null;
  try {
    result = await adapter.complete<T>(params, cred);
    return result;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    await prisma.llmCallLog
      .create({
        data: {
          userId: args.userId,
          projectId: args.projectId ?? null,
          agentRole: args.agentRole,
          provider,
          model,
          request: toJson({ messages: args.messages, schema: args.schema?.name }),
          rawResponse: result ? toJson(result.raw) : Prisma.JsonNull,
          parsedResponse: result ? toJson(result.parsed) : Prisma.JsonNull,
          error,
        },
      })
      .catch(() => {});
  }
}
