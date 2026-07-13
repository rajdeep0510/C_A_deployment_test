import { NextResponse } from "next/server";
import { requireRole, deleteUser } from "@/lib/auth";
import { deleteAcademyCascade } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;

  const session = await requireRole(request, "admin");
  if (session instanceof NextResponse) return session;

  const targetProfile = await prisma.profiles.findUnique({
    where: { id: targetId },
    select: { role: true },
  });

  if (targetProfile?.role === "academy_owner") {
    const academies = await prisma.academies.findMany({
      where: { owner_id: targetId },
      select: { id: true },
    });
    for (const academy of academies) {
      await deleteAcademyCascade(academy.id);
    }
  }

  await deleteUser(targetId);
  return NextResponse.json({ message: "User deleted successfully" });
}
