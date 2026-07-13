import { NextResponse } from "next/server";
import { requireAuth, deleteUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: coachId } = await params;

  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  const profile = session.app_user.profile;
  if (profile?.role !== "academy_owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const coachProfile = await prisma.profiles.findUnique({
    where: { id: coachId },
    select: { academy_id: true },
  });

  if (!coachProfile || coachProfile.academy_id !== profile.academy_id) {
    return NextResponse.json({ error: "Coach not in your academy" }, { status: 403 });
  }

  await deleteUser(coachId);
  return NextResponse.json({ message: "Coach deleted successfully" });
}
