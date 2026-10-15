import { prisma } from "@/lib/db";
import { runAgent } from "@/lib/llm";
import {
  buildPersonaVoiceDistillerMessages,
  formatVoiceProfile,
  PERSONA_VOICE_SCHEMA,
  VOICE_SAMPLES_MAX,
  VOICE_SAMPLES_MIN,
  type PersonaVoice,
} from "@/lib/prompts/persona-voice-distiller";

// Named, reusable interviewer personas (GitHub #8 v1).
// All operations are scoped by projectId. The CALLER must pass a projectId that belongs
// to the current user (use getActiveProject(user.id) / getProjectForUser), so a persona
// from project A is never visible/usable in project B or by another user.

export type PersonaInput = {
  name: string;
  description: string;
  relationship?: string | null;
};

// Pure: trim/validate user-authored persona input. Returns the cleaned values or an error
// message. Kept separate from Prisma so it is unit-testable.
export function normalizePersonaInput(input: PersonaInput): { ok: true; value: { name: string; description: string; relationship: string | null } } | { ok: false; error: string } {
  const name = input.name?.trim() ?? "";
  const description = input.description?.trim() ?? "";
  const relationship = input.relationship?.trim() || null;
  if (!name) return { ok: false, error: "Persona name is required." };
  if (name.length > 80) return { ok: false, error: "Persona name is too long (max 80)." };
  if (!description) return { ok: false, error: "Persona description is required." };
  if (description.length > 2000) return { ok: false, error: "Persona description is too long (max 2000)." };
  if (relationship && relationship.length > 80) return { ok: false, error: "Relationship label is too long (max 80)." };
  return { ok: true, value: { name, description, relationship } };
}

export function listPersonas(projectId: string) {
  return prisma.interviewerPersona.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export function createPersona(projectId: string, input: PersonaInput) {
  const normalized = normalizePersonaInput(input);
  if (!normalized.ok) throw new Error(normalized.error);
  return prisma.interviewerPersona.create({
    data: {
      projectId,
      name: normalized.value.name,
      description: normalized.value.description,
      relationship: normalized.value.relationship,
    },
  });
}

// Scoped delete: only removes the row if it belongs to the given (user-owned) project.
export function deletePersona(projectId: string, id: string) {
  return prisma.interviewerPersona.deleteMany({ where: { id, projectId } });
}

// Pure: validate pasted sample messages. Returns the trimmed samples or an error message.
export function validateVoiceSamples(samples: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const value = typeof samples === "string" ? samples.trim() : "";
  if (!value) return { ok: false, error: "Sample messages are required." };
  if (value.length < VOICE_SAMPLES_MIN) {
    return { ok: false, error: `Sample messages are too short (min ${VOICE_SAMPLES_MIN} characters) to capture a voice.` };
  }
  if (value.length > VOICE_SAMPLES_MAX) {
    return { ok: false, error: `Sample messages are too long (max ${VOICE_SAMPLES_MAX} characters).` };
  }
  return { ok: true, value };
}

// Distill the persona's speaking style from pasted messages (LLM) and store ONLY the
// resulting profile. Raw samples are never persisted: not on the persona, and the LLM call
// log request is redacted. Scoped by projectId (caller passes a user-owned project).
export async function distillPersonaVoice(projectId: string, personaId: string, samples: string, userId: string) {
  const validated = validateVoiceSamples(samples);
  if (!validated.ok) throw new Error(validated.error);

  const persona = await prisma.interviewerPersona.findFirst({ where: { id: personaId, projectId } });
  if (!persona) throw new Error("Persona not found");

  const result = await runAgent<PersonaVoice>({
    userId,
    projectId,
    agentRole: "persona_voice_distiller",
    messages: buildPersonaVoiceDistillerMessages({
      name: persona.name,
      relationship: persona.relationship,
      description: persona.description,
      samples: validated.value,
    }),
    schema: { name: "persona_voice", schema: PERSONA_VOICE_SCHEMA },
    redactRequest: true,
  });

  const voiceProfile = result.parsed ? formatVoiceProfile(result.parsed) : "";
  if (!voiceProfile) {
    throw new Error("Distiller returned no voice profile. Try again or check the model/credential.");
  }

  const updated = await prisma.interviewerPersona.updateMany({
    where: { id: personaId, projectId },
    data: { voiceProfile, voiceDistilledAt: new Date() },
  });
  if (updated.count === 0) throw new Error("Persona not found");
  return prisma.interviewerPersona.findFirstOrThrow({ where: { id: personaId, projectId } });
}

// Scoped clear: go back to description-only.
export async function clearPersonaVoice(projectId: string, personaId: string) {
  const r = await prisma.interviewerPersona.updateMany({
    where: { id: personaId, projectId },
    data: { voiceProfile: null, voiceDistilledAt: null },
  });
  if (r.count === 0) throw new Error("Persona not found");
  return prisma.interviewerPersona.findFirstOrThrow({ where: { id: personaId, projectId } });
}

// Voice profile for a persona by id within a project (null if none / not found).
export async function getPersonaVoiceProfile(projectId: string, personaId: string): Promise<string | null> {
  const p = await prisma.interviewerPersona.findFirst({ where: { id: personaId, projectId }, select: { voiceProfile: true } });
  return p?.voiceProfile ?? null;
}
