import { prisma } from "@/lib/db";

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
