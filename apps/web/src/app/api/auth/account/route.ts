import { NextResponse } from "next/server";
import { requireAuth, deleteUser } from "@/lib/auth";
import { deleteAcademyCascade } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  const userId = session.app_user.id;
  const profile = session.app_user.profile;

  if (profile?.role === "academy_owner") {
    const academies = await prisma.academies.findMany({
      where: { owner_id: userId },
      select: { id: true },
    });
    for (const academy of academies) {
      await deleteAcademyCascade(academy.id);
    }
  }

  await deleteUser(userId);
  return NextResponse.json({ message: "Account deleted successfully" });
}
