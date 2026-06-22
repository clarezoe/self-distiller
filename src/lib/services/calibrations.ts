import { prisma } from "@/lib/db";
import type { CalibrationDecision } from "@/generated/prisma/client";

// Persisted shape used internally. hiddenAgentAnswer is the secret (PRD §23.9).
export type CalibrationRow = {
  id: string;
  projectId: string;
  contextCombinationId: string | null;
  scenario: string;
  incomingMessage: string | null;
  hiddenAgentAnswer: string;
  userAnswer: string | null;
  comparisonReport: unknown;
  updateProposal: unknown;
  userDecision: CalibrationDecision | null;
  createdAt: Date;
};

// CRITICAL INVARIANT (PRD §23.9): the agent's predicted answer must NEVER reach the client
// before the user submits their own answer. `redactCalibration` is the single chokepoint —
// every client-facing selector funnels through it. While userAnswer is null, hiddenAgentAnswer
// (and the derived comparison/proposal, which embed it) are stripped and `hiddenRevealed=false`.
export type ClientCalibration = {
  id: string;
  projectId: string;
  contextCombinationId: string | null;
  scenario: string;
  incomingMessage: string | null;
  userAnswer: string | null;
  // Present ONLY after the user has answered.
  hiddenAgentAnswer: string | null;
  comparisonReport: unknown | null;
  updateProposal: unknown | null;
  userDecision: CalibrationDecision | null;
  hiddenRevealed: boolean;
  createdAt: string;
};

export function redactCalibration(row: CalibrationRow): ClientCalibration {
  const revealed = row.userAnswer != null;
  return {
    id: row.id,
    projectId: row.projectId,
    contextCombinationId: row.contextCombinationId,
    scenario: row.scenario,
    incomingMessage: row.incomingMessage,
    userAnswer: row.userAnswer,
    // Withheld until the user has answered. Comparison/proposal are only ever produced
    // AFTER an answer, but we gate them on the same flag for defense in depth.
    hiddenAgentAnswer: revealed ? row.hiddenAgentAnswer : null,
    comparisonReport: revealed ? row.comparisonReport ?? null : null,
    updateProposal: revealed ? row.updateProposal ?? null : null,
    userDecision: row.userDecision,
    hiddenRevealed: revealed,
    createdAt: row.createdAt.toISOString(),
  };
}

function toJson(value: unknown): object {
  return JSON.parse(JSON.stringify(value ?? {})) as object;
}

export async function createCalibration(
  projectId: string,
  data: {
    contextCombinationId?: string | null;
    scenario: string;
    incomingMessage?: string | null;
    hiddenAgentAnswer: string;
  },
) {
  return prisma.blindCalibration.create({
    data: {
      projectId,
      contextCombinationId: data.contextCombinationId ?? null,
      scenario: data.scenario,
      incomingMessage: data.incomingMessage ?? null,
      hiddenAgentAnswer: data.hiddenAgentAnswer,
    },
  });
}

// Ownership: a calibration is reachable only via a project the user owns.
// Returns the FULL row (incl. hiddenAgentAnswer) — server-only. Never return this to a
// client without funneling through `redactCalibration`.
export async function getCalibrationForUser(
  userId: string,
  calibrationId: string,
): Promise<CalibrationRow> {
  const row = await prisma.blindCalibration.findFirst({
    where: { id: calibrationId, project: { userId } },
  });
  if (!row) throw new Error("Calibration not found");
  return row as CalibrationRow;
}

// Client-safe getter: full row resolved, then redacted before it leaves the service.
export async function getClientCalibrationForUser(
  userId: string,
  calibrationId: string,
): Promise<ClientCalibration> {
  return redactCalibration(await getCalibrationForUser(userId, calibrationId));
}

// Client-safe list: every row redacted. The `select` also omits hiddenAgentAnswer at the
// DB layer (belt-and-braces) — but list cards never need it anyway.
export async function listClientCalibrations(projectId: string): Promise<ClientCalibration[]> {
  const rows = await prisma.blindCalibration.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => redactCalibration(r as CalibrationRow));
}

// Set the user's real answer. Only AFTER this is set may the hidden answer be revealed.
export async function setUserAnswer(calibrationId: string, userAnswer: string) {
  return prisma.blindCalibration.update({
    where: { id: calibrationId },
    data: { userAnswer },
  });
}

export async function setComparison(
  calibrationId: string,
  comparisonReport: unknown,
  updateProposal: unknown,
) {
  return prisma.blindCalibration.update({
    where: { id: calibrationId },
    data: {
      comparisonReport: toJson(comparisonReport),
      updateProposal: toJson(updateProposal),
    },
  });
}

export async function setDecision(calibrationId: string, decision: CalibrationDecision) {
  return prisma.blindCalibration.update({
    where: { id: calibrationId },
    data: { userDecision: decision },
  });
}
