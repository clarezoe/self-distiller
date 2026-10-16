import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteMaterial,
  getMaterialForUser,
  setMaterialContexts,
} from "@/lib/services/materials";

const patchSchema = z.object({ contextIds: z.array(z.string()) });

// PATCH /api/materials/:id { contextIds } — set relationship contexts; evidence follows.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let material;
  try {
    material = await getMaterialForUser(user.id, id);
  } catch {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }
  try {
    const result = await setMaterialContexts(material.projectId, [id], parsed.data.contextIds);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  let material;
  try {
    material = await getMaterialForUser(user.id, id);
  } catch {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }
  await deleteMaterial(material.projectId, id);
  return NextResponse.json({ ok: true });
}
