// Minimal typed client for Jev (typesafe.ai SystemOne). Never throws: returns null when the
// key is unset, on timeout, non-2xx, or a malformed response. The API key is never logged.

import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";
const TIMEOUT_MS = 8000;

export type JevNoulQuestion = { type: "noul"; instructions: string };
export type JevAnswers = Record<string, { noul: number }>;

export function isJevEnabled(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim());
}

export async function jevNoul(
  state: Record<string, unknown>,
  questions: Record<string, JevNoulQuestion>,
): Promise<{ answers: Record<string, number>; error: null } | { answers: null; error: string }> {
  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key) return { answers: null, error: "TYPESAFE_API_KEY not set" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, state, questions }),
      signal: controller.signal,
    });
    if (!res.ok) return { answers: null, error: `Jev HTTP ${res.status}` };
    const body = (await res.json()) as { answers?: JevAnswers };
    const out: Record<string, number> = {};
    for (const name of Object.keys(questions)) {
      const v = body?.answers?.[name]?.noul;
      if (typeof v !== "number" || !Number.isFinite(v)) {
        return { answers: null, error: `Jev response missing answer "${name}"` };
      }
      out[name] = v;
    }
    return { answers: out, error: null };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { answers: null, error: aborted ? "Jev timeout" : "Jev request failed" };
  } finally {
    clearTimeout(timer);
  }
}

// Ask Jev noul questions and log the call to LlmCallLog. Returns answers or null.
export async function askJev(args: {
  userId: string;
  projectId?: string;
  agentRole: string;
  state: Record<string, unknown>;
  questions: Record<string, JevNoulQuestion>;
}): Promise<Record<string, number> | null> {
  if (!isJevEnabled()) return null;
  const r = await jevNoul(args.state, args.questions);
  await prisma.llmCallLog
    .create({
      data: {
        userId: args.userId,
        projectId: args.projectId ?? null,
        agentRole: args.agentRole,
        provider: "typesafe",
        model: MODEL,
        request: JSON.parse(JSON.stringify({ state: args.state, questions: args.questions })),
        rawResponse: Prisma.JsonNull,
        parsedResponse: r.answers ? r.answers : Prisma.JsonNull,
        error: r.error,
      },
    })
    .catch(() => {});
  return r.answers;
}
