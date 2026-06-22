import { prisma } from "@/lib/db";

export function listProjects(userId: string) {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export function createProject(userId: string, data: { name: string; goal: string }) {
  return prisma.project.create({
    data: { userId, name: data.name, goal: data.goal },
  });
}

export function getActiveProject(userId: string) {
  return prisma.project.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProjectForUser(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });
  if (!project) throw new Error("Project not found");
  return project;
}
